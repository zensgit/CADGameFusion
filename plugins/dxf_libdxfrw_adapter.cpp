#include "dxf_libdxfrw_adapter.hpp"
#include <vector>
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

// Full AutoCAD 256-color ACI palette.
// Colors 10-249: 24 hue groups × 10 shades (HSV-based).
// Shades 0,2,4,6,8 = full saturation; 1,3,5,7,9 = 33% saturation.
// Value levels per pair: 100%, 74%, 51%, 41%, 31%.
static uint32_t aci_to_rgb(int aci) {
    if (aci <= 0 || aci > 255) return 0xDCDCE6;

    // ACI 1-9: standard primary colors
    static const uint32_t std9[9] = {
        0xFF0000, 0xFFFF00, 0x00FF00, 0x00FFFF, 0x0000FF,
        0xFF00FF, 0xFFFFFF, 0x808080, 0xC0C0C0
    };
    if (aci <= 9) return std9[aci - 1];

    // ACI 250-255: grays
    if (aci >= 250) {
        static const uint32_t grays[6] = {
            0x333333, 0x5B5B5B, 0x828282, 0xAAAAAA, 0xD2D2D2, 0xFFFFFF
        };
        return grays[aci - 250];
    }

    // ACI 10-249: compute from hue group and shade
    int idx       = aci - 10;
    int hue_group = idx / 10;  // 0..23
    int shade     = idx % 10;  // 0..9

    // Value levels (per shade pair)
    static const float V_levels[5] = {1.0f, 0.74f, 0.51f, 0.41f, 0.31f};
    float V = V_levels[shade / 2];
    float S = (shade % 2 == 0) ? 1.0f : 0.33f;

    // Hue in [0,360), stepping 15° per group
    float hue = static_cast<float>(hue_group) * 15.0f;

    // HSV → RGB (float)
    float h6 = hue / 60.0f;
    float C  = V * S;
    float X  = C * (1.0f - std::fabs(std::fmod(h6, 2.0f) - 1.0f));
    float m  = V - C;
    float r, g, b;
    int   hi = static_cast<int>(h6) % 6;
    switch (hi) {
        case 0: r=C; g=X; b=0; break;
        case 1: r=X; g=C; b=0; break;
        case 2: r=0; g=C; b=X; break;
        case 3: r=0; g=X; b=C; break;
        case 4: r=X; g=0; b=C; break;
        default: r=C; g=0; b=X; break;
    }
    auto u8 = [](float v) { return static_cast<uint32_t>(std::min(255.0f, (v + 0.002f) * 255.0f)); };
    return (u8(r+m) << 16) | (u8(g+m) << 8) | u8(b+m);
}

// Returns true for entities that should be skipped (paper space, frozen layer)
// Note: frozenLayers pointer may be null during early init (block callbacks)
bool CadgfDrwAdapter::shouldSkipEntity(const DRW_Entity& ent) const {
    if (ent.space == DRW::PaperSpace) return true;
    if (!m_frozenLayers.empty() && m_frozenLayers.count(ent.layer)) return true;
    return false;
}

// Sentinel value meaning "BYBLOCK — inherit from INSERT entity"
static constexpr uint32_t BYBLOCK_COLOR = 0xFFFFFFFF;

static uint32_t drw_entity_color(const DRW_Entity& ent) {
    if (ent.color24 != -1) return static_cast<uint32_t>(ent.color24) & 0xFFFFFF;
    if (ent.color > 0 && ent.color <= 255) return aci_to_rgb(ent.color);
    if (ent.color == 0) return BYBLOCK_COLOR; // BYBLOCK: inherit from INSERT
    return 0; // BYLAYER (color == 256)
}

// Convert DRW lineWidth enum to mm (0 = use layer/default)
static double drw_lweight_mm(DRW_LW_Conv::lineWidth lw) {
    int dxfVal = DRW_LW_Conv::lineWidth2dxfInt(lw);
    if (dxfVal <= 0) return 0.0; // bylayer / byblock / default / 0.00mm
    return dxfVal / 100.0;
}

// Expand a polyline segment with arc bulge into discrete points.
// Appends points AFTER (x1,y1) up to and including (x2,y2).
static void appendBulgeSegment(
    std::vector<std::pair<double,double>>& pts,
    double x1, double y1, double x2, double y2, double bulge)
{
    if (std::abs(bulge) < 1e-10) {
        pts.push_back({x2, y2});
        return;
    }
    double dx = x2 - x1, dy = y2 - y1;
    double d = std::sqrt(dx*dx + dy*dy);
    if (d < 1e-12) { pts.push_back({x2, y2}); return; }

    double theta = 4.0 * std::atan(std::abs(bulge)); // included arc angle
    double r = d / (2.0 * std::sin(theta / 2.0));    // radius

    // Center: perpendicular from chord midpoint
    double mx = (x1 + x2) / 2.0, my = (y1 + y2) / 2.0;
    double perpX = -dy / d, perpY = dx / d;
    double h = std::sqrt(std::max(0.0, r*r - (d/2.0)*(d/2.0)));
    double sign = (bulge > 0) ? 1.0 : -1.0;
    double cx = mx + sign * h * perpX;
    double cy = my + sign * h * perpY;

    double startA = std::atan2(y1 - cy, x1 - cx);
    double endA   = std::atan2(y2 - cy, x2 - cx);
    if (bulge > 0) { while (endA < startA) endA += 2.0*M_PI; }
    else           { while (endA > startA) endA -= 2.0*M_PI; }

    int segs = std::max(4, static_cast<int>(std::abs(theta) / (M_PI / 16)));
    for (int s = 1; s <= segs; ++s) {
        double a = startA + (endA - startA) * s / segs;
        pts.push_back({cx + r * std::cos(a), cy + r * std::sin(a)});
    }
}

// Strip DXF MTEXT formatting codes: {braces}, \H0.7x; \S+1^0; etc.
// Also handles \\ \{ \} escape sequences.
static std::string stripDxfFormatting(const std::string& s) {
    std::string out;
    out.reserve(s.size());
    int depth = 0;
    for (size_t i = 0; i < s.size(); ++i) {
        char c = s[i];
        if (c == '{') { ++depth; continue; }
        if (c == '}') { if (depth > 0) --depth; continue; }
        if (c == '\\' && i + 1 < s.size()) {
            char n = s[i + 1];
            // Format codes that take arguments ending with ';'
            if (n == 'H' || n == 'S' || n == 'A' || n == 'C' || n == 'P' ||
                n == 'W' || n == 'T' || n == 'Q' || n == 'f') {
                while (i < s.size() && s[i] != ';') ++i;
                continue;
            }
            // Escape sequences
            if (n == '\\') { if (depth == 0) out += '\\'; ++i; continue; }
            if (n == '{' || n == '}') { if (depth == 0) out += n; ++i; continue; }
            if (n == 'n' || n == 'N') { if (depth == 0) out += '\n'; ++i; continue; }
        }
        if (depth == 0) out += c;
    }
    return out;
}

void CadgfDrwAdapter::addLType(const DRW_LType& data) {
    // Normalise name to uppercase for case-insensitive lookup
    std::string key = data.name;
    for (char& c : key) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
    if (!data.path.empty())
        m_linetypes[key] = data.path;
}

std::string CadgfDrwAdapter::resolveLinetype(const std::string& entLt,
                                              const std::string& layerName) const {
    // Explicit entity-level linetype takes priority
    std::string lt = entLt;
    if (lt.empty() || lt == "BYLAYER" || lt == "ByLayer") {
        auto it = m_layerLineType.find(layerName);
        if (it != m_layerLineType.end()) lt = it->second;
    }
    // Normalise
    for (char& c : lt) c = static_cast<char>(std::toupper(static_cast<unsigned char>(c)));
    if (lt.empty() || lt == "CONTINUOUS" || lt == "BYBLOCK" || lt == "BYLAYER")
        return "";
    return lt;
}

void CadgfDrwAdapter::applyLinetype(cadgf_entity_id eid,
                                     const std::string& entLt,
                                     const std::string& layerName) {
    if (eid == 0) return;
    std::string lt = resolveLinetype(entLt, layerName);
    if (!lt.empty())
        cadgf_document_set_entity_line_type(m_doc, eid, lt.c_str());
}

int CadgfDrwAdapter::resolveLayer(const std::string& name) {
    if (name.empty()) return 0;
    auto it = m_layerMap.find(name);
    if (it != m_layerMap.end()) return it->second;
    int id = 0;
    cadgf_document_add_layer(m_doc, name.c_str(), 0xFFFFFF, &id);
    m_layerMap[name] = id;
    ++m_layerCount;
    return id;
}

std::pair<double,double> CadgfDrwAdapter::transformPoint(
    double x, double y, double insX, double insY,
    double xscale, double yscale, double angle) const {
    // Scale
    double sx = x * xscale;
    double sy = y * yscale;
    // Rotate
    double cosA = std::cos(angle), sinA = std::sin(angle);
    double rx = sx * cosA - sy * sinA;
    double ry = sx * sinA + sy * cosA;
    // Translate
    return {rx + insX, ry + insY};
}

void CadgfDrwAdapter::addPolylineToDoc(const std::vector<std::pair<double,double>>& pts,
                                        int lid, uint32_t color,
                                        const std::string& linetype, const std::string& layerName,
                                        double lweightMm) {
    if (pts.empty()) return;
    std::vector<cadgf_vec2> vecs;
    vecs.reserve(pts.size());
    for (const auto& [x, y] : pts) vecs.push_back({x, y});
    cadgf_entity_id eid = cadgf_document_add_polyline_ex(m_doc, vecs.data(), static_cast<int>(vecs.size()), "", lid);
    if (eid != 0) {
        // Store resolved RGB color; treat BYBLOCK sentinel same as BYLAYER (0) at top level
        if (color != 0 && color != BYBLOCK_COLOR) cadgf_document_set_entity_color(m_doc, eid, color);
        applyLinetype(eid, linetype, layerName);
        // Inherit layer line weight if entity doesn't specify one
        double eff_lw = lweightMm;
        if (eff_lw <= 0.0 && !layerName.empty()) {
            auto it = m_layerLineWeight.find(layerName);
            if (it != m_layerLineWeight.end()) eff_lw = it->second;
        }
        if (eff_lw > 0.0) cadgf_document_set_entity_line_weight(m_doc, eid, eff_lw);
    }
    ++m_entityCount;
}

void CadgfDrwAdapter::expandBlock(const std::string& blockName,
    double insX, double insY, double xscale, double yscale, double angle, int lid,
    uint32_t insColor) {
    auto it = m_blocks.find(blockName);
    if (it == m_blocks.end()) return;

    for (const auto& ent : it->second) {
        int elid = resolveLayer(ent.layerName.empty() ? "" : ent.layerName);
        if (elid == 0) elid = lid;

        // Resolve BYBLOCK color: use INSERT's color; fallback to BYLAYER (0)
        uint32_t effectiveColor = ent.color;
        if (effectiveColor == BYBLOCK_COLOR)
            effectiveColor = (insColor != BYBLOCK_COLOR) ? insColor : 0;

        switch (ent.type) {
        case BlockEntity::Line:
        case BlockEntity::LWPolyline: {
            std::vector<std::pair<double,double>> transformed;
            transformed.reserve(ent.pts.size());
            for (const auto& [px, py] : ent.pts)
                transformed.push_back(transformPoint(px, py, insX, insY, xscale, yscale, angle));
            addPolylineToDoc(transformed, elid, effectiveColor, ent.linetype, ent.layerName);
            break;
        }
        case BlockEntity::Circle: {
            std::vector<std::pair<double,double>> circ;
            double r = ent.radius * std::abs(xscale);
            auto [cx, cy] = transformPoint(ent.cx, ent.cy, insX, insY, xscale, yscale, angle);
            for (int s = 0; s <= 64; ++s) {
                double a = 2.0 * M_PI * s / 64;
                circ.push_back({cx + r * std::cos(a), cy + r * std::sin(a)});
            }
            addPolylineToDoc(circ, elid, effectiveColor, ent.linetype, ent.layerName);
            break;
        }
        case BlockEntity::Arc: {
            std::vector<std::pair<double,double>> arc;
            double r = ent.radius * std::abs(xscale);
            auto [cx, cy] = transformPoint(ent.cx, ent.cy, insX, insY, xscale, yscale, angle);
            double sa = ent.startAngle + angle, ea = ent.endAngle + angle;
            int segs = 32;
            for (int s = 0; s <= segs; ++s) {
                double a = sa + (ea - sa) * s / segs;
                arc.push_back({cx + r * std::cos(a), cy + r * std::sin(a)});
            }
            addPolylineToDoc(arc, elid, effectiveColor, ent.linetype, ent.layerName);
            break;
        }
        case BlockEntity::Point: {
            if (!ent.pts.empty()) {
                auto [px, py] = transformPoint(ent.pts[0].first, ent.pts[0].second,
                                               insX, insY, xscale, yscale, angle);
                cadgf_point pt;
                pt.p = {px, py};
                cadgf_document_add_point(m_doc, &pt, "", elid);
                ++m_entityCount;
            }
            break;
        }
        case BlockEntity::Text: {
            if (!ent.pts.empty()) {
                auto [px, py] = transformPoint(ent.pts[0].first, ent.pts[0].second,
                                               insX, insY, xscale, yscale, angle);
                cadgf_vec2 pos = {px, py};
                cadgf_document_add_text(m_doc, &pos, ent.height * std::abs(yscale),
                    ent.rotation + angle, ent.text.c_str(), "", elid);
                ++m_entityCount;
            }
            break;
        }
        case BlockEntity::Ellipse: {
            auto [cx, cy] = transformPoint(ent.cx, ent.cy, insX, insY, xscale, yscale, angle);
            cadgf_ellipse ell;
            ell.center = {cx, cy};
            ell.rx = ent.rx * std::abs(xscale);
            ell.ry = ent.ry * std::abs(yscale);
            ell.rotation = ent.ellRot + angle;
            ell.start_angle = ent.ellStart;
            ell.end_angle = ent.ellEnd;
            cadgf_document_add_ellipse(m_doc, &ell, "", elid);
            ++m_entityCount;
            break;
        }
        case BlockEntity::Insert: {
            // Recursive block expansion: compose transforms
            // Inner transform: ent.insX/Y, ent.xscale/yscale, ent.insAngle
            // Outer transform: insX/Y, xscale/yscale, angle
            // Combined: first apply inner, then outer
            double cosO = std::cos(angle), sinO = std::sin(angle);
            double combinedX = insX + (ent.insX * xscale * cosO - ent.insY * yscale * sinO);
            double combinedY = insY + (ent.insX * xscale * sinO + ent.insY * yscale * cosO);
            double combinedXS = xscale * ent.xscale;
            double combinedYS = yscale * ent.yscale;
            double combinedAngle = angle + ent.insAngle;
            // Propagate insert color: nested BYBLOCK uses the closest non-BYBLOCK color
            uint32_t nestedInsColor = (ent.color == BYBLOCK_COLOR) ? insColor : ent.color;
            expandBlock(ent.blockName, combinedX, combinedY,
                        combinedXS, combinedYS, combinedAngle, elid, nestedInsColor);
            break;
        }
        }
    }
}

// ─── Block handling ───

void CadgfDrwAdapter::addBlock(const DRW_Block& data) {
    m_inBlock = true;
    m_currentBlockName = data.name;
    m_blocks[m_currentBlockName].clear(); // reset if redefined
}

void CadgfDrwAdapter::endBlock() {
    m_inBlock = false;
    m_currentBlockName.clear();
}

// ─── Table entries ───

void CadgfDrwAdapter::addHeader(const DRW_Header* data) {
    if (!data) return;
    // Read dimension and linetype scaling variables from DXF header
    auto readDouble = [&](const char* var, double& out) {
        auto it = data->vars.find(var);
        if (it != data->vars.end() && it->second->type() == DRW_Variant::DOUBLE && it->second->content.d != 0.0)
            out = it->second->content.d;
    };
    auto readInt = [&](const char* var, int& out) {
        auto it = data->vars.find(var);
        if (it != data->vars.end() && it->second->type() == DRW_Variant::INTEGER)
            out = it->second->content.i;
    };
    double dimasz = 0.0, dimscale = 0.0, dimtxt = 0.0, ltscale = 0.0;
    readDouble("$DIMASZ",   dimasz);
    readDouble("$DIMSCALE", dimscale);
    readDouble("$DIMTXT",   dimtxt);
    readDouble("$LTSCALE",  ltscale);
    double dimexo = 0.0, dimexe = 0.0, dimlfac = 0.0;
    readDouble("$DIMEXO",   dimexo);
    readDouble("$DIMEXE",   dimexe);
    readDouble("$DIMLFAC",  dimlfac);
    int dimdec = 0;
    readInt("$DIMDEC",  dimdec);
    if (dimscale <= 0.0) dimscale = 1.0;
    if (dimasz   > 0.0) m_dimArrowSize  = dimasz  * dimscale;
    if (dimtxt   > 0.0) m_dimTextHeight = dimtxt  * dimscale;
    if (dimexo   > 0.0) m_dimExo        = dimexo  * dimscale;
    if (dimexe   > 0.0) m_dimExe        = dimexe  * dimscale;
    if (dimlfac  > 0.0) m_dimLFac       = dimlfac;
    if (dimdec   > 0)   m_dimDecPrecision = std::min(dimdec, 6);
    if (ltscale  > 0.0) m_ltScale       = ltscale;
}

void CadgfDrwAdapter::addDimStyle(const DRW_Dimstyle& data) {
    // Use the Standard (default) dim style to set arrow/text sizes, or capture
    // the first dim style encountered as a fallback.
    bool isStandard = (data.name == "Standard" || data.name == "STANDARD"
                       || data.name == "ISO-25" || data.name == "iso-25");
    // Only override if this is the standard style, or if we haven't set a value yet
    // (m_dimArrowSize default 3.5 means "not set from header").
    double sc = std::max(0.01, data.dimscale);
    double eff_arrow = data.dimasz  * sc;
    double eff_text  = data.dimtxt  * sc;
    double eff_exo   = data.dimexo  * sc;
    double eff_exe   = data.dimexe  * sc;
    if (isStandard || m_dimArrowSize == 3.5) {
        if (eff_arrow > 0.0) m_dimArrowSize   = eff_arrow;
        if (eff_text  > 0.0) m_dimTextHeight  = eff_text;
        if (eff_exo   > 0.0) m_dimExo         = eff_exo;
        if (eff_exe   > 0.0) m_dimExe         = eff_exe;
        if (data.dimlfac > 0.0) m_dimLFac     = data.dimlfac;
        if (data.dimdec  > 0)   m_dimDecPrecision = std::min(data.dimdec, 6);
    }
}

void CadgfDrwAdapter::addLayer(const DRW_Layer& data) {
    // Negative color means layer is off; bit 0 or 1 of flags means frozen
    bool isOff = (data.color < 0);
    bool isFrozen = (data.flags & 0x01) || (data.flags & 0x02);
    if (isOff || isFrozen)
        m_frozenLayers.insert(data.name);

    uint32_t color = 0xDCDCE6;
    int absColor = std::abs(data.color);
    if (absColor >= 1 && absColor <= 255)
        color = aci_to_rgb(absColor);
    int id = 0;
    cadgf_document_add_layer(m_doc, data.name.c_str(), color, &id);
    m_layerMap[data.name] = id;
    ++m_layerCount;
    // Store linetype association for later entity resolution
    if (!data.lineType.empty() && data.lineType != "Continuous")
        m_layerLineType[data.name] = data.lineType;
    // Store layer line weight
    double lw = drw_lweight_mm(data.lWeight);
    if (lw > 0.0) m_layerLineWeight[data.name] = lw;
}

// ─── Entity callbacks ───
// If m_inBlock, store in block definition. Otherwise add to document directly.

void CadgfDrwAdapter::addPoint(const DRW_Point& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Point;
        be.pts.push_back({data.basePoint.x, data.basePoint.y});
        be.layerName = data.layer; be.color = drw_entity_color(data);
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    cadgf_point pt;
    pt.p.x = data.basePoint.x;
    pt.p.y = data.basePoint.y;
    cadgf_document_add_point(m_doc, &pt, "", resolveLayer(data.layer));
    ++m_entityCount;
}

void CadgfDrwAdapter::addLine(const DRW_Line& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    std::vector<std::pair<double,double>> pts = {
        {data.basePoint.x, data.basePoint.y},
        {data.secPoint.x, data.secPoint.y}
    };
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Line; be.pts = pts;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        be.linetype = data.lineType;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data), data.lineType, data.layer, drw_lweight_mm(data.lWeight));
}

void CadgfDrwAdapter::addArc(const DRW_Arc& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Arc;
        be.cx = data.basePoint.x; be.cy = data.basePoint.y;
        be.radius = data.radious;
        be.startAngle = data.staangle; be.endAngle = data.endangle;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        be.linetype = data.lineType;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    // Convert arc to polyline for canvas rendering
    std::vector<std::pair<double,double>> pts;
    double sa = data.staangle, ea = data.endangle;
    if (ea < sa) ea += 2.0 * M_PI;
    int segs = std::max(8, static_cast<int>((ea - sa) / (M_PI / 32)));
    for (int s = 0; s <= segs; ++s) {
        double a = sa + (ea - sa) * s / segs;
        pts.push_back({data.basePoint.x + data.radious * std::cos(a),
                        data.basePoint.y + data.radious * std::sin(a)});
    }
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data), data.lineType, data.layer, drw_lweight_mm(data.lWeight));
}

void CadgfDrwAdapter::addCircle(const DRW_Circle& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Circle;
        be.cx = data.basePoint.x; be.cy = data.basePoint.y;
        be.radius = data.radious;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        be.linetype = data.lineType;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    // Convert circle to polyline for canvas rendering
    std::vector<std::pair<double,double>> pts;
    for (int s = 0; s <= 64; ++s) {
        double a = 2.0 * M_PI * s / 64;
        pts.push_back({data.basePoint.x + data.radious * std::cos(a),
                        data.basePoint.y + data.radious * std::sin(a)});
    }
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data), data.lineType, data.layer, drw_lweight_mm(data.lWeight));
}

void CadgfDrwAdapter::addEllipse(const DRW_Ellipse& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    double mx = data.secPoint.x, my = data.secPoint.y;
    double rx = std::sqrt(mx*mx + my*my);
    double ry = rx * data.ratio;
    double rot = std::atan2(my, mx);
    double sa = data.staparam, ea = data.endparam;
    if (std::abs(ea - sa) < 1e-10) { sa = 0; ea = 2.0 * M_PI; } // full ellipse

    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Ellipse;
        be.cx = data.basePoint.x; be.cy = data.basePoint.y;
        be.rx = rx; be.ry = ry; be.ellRot = rot;
        be.ellStart = sa; be.ellEnd = ea;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        be.linetype = data.lineType;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    // Convert ellipse to polyline for canvas rendering
    std::vector<std::pair<double,double>> pts;
    int segs = 64;
    double cosR = std::cos(rot), sinR = std::sin(rot);
    for (int s = 0; s <= segs; ++s) {
        double t = sa + (ea - sa) * s / segs;
        double lx = rx * std::cos(t);
        double ly = ry * std::sin(t);
        double px = data.basePoint.x + lx * cosR - ly * sinR;
        double py = data.basePoint.y + lx * sinR + ly * cosR;
        pts.push_back({px, py});
    }
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data), data.lineType, data.layer, drw_lweight_mm(data.lWeight));
}

void CadgfDrwAdapter::addLWPolyline(const DRW_LWPolyline& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    // Build point list expanding arc segments from bulge values
    auto buildPts = [](const DRW_LWPolyline& d) {
        std::vector<std::pair<double,double>> pts;
        if (d.vertlist.empty()) return pts;
        pts.push_back({d.vertlist[0]->x, d.vertlist[0]->y});
        for (size_t i = 0; i + 1 < d.vertlist.size(); ++i) {
            auto* v0 = d.vertlist[i];
            auto* v1 = d.vertlist[i + 1];
            appendBulgeSegment(pts, v0->x, v0->y, v1->x, v1->y, v0->bulge);
        }
        // Close if flagged
        if ((d.flags & 1) && d.vertlist.size() > 1) {
            auto* vl = d.vertlist.back();
            auto* vf = d.vertlist.front();
            appendBulgeSegment(pts, vl->x, vl->y, vf->x, vf->y, vl->bulge);
        }
        return pts;
    };

    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::LWPolyline;
        be.pts = buildPts(data);
        be.layerName = data.layer; be.color = drw_entity_color(data);
        be.linetype = data.lineType;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    auto pts = buildPts(data);
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data), data.lineType, data.layer, drw_lweight_mm(data.lWeight));
}

void CadgfDrwAdapter::addText(const DRW_Text& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    std::string txt = stripDxfFormatting(data.text);
    if (txt.empty()) return;
    // Use secPoint (alignment point) when non-default alignment is specified
    bool useSecPoint = (data.alignH != DRW_Text::HLeft || data.alignV != DRW_Text::VBaseLine)
                       && (data.secPoint.x != 0.0 || data.secPoint.y != 0.0);
    double px = useSecPoint ? data.secPoint.x : data.basePoint.x;
    double py = useSecPoint ? data.secPoint.y : data.basePoint.y;
    // DRW_Text::angle is in degrees; cadgf_document_add_text expects radians
    double rotRad = data.angle * M_PI / 180.0;
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Text;
        be.pts.push_back({px, py});
        be.height = data.height; be.rotation = rotRad;
        be.text = txt;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    cadgf_vec2 pos = {px, py};
    cadgf_document_add_text(m_doc, &pos, data.height, rotRad, txt.c_str(),
                            "", resolveLayer(data.layer));
    ++m_entityCount;
}

void CadgfDrwAdapter::addMText(const DRW_MText& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    std::string txt = stripDxfFormatting(data.text);
    if (txt.empty()) return;
    // DRW_MText::angle is in degrees; cadgf_document_add_text expects radians
    double rotRad = data.angle * M_PI / 180.0;
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Text;
        be.pts.push_back({data.basePoint.x, data.basePoint.y});
        be.height = data.height; be.rotation = rotRad;
        be.text = txt;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    cadgf_vec2 pos = {data.basePoint.x, data.basePoint.y};
    cadgf_document_add_text(m_doc, &pos, data.height, rotRad, txt.c_str(),
                            "", resolveLayer(data.layer));
    ++m_entityCount;
}

// ─── SOLID/TRACE: 4-point filled shape → polyline ───

void CadgfDrwAdapter::addSolid(const DRW_Solid& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    // DRW_Solid inherits DRW_Trace: basePoint, secPoint, thirdPoint, fourPoint
    std::vector<std::pair<double,double>> pts = {
        {data.basePoint.x, data.basePoint.y},
        {data.secPoint.x, data.secPoint.y},
        {data.thirdPoint.x, data.thirdPoint.y},
        {data.fourPoint.x, data.fourPoint.y},
        {data.basePoint.x, data.basePoint.y} // close
    };
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::LWPolyline; be.pts = pts;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data));
}

void CadgfDrwAdapter::addTrace(const DRW_Trace& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    std::vector<std::pair<double,double>> pts = {
        {data.basePoint.x, data.basePoint.y},
        {data.secPoint.x, data.secPoint.y},
        {data.thirdPoint.x, data.thirdPoint.y},
        {data.fourPoint.x, data.fourPoint.y},
        {data.basePoint.x, data.basePoint.y}
    };
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::LWPolyline; be.pts = pts;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data));
}

// ─── POLYLINE (3D/heavyweight) ───

void CadgfDrwAdapter::addPolyline(const DRW_Polyline& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    if (data.vertlist.empty()) return;

    // Build point list expanding arc bulge values (same as LWPolyline)
    std::vector<std::pair<double,double>> pts;
    pts.push_back({data.vertlist[0]->basePoint.x, data.vertlist[0]->basePoint.y});
    for (size_t i = 0; i + 1 < data.vertlist.size(); ++i) {
        auto* v0 = data.vertlist[i];
        auto* v1 = data.vertlist[i + 1];
        appendBulgeSegment(pts, v0->basePoint.x, v0->basePoint.y,
                           v1->basePoint.x, v1->basePoint.y, v0->bulge);
    }
    // Close if flagged (bit 0 of flags)
    if ((data.flags & 1) && data.vertlist.size() > 1) {
        auto* vl = data.vertlist.back();
        auto* vf = data.vertlist.front();
        appendBulgeSegment(pts, vl->basePoint.x, vl->basePoint.y,
                           vf->basePoint.x, vf->basePoint.y, vl->bulge);
    }
    if (pts.size() < 2) return;

    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::LWPolyline; be.pts = pts;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        be.linetype = data.lineType;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data),
                     data.lineType, data.layer, drw_lweight_mm(data.lWeight));
}

// ─── SPLINE: De Boor B-spline evaluation ───

// Evaluate a B-spline at parameter t using De Boor's algorithm (2D, XY only).
// knots: full knot vector; ctrl: control points; degree: spline degree.
// Returns {x, y}.
static std::pair<double,double> deBoor(
    const std::vector<double>& knots,
    const std::vector<std::pair<double,double>>& ctrl,
    int degree, double t)
{
    const int n = static_cast<int>(ctrl.size()) - 1; // last control index
    // Find knot span k such that knots[k] <= t < knots[k+1]
    int k = degree;
    for (int i = degree; i <= n; ++i) {
        if (t < knots[i + 1]) { k = i; break; }
    }
    // Clamp t to avoid edge effects at the last knot
    if (t >= knots[n + 1]) k = n;

    // Copy relevant control points into d[]
    std::vector<std::pair<double,double>> d(degree + 1);
    for (int j = 0; j <= degree; ++j)
        d[j] = ctrl[std::min(k - degree + j, n)];

    // De Boor triangular computation
    for (int r = 1; r <= degree; ++r) {
        for (int j = degree; j >= r; --j) {
            int idx = k - degree + j;
            double denom = knots[idx + degree - r + 1] - knots[idx];
            double alpha = (denom < 1e-14) ? 0.0 : (t - knots[idx]) / denom;
            d[j].first  = (1.0 - alpha) * d[j-1].first  + alpha * d[j].first;
            d[j].second = (1.0 - alpha) * d[j-1].second + alpha * d[j].second;
        }
    }
    return d[degree];
}

void CadgfDrwAdapter::addSpline(const DRW_Spline* data) {
    if (!data) return;
    if (!m_inBlock && shouldSkipEntity(*data)) return;
    std::vector<std::pair<double,double>> pts;

    // Try De Boor B-spline evaluation using control points + knots
    int degree = data->degree;
    bool canEval = (degree >= 1
        && !data->controllist.empty()
        && static_cast<int>(data->knotslist.size()) >= static_cast<int>(data->controllist.size()) + degree + 1);

    if (canEval) {
        // Build control point array
        std::vector<std::pair<double,double>> ctrl;
        ctrl.reserve(data->controllist.size());
        for (const auto* p : data->controllist)
            ctrl.push_back({p->x, p->y});

        const auto& knots = data->knotslist;
        double tStart = knots[degree];
        double tEnd   = knots[static_cast<int>(ctrl.size())]; // knots[n+1] where n=ctrl.size()-1

        // Adaptive segment count: more segments for longer/curvier splines
        int nSeg = std::max(32, static_cast<int>(ctrl.size()) * 8);
        for (int i = 0; i <= nSeg; ++i) {
            double t = tStart + (tEnd - tStart) * i / nSeg;
            pts.push_back(deBoor(knots, ctrl, degree, t));
        }
    } else if (!data->fitlist.empty()) {
        // Fallback: use fit points as polyline approximation
        for (const auto* p : data->fitlist)
            pts.push_back({p->x, p->y});
    } else if (!data->controllist.empty()) {
        // Last resort: straight lines through control points
        for (const auto* p : data->controllist)
            pts.push_back({p->x, p->y});
    }

    if (pts.size() < 2) return;
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::LWPolyline; be.pts = pts;
        be.layerName = data->layer; be.color = drw_entity_color(*data);
        be.linetype = data->lineType;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    addPolylineToDoc(pts, resolveLayer(data->layer), drw_entity_color(*data),
                     data->lineType, data->layer, drw_lweight_mm(data->lWeight));
}

// ─── LEADER: vertex list → polyline ───

void CadgfDrwAdapter::addLeader(const DRW_Leader* data) {
    if (!data) return;
    if (!m_inBlock && shouldSkipEntity(*data)) return;
    std::vector<std::pair<double,double>> pts;
    for (const auto* v : data->vertexlist)
        pts.push_back({v->x, v->y});
    if (pts.size() < 2) return;
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::LWPolyline; be.pts = pts;
        be.layerName = data->layer;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    addPolylineToDoc(pts, resolveLayer(data->layer), drw_entity_color(*data),
                     data->lineType, data->layer, drw_lweight_mm(data->lWeight));
}

// ─── HATCH: extract boundary loops as polylines ───

void CadgfDrwAdapter::addHatch(const DRW_Hatch* data) {
    if (!data) return;
    if (!m_inBlock && shouldSkipEntity(*data)) return;
    int lid = resolveLayer(data->layer);
    for (const auto* loop : data->looplist) {
        // Each loop contains edge entities (lines, arcs, etc.)
        // Extract as connected polyline
        std::vector<std::pair<double,double>> pts;
        for (const auto* obj : loop->objlist) {
            if (obj->eType == DRW::LINE) {
                auto* ln = static_cast<const DRW_Line*>(obj);
                if (pts.empty()) pts.push_back({ln->basePoint.x, ln->basePoint.y});
                pts.push_back({ln->secPoint.x, ln->secPoint.y});
            } else if (obj->eType == DRW::ARC) {
                auto* arc = static_cast<const DRW_Arc*>(obj);
                double sa = arc->staangle, ea = arc->endangle;
                int segs = 16;
                for (int s = 0; s <= segs; ++s) {
                    double a = sa + (ea - sa) * s / segs;
                    pts.push_back({arc->basePoint.x + arc->radious * std::cos(a),
                                   arc->basePoint.y + arc->radious * std::sin(a)});
                }
            }
        }
        if (pts.size() >= 2) {
            if (m_inBlock) {
                BlockEntity be; be.type = BlockEntity::LWPolyline; be.pts = pts;
                be.layerName = data->layer;
                m_blocks[m_currentBlockName].push_back(be);
            } else {
                addPolylineToDoc(pts, lid);
            }
        }
    }

    // Pattern hatch fill: skip for SOLID (boundary outline is enough),
    // generate parallel lines for ANSI31/_U style patterns.
    if (!data->looplist.empty() && !m_inBlock && data->solid == 0) {
        // Compute boundary bbox
        double hMinX=1e18, hMinY=1e18, hMaxX=-1e18, hMaxY=-1e18;
        for (const auto* loop : data->looplist) {
            for (const auto* obj : loop->objlist) {
                if (obj->eType == DRW::LINE) {
                    auto* ln = static_cast<const DRW_Line*>(obj);
                    auto chk = [&](double x, double y) {
                        if(x<hMinX)hMinX=x; if(y<hMinY)hMinY=y;
                        if(x>hMaxX)hMaxX=x; if(y>hMaxY)hMaxY=y;
                    };
                    chk(ln->basePoint.x, ln->basePoint.y);
                    chk(ln->secPoint.x, ln->secPoint.y);
                } else if (obj->eType == DRW::ARC) {
                    auto* arc = static_cast<const DRW_Arc*>(obj);
                    // Use center ± radius as a loose bbox contribution
                    hMinX=std::min(hMinX,arc->basePoint.x-arc->radious);
                    hMinY=std::min(hMinY,arc->basePoint.y-arc->radious);
                    hMaxX=std::max(hMaxX,arc->basePoint.x+arc->radious);
                    hMaxY=std::max(hMaxY,arc->basePoint.y+arc->radious);
                }
            }
        }
        double hW = hMaxX - hMinX, hH = hMaxY - hMinY;
        if (hW > 0.1 && hH > 0.1) {
            // Spacing from DXF scale (1 DXF unit ≈ 3.0 drawing units per ANSI31 line)
            double baseSpacing = (data->scale > 0.01) ? data->scale * 3.0 : 5.0;
            double diag = hW + hH;
            // Cap at 25 lines maximum per hatch entity
            double spacing = std::max(baseSpacing, diag / 25.0);
            // Use the hatch angle (degrees → radians)
            double ang = data->angle * M_PI / 180.0;
            double cosA = std::cos(ang), sinA = std::sin(ang);
            uint32_t hcol = drw_entity_color(*data);
            // Generate lines perpendicular to hatch angle direction
            // Project bbox corners onto the perpendicular axis to find sweep range
            double corners[4][2] = {
                {hMinX, hMinY}, {hMaxX, hMinY}, {hMaxX, hMaxY}, {hMinX, hMaxY}
            };
            double pmin = 1e18, pmax = -1e18;
            for (auto& c : corners) {
                double p = -c[0] * sinA + c[1] * cosA; // perp projection
                pmin = std::min(pmin, p); pmax = std::max(pmax, p);
            }
            for (double p = pmin; p <= pmax; p += spacing) {
                // Line through perp offset p in direction (cosA, sinA)
                // Parametric: point = t*(cosA,sinA) + p*(-sinA,cosA)
                // Clip to bbox by finding t range
                double ox = p * (-sinA), oy = p * cosA;
                // Use large t range and clip
                double t1 = -diag*2, t2 = diag*2;
                if (std::abs(cosA) > 1e-6) {
                    double ta = (hMinX - ox) / cosA, tb = (hMaxX - ox) / cosA;
                    t1 = std::max(t1, std::min(ta,tb));
                    t2 = std::min(t2, std::max(ta,tb));
                }
                if (std::abs(sinA) > 1e-6) {
                    double ta = (hMinY - oy) / sinA, tb = (hMaxY - oy) / sinA;
                    t1 = std::max(t1, std::min(ta,tb));
                    t2 = std::min(t2, std::max(ta,tb));
                }
                if (t2 > t1 + 0.01) {
                    double x1 = ox + t1*cosA, y1 = oy + t1*sinA;
                    double x2 = ox + t2*cosA, y2 = oy + t2*sinA;
                    addPolylineToDoc({{x1,y1},{x2,y2}}, lid, hcol);
                }
            }
        }
    }
}

// ─── DIMENSIONS: render as lines + text ───

// Append a small open arrowhead at point (px,py) pointing FROM (fromX,fromY).
// arrowLen: arrow length in drawing units (default = 3.5 for AutoCAD default style).
static void addArrowhead(cadgf_document* doc,
                          double px, double py, double fromX, double fromY,
                          int lid, uint32_t col, double arrowLen = 3.5) {
    double dx = px - fromX, dy = py - fromY;
    double len = std::sqrt(dx*dx + dy*dy);
    if (len < 1e-10) return;
    double nx = dx / len, ny = dy / len;      // unit along dim line
    double px2 = -ny, py2 = nx;               // perpendicular
    double arrowWidth = arrowLen * 0.25;       // ~1/4 of arrow length
    // Two lines forming an open arrowhead
    double ax = px - nx * arrowLen, ay = py - ny * arrowLen;
    // wing 1
    std::vector<std::pair<double,double>> w1 = {{px,py},{ax+px2*arrowWidth,ay+py2*arrowWidth}};
    // wing 2
    std::vector<std::pair<double,double>> w2 = {{px,py},{ax-px2*arrowWidth,ay-py2*arrowWidth}};

    auto addArrow = [&](const std::vector<std::pair<double,double>>& pts) {
        std::vector<cadgf_vec2> v; v.reserve(pts.size());
        for (auto& [x,y] : pts) v.push_back({x,y});
        cadgf_entity_id eid = cadgf_document_add_polyline_ex(doc, v.data(), (int)v.size(), "", lid);
        if (eid && col) cadgf_document_set_entity_color(doc, eid, col);
    };
    addArrow(w1); addArrow(w2);
}

// Helper: add dimension text at textPoint.
// prefix: optional prefix ("R" for radial, "Ø" for diametric)
// textHeight: text height in drawing units
// lfac: dimension length factor (multiplied into the measured distance)
// decPrec: decimal digits for number formatting
void addDimText(cadgf_document* doc, const DRW_Dimension* dim, int lid,
                double def1x, double def1y, double def2x, double def2y,
                const char* prefix = "", double textHeight = 3.5,
                double lfac = 1.0, int decPrec = 2) {
    if (!dim) return;
    std::string txt = stripDxfFormatting(dim->getText());

    // Compute the measurement value for <> substitution or empty text
    double dx = def2x - def1x, dy = def2y - def1y;
    double dist = std::sqrt(dx*dx + dy*dy) * lfac;
    // Format with requested decimal precision
    char fmt[16]; snprintf(fmt, sizeof(fmt), "%%s%%.*f");
    char buf[64];  snprintf(buf,  sizeof(buf),  fmt, prefix, decPrec, dist);

    if (txt.empty() || txt == "<>") {
        txt = buf;
    } else {
        // Replace <> placeholder with the computed measurement value
        char tmpbuf[64]; snprintf(tmpbuf, sizeof(tmpbuf), fmt, prefix, decPrec, dist);
        size_t pos = txt.find("<>");
        while (pos != std::string::npos) {
            txt.replace(pos, 2, tmpbuf);
            pos = txt.find("<>", pos + strlen(tmpbuf));
        }
    }
    if (txt.empty()) return;

    // Text position: use textPoint if set, otherwise midpoint of def points
    double tx = dim->getTextPoint().x, ty = dim->getTextPoint().y;
    if (std::abs(tx) < 1e-10 && std::abs(ty) < 1e-10) {
        tx = (def1x + def2x) / 2; ty = (def1y + def2y) / 2;
    }
    // DXF code 53 (dim text rotation) is in degrees; convert to radians
    double textRot = dim->getDir() * M_PI / 180.0;
    cadgf_vec2 pos = {tx, ty};
    cadgf_document_add_text(doc, &pos, textHeight, textRot, txt.c_str(), "", lid);
}

// Draw proper aligned dimension: extension lines + offset dimension line
void CadgfDrwAdapter::addDimAlign(const DRW_DimAligned* data) {
    if (!data) return;
    if (!m_inBlock && shouldSkipEntity(*data)) return;
    int lid = resolveLayer(data->layer);
    uint32_t col = drw_entity_color(*data);

    double d1x = data->getDef1Point().x, d1y = data->getDef1Point().y;
    double d2x = data->getDef2Point().x, d2y = data->getDef2Point().y;
    double dpx = data->getDimPoint().x,  dpy = data->getDimPoint().y;

    double dx = d2x - d1x, dy = d2y - d1y;
    double len = std::sqrt(dx*dx + dy*dy);
    if (len < 1e-10) return;
    double nx = dx / len, ny = dy / len; // along dim line

    // Project def1 and def2 onto the dim line (passes through dimPoint, dir n)
    double t1 = (d1x - dpx) * nx + (d1y - dpy) * ny;
    double t2 = (d2x - dpx) * nx + (d2y - dpy) * ny;
    double p1x = dpx + t1 * nx, p1y = dpy + t1 * ny;
    double p2x = dpx + t2 * nx, p2y = dpy + t2 * ny;

    // Build extension lines with gap (DIMEXO) and extension past dim line (DIMEXE)
    auto extLine = [&](double defX, double defY, double dimX, double dimY)
        -> std::pair<std::pair<double,double>, std::pair<double,double>> {
        double ex = dimX - defX, ey = dimY - defY;
        double el = std::sqrt(ex*ex + ey*ey);
        if (el < 1e-10) return {{defX,defY},{dimX,dimY}};
        double ux = ex/el, uy = ey/el;
        return {{defX + ux*m_dimExo, defY + uy*m_dimExo},
                {dimX + ux*m_dimExe, dimY + uy*m_dimExe}};
    };
    auto [e1s, e1e] = extLine(d1x, d1y, p1x, p1y);
    auto [e2s, e2e] = extLine(d2x, d2y, p2x, p2y);

    if (m_inBlock) {
        for (auto& seg : std::vector<std::vector<std::pair<double,double>>>{
                {{p1x,p1y},{p2x,p2y}}, {e1s,e1e}, {e2s,e2e}}) {
            BlockEntity be; be.type = BlockEntity::Line; be.pts = seg;
            be.layerName = data->layer; be.color = col;
            m_blocks[m_currentBlockName].push_back(be);
        }
    } else {
        addPolylineToDoc({{p1x,p1y},{p2x,p2y}}, lid, col); // dimension line
        addPolylineToDoc({e1s,e1e}, lid, col);              // extension line 1
        addPolylineToDoc({e2s,e2e}, lid, col);              // extension line 2
        addArrowhead(m_doc, p1x, p1y, p2x, p2y, lid, col, m_dimArrowSize);
        addArrowhead(m_doc, p2x, p2y, p1x, p1y, lid, col, m_dimArrowSize);
        addDimText(m_doc, data, lid, d1x, d1y, d2x, d2y, "",
                   m_dimTextHeight, m_dimLFac, m_dimDecPrecision);
    }
}

// Draw proper linear dimension: extension lines + rotated dimension line
void CadgfDrwAdapter::addDimLinear(const DRW_DimLinear* data) {
    if (!data) return;
    if (!m_inBlock && shouldSkipEntity(*data)) return;
    int lid = resolveLayer(data->layer);
    uint32_t col = drw_entity_color(*data);

    double d1x = data->getDef1Point().x, d1y = data->getDef1Point().y;
    double d2x = data->getDef2Point().x, d2y = data->getDef2Point().y;
    double dpx = data->getDimPoint().x,  dpy = data->getDimPoint().y;

    double angle = data->getAngle() * M_PI / 180.0; // measurement direction (degrees)
    double nx = std::cos(angle), ny = std::sin(angle);

    // Project def1/def2 onto dimension line through dimPoint along direction n
    double t1 = (d1x - dpx) * nx + (d1y - dpy) * ny;
    double t2 = (d2x - dpx) * nx + (d2y - dpy) * ny;
    double p1x = dpx + t1 * nx, p1y = dpy + t1 * ny;
    double p2x = dpx + t2 * nx, p2y = dpy + t2 * ny;

    // Extension lines with DIMEXO gap and DIMEXE extension
    auto extLine2 = [&](double defX, double defY, double dimX, double dimY)
        -> std::pair<std::pair<double,double>, std::pair<double,double>> {
        double ex = dimX - defX, ey = dimY - defY;
        double el = std::sqrt(ex*ex + ey*ey);
        if (el < 1e-10) return {{defX,defY},{dimX,dimY}};
        double ux = ex/el, uy = ey/el;
        return {{defX + ux*m_dimExo, defY + uy*m_dimExo},
                {dimX + ux*m_dimExe, dimY + uy*m_dimExe}};
    };
    auto [e1s, e1e] = extLine2(d1x, d1y, p1x, p1y);
    auto [e2s, e2e] = extLine2(d2x, d2y, p2x, p2y);

    if (m_inBlock) {
        for (auto& seg : std::vector<std::vector<std::pair<double,double>>>{
                {{p1x,p1y},{p2x,p2y}}, {e1s,e1e}, {e2s,e2e}}) {
            BlockEntity be; be.type = BlockEntity::Line; be.pts = seg;
            be.layerName = data->layer; be.color = col;
            m_blocks[m_currentBlockName].push_back(be);
        }
    } else {
        addPolylineToDoc({{p1x,p1y},{p2x,p2y}}, lid, col); // dimension line
        addPolylineToDoc({e1s,e1e}, lid, col);              // extension line 1
        addPolylineToDoc({e2s,e2e}, lid, col);              // extension line 2
        addArrowhead(m_doc, p1x, p1y, p2x, p2y, lid, col, m_dimArrowSize);
        addArrowhead(m_doc, p2x, p2y, p1x, p1y, lid, col, m_dimArrowSize);
        addDimText(m_doc, data, lid, p1x, p1y, p2x, p2y, "",
                   m_dimTextHeight, m_dimLFac, m_dimDecPrecision);
    }
}

void CadgfDrwAdapter::addDimRadial(const DRW_DimRadial* data) {
    if (!data) return;
    if (!m_inBlock && shouldSkipEntity(*data)) return;
    int lid = resolveLayer(data->layer);
    uint32_t col = drw_entity_color(*data);
    double cx = data->getCenterPoint().x, cy = data->getCenterPoint().y;
    double dp = data->getDiameterPoint().x, dpy2 = data->getDiameterPoint().y;
    std::vector<std::pair<double,double>> pts = {{cx,cy},{dp,dpy2}};
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Line; be.pts = pts;
        be.layerName = data->layer; be.color = col;
        m_blocks[m_currentBlockName].push_back(be);
    } else {
        addPolylineToDoc(pts, lid, col);
        addArrowhead(m_doc, dp, dpy2, cx, cy, lid, col, m_dimArrowSize); // arrow at circle
        addDimText(m_doc, data, lid, cx, cy, dp, dpy2, "R",
                   m_dimTextHeight, m_dimLFac, m_dimDecPrecision);
    }
}

void CadgfDrwAdapter::addDimDiametric(const DRW_DimDiametric* data) {
    if (!data) return;
    if (!m_inBlock && shouldSkipEntity(*data)) return;
    int lid = resolveLayer(data->layer);
    uint32_t col = drw_entity_color(*data);
    double d1x = data->getDiameter1Point().x, d1y = data->getDiameter1Point().y;
    double d2x = data->getDiameter2Point().x, d2y = data->getDiameter2Point().y;
    std::vector<std::pair<double,double>> pts = {{d1x,d1y},{d2x,d2y}};
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Line; be.pts = pts;
        be.layerName = data->layer; be.color = col;
        m_blocks[m_currentBlockName].push_back(be);
    } else {
        addPolylineToDoc(pts, lid, col);
        addArrowhead(m_doc, d1x, d1y, d2x, d2y, lid, col, m_dimArrowSize);
        addArrowhead(m_doc, d2x, d2y, d1x, d1y, lid, col, m_dimArrowSize);
        addDimText(m_doc, data, lid, d1x, d1y, d2x, d2y, "\xC3\x98", // UTF-8 Ø
                   m_dimTextHeight, m_dimLFac, m_dimDecPrecision);
    }
}

void CadgfDrwAdapter::addDimAngular(const DRW_DimAngular* data) {
    if (!data) return;
    if (!m_inBlock && shouldSkipEntity(*data)) return;
    int lid = resolveLayer(data->layer);
    uint32_t col = drw_entity_color(*data);

    // Points: line1 = (FL1→FL2), line2 = (SL1→SL2=defPoint), arc through dimPoint
    double l1x1 = data->getFirstLine1().x,  l1y1 = data->getFirstLine1().y;
    double l1x2 = data->getFirstLine2().x,  l1y2 = data->getFirstLine2().y;
    double l2x1 = data->getSecondLine1().x, l2y1 = data->getSecondLine1().y;
    double l2x2 = data->getSecondLine2().x, l2y2 = data->getSecondLine2().y;
    double dpx  = data->getDimPoint().x,    dpy  = data->getDimPoint().y;

    // Find vertex = intersection of the two lines (extended as rays)
    // Line1 passes through (l1x2, l1y2) in direction (l1x2-l1x1, l1y2-l1y1)
    // Line2 passes through (l2x2, l2y2) in direction (l2x2-l2x1, l2y2-l2y1)
    double d1x = l1x2 - l1x1, d1y = l1y2 - l1y1;
    double d2x = l2x2 - l2x1, d2y = l2y2 - l2y1;
    double vx = l1x2, vy = l1y2; // fallback: use FL2 as vertex
    double det = d1x * (-d2y) - d1y * (-d2x);
    if (std::abs(det) > 1e-10) {
        double dx12 = l2x2 - l1x2, dy12 = l2y2 - l1y2;
        double t = (dx12 * (-d2y) - dy12 * (-d2x)) / det;
        vx = l1x2 + t * d1x;
        vy = l1y2 + t * d1y;
    }

    // Arc: center at vertex, radius = distance from vertex to dimPoint
    double r = std::sqrt((dpx-vx)*(dpx-vx) + (dpy-vy)*(dpy-vy));
    if (r < 1e-10) r = std::sqrt((l1x2-vx)*(l1x2-vx) + (l1y2-vy)*(l1y2-vy));

    double startA = std::atan2(l1y2 - vy, l1x2 - vx); // angle to FL2 (first arc end)
    double endA   = std::atan2(l2y1 - vy, l2x1 - vx); // angle to SL1 (second arc end)

    // Ensure arc goes the short way (< π)
    while (endA < startA) endA += 2.0 * M_PI;
    if (endA - startA > M_PI) { std::swap(startA, endA); endA += 2.0 * M_PI; }

    // Draw extension lines (from vertex to arc points)
    auto addSeg = [&](double ax, double ay, double bx, double by) {
        if (m_inBlock) {
            BlockEntity be; be.type = BlockEntity::Line;
            be.pts = {{ax,ay},{bx,by}};
            be.layerName = data->layer; be.color = col;
            m_blocks[m_currentBlockName].push_back(be);
        } else {
            addPolylineToDoc({{ax,ay},{bx,by}}, lid, col);
        }
    };
    addSeg(l1x2, l1y2, vx + (l1x2-vx)/std::hypot(l1x2-vx,l1y2-vy)*r,
                        vy + (l1y2-vy)/std::hypot(l1x2-vx,l1y2-vy)*r);
    addSeg(l2x1, l2y1, vx + (l2x1-vx)/std::hypot(l2x1-vx,l2y1-vy)*r,
                        vy + (l2y1-vy)/std::hypot(l2x1-vx,l2y1-vy)*r);

    // Draw the arc
    int segs = std::max(4, static_cast<int>((endA - startA) / (M_PI / 32)));
    std::vector<std::pair<double,double>> arcPts;
    for (int s = 0; s <= segs; ++s) {
        double a = startA + (endA - startA) * s / segs;
        arcPts.push_back({vx + r*std::cos(a), vy + r*std::sin(a)});
    }
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::LWPolyline; be.pts = arcPts;
        be.layerName = data->layer; be.color = col;
        m_blocks[m_currentBlockName].push_back(be);
    } else {
        addPolylineToDoc(arcPts, lid, col);
        // Arrowheads at arc ends
        if (arcPts.size() >= 2) {
            addArrowhead(m_doc, arcPts.front().first, arcPts.front().second,
                         arcPts[1].first, arcPts[1].second, lid, col, m_dimArrowSize);
            addArrowhead(m_doc, arcPts.back().first, arcPts.back().second,
                         arcPts[arcPts.size()-2].first, arcPts[arcPts.size()-2].second,
                         lid, col, m_dimArrowSize);
        }
        // Dimension text at dimPoint
        // Angular dimension value in degrees
        double angDeg = (endA - startA) * 180.0 / M_PI;
        char angBuf[32]; snprintf(angBuf, sizeof(angBuf), "%.*f°", m_dimDecPrecision, angDeg);
        std::string overrideText = stripDxfFormatting(data->getText());
        if (!overrideText.empty() && overrideText != "<>") angBuf[0] = 0; // use DXF text
        double tx = (std::abs(dpx) > 1e-10 || std::abs(dpy) > 1e-10) ? dpx :
                    vx + (endA+startA)/2.0 * 0.0; // fallback to mid-arc
        // Use the actual dim point for text position
        std::string finalText = (angBuf[0] != 0) ? angBuf : overrideText;
        if (!finalText.empty()) {
            cadgf_vec2 tp = {dpx, dpy};
            cadgf_document_add_text(m_doc, &tp, m_dimTextHeight, 0.0,
                                    finalText.c_str(), "", lid);
        }
    }
}

void CadgfDrwAdapter::addDimAngular3P(const DRW_DimAngular3p* data) {
    if (!data) return;
    if (!m_inBlock && shouldSkipEntity(*data)) return;
    int lid = resolveLayer(data->layer);
    uint32_t col = drw_entity_color(*data);
    // Center = getDefPoint, points = getFirstLine, getSecondLine
    double cx = data->getDefPoint().x,  cy = data->getDefPoint().y;
    double p1x = data->getFirstLine().x, p1y = data->getFirstLine().y;
    double p2x = data->getSecondLine().x, p2y = data->getSecondLine().y;
    double r = std::sqrt((p1x-cx)*(p1x-cx) + (p1y-cy)*(p1y-cy));
    double sa = std::atan2(p1y-cy, p1x-cx);
    double ea = std::atan2(p2y-cy, p2x-cx);
    while (ea < sa) ea += 2.0*M_PI;
    if (ea - sa > M_PI) { std::swap(sa,ea); ea += 2.0*M_PI; }
    int segs = std::max(4, (int)((ea-sa)/(M_PI/32)));
    std::vector<std::pair<double,double>> arcPts;
    for (int s = 0; s <= segs; ++s) {
        double a = sa + (ea-sa)*s/segs;
        arcPts.push_back({cx+r*std::cos(a), cy+r*std::sin(a)});
    }
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::LWPolyline; be.pts = arcPts;
        be.layerName = data->layer; be.color = col;
        m_blocks[m_currentBlockName].push_back(be);
    } else {
        addPolylineToDoc(arcPts, lid, col);
    }
}

void CadgfDrwAdapter::addDimOrdinate(const DRW_DimOrdinate* data) {
    if (!data) return;
    if (!m_inBlock && shouldSkipEntity(*data)) return;
    int lid = resolveLayer(data->layer);
    uint32_t col = drw_entity_color(*data);
    // Feature point → leader end point line
    double fx = data->getFirstLine().x,  fy = data->getFirstLine().y;
    double lx = data->getSecondLine().x, ly = data->getSecondLine().y;
    // Origin for computing the ordinate value
    double ox = data->getOriginPoint().x, oy = data->getOriginPoint().y;
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Line;
        be.pts = {{fx,fy},{lx,ly}}; be.layerName = data->layer; be.color = col;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    addPolylineToDoc({{fx,fy},{lx,ly}}, lid, col);
    // Determine X vs Y type from leader direction: horizontal → Y-ordinate, vertical → X-ordinate
    bool isYType = std::abs(lx - fx) > std::abs(ly - fy);
    double measured = (isYType ? (fy - oy) : (fx - ox)) * m_dimLFac;
    char buf[32]; snprintf(buf, sizeof(buf), "%.*f", m_dimDecPrecision, measured);
    cadgf_vec2 tp = {lx, ly};
    cadgf_document_add_text(m_doc, &tp, m_dimTextHeight, 0.0, buf, "", lid);
}

// ─── Expand unreferenced XRef blocks ───

void CadgfDrwAdapter::expandUnreferencedBlocks() {
    for (auto& [name, entities] : m_blocks) {
        if (m_referencedBlocks.count(name)) continue;
        if (name.empty() || name[0] == '*') continue; // skip *Model_Space, *Paper_Space, *D#, *T#, *U#
        if (entities.empty()) continue;
        expandBlock(name, 0, 0, 1, 1, 0, 0);
    }
}

// ─── INSERT: expand block reference ───

void CadgfDrwAdapter::addInsert(const DRW_Insert& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    m_referencedBlocks.insert(data.name);
    if (m_inBlock) {
        // Store nested INSERT in block definition for later recursive expansion
        BlockEntity be; be.type = BlockEntity::Insert;
        be.blockName = data.name;
        be.insX = data.basePoint.x; be.insY = data.basePoint.y;
        be.xscale = data.xscale; be.yscale = data.yscale;
        be.insAngle = data.angle;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    int lid = resolveLayer(data.layer);
    // Handle array insert (MINSERT): replicate for each column × row
    int cols = std::max(1, data.colcount);
    int rows = std::max(1, data.rowcount);
    double cosA = std::cos(data.angle), sinA = std::sin(data.angle);
    for (int row = 0; row < rows; ++row) {
        for (int col = 0; col < cols; ++col) {
            // Column offset along X, row offset along Y — both in insert local space,
            // then rotated by insert angle to get world-space offset.
            double ox = col * data.colspace;
            double oy = row * data.rowspace;
            double wx = ox * cosA - oy * sinA;
            double wy = ox * sinA + oy * cosA;
            // Pass insert's resolved color for BYBLOCK entities inside the block
            uint32_t insertColor = drw_entity_color(data);
            if (insertColor == BYBLOCK_COLOR) insertColor = 0; // INSERT is also BYBLOCK → BYLAYER
            expandBlock(data.name,
                        data.basePoint.x + wx,
                        data.basePoint.y + wy,
                        data.xscale, data.yscale, data.angle, lid, insertColor);
        }
    }
}
