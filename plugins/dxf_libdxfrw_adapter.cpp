#include "dxf_libdxfrw_adapter.hpp"
#include "core/document.hpp"
#include <vector>
#include <cmath>
#if !defined(_WIN32)
#include <iconv.h>
#endif

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
    if (!ent.visible) return true; // DXF code 60 = 1 means invisible
    if (!m_frozenLayers.empty() && m_frozenLayers.count(ent.layer)) return true;
    // Defpoints is AutoCAD's non-printing layer for dimension definition points.
    if (ent.layer == "Defpoints" || ent.layer == "DEFPOINTS") return true;
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
// Encode a Unicode codepoint as UTF-8 bytes appended to out.
static void appendUnicode(std::string& out, uint32_t cp) {
    if (cp < 0x80) {
        out += static_cast<char>(cp);
    } else if (cp < 0x800) {
        out += static_cast<char>(0xC0 | (cp >> 6));
        out += static_cast<char>(0x80 | (cp & 0x3F));
    } else if (cp < 0x10000) {
        out += static_cast<char>(0xE0 | (cp >> 12));
        out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
        out += static_cast<char>(0x80 | (cp & 0x3F));
    } else {
        out += static_cast<char>(0xF0 | (cp >> 18));
        out += static_cast<char>(0x80 | ((cp >> 12) & 0x3F));
        out += static_cast<char>(0x80 | ((cp >> 6) & 0x3F));
        out += static_cast<char>(0x80 | (cp & 0x3F));
    }
}

// Convert GB2312 two-byte sequence to UTF-8 using iconv.
static bool appendGB2312(std::string& out, uint8_t b1, uint8_t b2) {
#if defined(_WIN32)
    // Fallback: emit raw bytes (will likely be mojibake on Windows without iconv)
    out += static_cast<char>(b1); out += static_cast<char>(b2);
    return false;
#else
    // Use a thread-local iconv handle to avoid repeated open/close overhead.
    static thread_local iconv_t cd = iconv_open("UTF-8", "GB2312");
    if (cd == (iconv_t)-1) {
        // Try GB18030 (superset of GB2312)
        static thread_local iconv_t cd2 = iconv_open("UTF-8", "GB18030");
        if (cd2 == (iconv_t)-1) {
            out += static_cast<char>(b1); out += static_cast<char>(b2); return false;
        }
        char in_buf[2] = {static_cast<char>(b1), static_cast<char>(b2)};
        char out_buf[8] = {};
        char* in_p = in_buf; char* out_p = out_buf;
        size_t il = 2, ol = 8;
        if (iconv(cd2, &in_p, &il, &out_p, &ol) != (size_t)-1)
            out.append(out_buf, 8 - ol);
        else { out += static_cast<char>(b1); out += static_cast<char>(b2); }
        return true;
    }
    char in_buf[2] = {static_cast<char>(b1), static_cast<char>(b2)};
    char out_buf[8] = {};
    char* in_p = in_buf; char* out_p = out_buf;
    size_t il = 2, ol = 8;
    if (iconv(cd, &in_p, &il, &out_p, &ol) != (size_t)-1)
        out.append(out_buf, 8 - ol);
    else { out += static_cast<char>(b1); out += static_cast<char>(b2); }
    return true;
#endif
}

static std::string stripDxfFormatting(const std::string& s) {
    // Strips MTEXT/TEXT DXF inline format codes while preserving visible text.
    // Rules:
    //   {…}  — style scope braces: discard delimiters, keep content
    //   %%C/%%D/%%P — special chars: Ø, °, ±
    //   \P or \p — paragraph break → newline (no semicolon argument)
    //   \N or \n — newline
    //   \M+HHHHH — GB2312 char (last 4 hex digits), or \U+HHHH — Unicode char
    //   \H…; \A…; \C…; \W…; \T…; \Q…; \F…; \f…; — format args up to ;: skip
    //   \S<top>/<bot>; or \S<top>^<bot>; — stacked fraction: render as top/bot
    //   \L \l \O \o \K \k — toggle decoration (no arg, no ;): skip
    //   \\ \{ \} — literal escapes
    std::string out;
    out.reserve(s.size());
    for (size_t i = 0; i < s.size(); ++i) {
        char c = s[i];
        // Discard group delimiters — they scope style changes but content is kept
        if (c == '{' || c == '}') continue;
        // %%X special characters
        if (c == '%' && i + 2 < s.size() && s[i+1] == '%') {
            char code = static_cast<char>(std::toupper(static_cast<unsigned char>(s[i+2])));
            i += 2; // consume %%X
            if (code == 'C') { out += "\xC3\x98"; continue; } // Ø  U+00D8
            if (code == 'D') { out += "\xC2\xB0"; continue; } // °  U+00B0
            if (code == 'P') { out += "\xC2\xB1"; continue; } // ±  U+00B1
            // Other %%X: skip silently
            continue;
        }
        if (c == '\\' && i + 1 < s.size()) {
            char n = s[i + 1];
            char nu = static_cast<char>(std::toupper(static_cast<unsigned char>(n)));
            // \P (uppercase) = hard paragraph break → newline (no argument)
            // \N or \n = newline (no argument)
            // \p (lowercase) = paragraph settings code with ';'-terminated arg → skip
            if (n == 'P' || nu == 'N') { out += '\n'; ++i; continue; }
            // Literal escapes
            if (n == '\\') { out += '\\'; ++i; continue; }
            if (n == '{')  { out += '{';  ++i; continue; }
            if (n == '}')  { out += '}';  ++i; continue; }
            if (n == '~')  { out += ' ';  ++i; continue; } // non-breaking space
            // \U+HHHH — Unicode codepoint (4 hex digits)
            if (nu == 'U' && i + 2 < s.size() && s[i + 2] == '+') {
                size_t hexStart = i + 3;
                size_t hexEnd = hexStart;
                while (hexEnd < s.size() && hexEnd < hexStart + 6 &&
                       std::isxdigit(static_cast<unsigned char>(s[hexEnd])))
                    ++hexEnd;
                if (hexEnd > hexStart) {
                    uint32_t cp = 0;
                    for (size_t k = hexStart; k < hexEnd; ++k) {
                        char hc = s[k];
                        cp = cp * 16 + (hc >= '0' && hc <= '9' ? hc - '0' :
                                        hc >= 'a' && hc <= 'f' ? hc - 'a' + 10 :
                                        hc - 'A' + 10);
                    }
                    appendUnicode(out, cp);
                    i = hexEnd - 1; // outer ++i moves past last hex digit
                    continue;
                }
                // fallthrough if no valid hex digits
                ++i; continue;
            }
            // \M+HHHHH — GB2312/GB18030 char encoded as 5 hex digits;
            // last 4 hex digits = 2-byte GB2312 code (first digit = codepage id).
            if (nu == 'M' && i + 2 < s.size() && s[i + 2] == '+') {
                size_t hexStart = i + 3;
                // Read exactly 5 hex digits
                size_t hexEnd = hexStart;
                while (hexEnd < s.size() && hexEnd < hexStart + 5 &&
                       std::isxdigit(static_cast<unsigned char>(s[hexEnd])))
                    ++hexEnd;
                if (hexEnd == hexStart + 5) {
                    // Last 4 hex digits are the GB2312 2-byte code
                    auto hexNib = [&](size_t pos) -> uint8_t {
                        char hc = s[pos];
                        return hc >= '0' && hc <= '9' ? (uint8_t)(hc - '0') :
                               hc >= 'a' && hc <= 'f' ? (uint8_t)(hc - 'a' + 10) :
                                                         (uint8_t)(hc - 'A' + 10);
                    };
                    uint8_t b1 = (hexNib(hexStart + 1) << 4) | hexNib(hexStart + 2);
                    uint8_t b2 = (hexNib(hexStart + 3) << 4) | hexNib(hexStart + 4);
                    appendGB2312(out, b1, b2);
                    i = hexEnd - 1;
                    continue;
                }
                ++i; continue;
            }
            // Single-char decoration toggles (no argument): \L \l \O \o \K \k
            if (nu == 'L' || nu == 'O' || nu == 'K') { ++i; continue; }
            // Stacked fraction: \S<top>/<bot>; or \S<top>^<bot>;
            if (nu == 'S') {
                ++i; // skip 'S'
                std::string part1, part2;
                bool in2 = false;
                while (i + 1 < s.size() && s[i + 1] != ';') {
                    ++i;
                    char sc = s[i];
                    if (sc == '^' || sc == '/') { in2 = true; continue; }
                    if (!in2) part1 += sc; else part2 += sc;
                }
                if (i + 1 < s.size()) ++i; // skip ';'
                if (!part1.empty()) out += part1;
                if (!part2.empty()) { out += '/'; out += part2; }
                continue;
            }
            // Format codes with ';'-terminated arguments: skip entire argument
            // H=height, A=alignment, C=color, W=width, T=tracking,
            // Q=oblique, F/f=font, p=paragraph indent settings (lowercase p!)
            if (nu == 'H' || nu == 'A' || nu == 'C' || nu == 'W' || nu == 'T' ||
                nu == 'Q' || nu == 'F' || n == 'p') {
                ++i; // skip command char
                while (i < s.size() && s[i] != ';') ++i; // skip to ';'
                // s[i] is ';'; outer loop does ++i to advance past it
                continue;
            }
            // Unknown backslash: output the char after backslash
            out += n; ++i; continue;
        }
        out += c;
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
                                        double lweightMm, const char* entityName) {
    if (pts.empty()) return;
    std::vector<cadgf_vec2> vecs;
    vecs.reserve(pts.size());
    for (const auto& [x, y] : pts) vecs.push_back({x, y});
    cadgf_entity_id eid = cadgf_document_add_polyline_ex(m_doc, vecs.data(), static_cast<int>(vecs.size()),
                                                          entityName ? entityName : "", lid);
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

// Defined below (after fontFamilyForStyle); used here in expandBlock.
static std::string encodeTextName(const std::string& family, double widthFactor);

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
            bool isSolid = (ent.linetype == "__SOLID__");
            addPolylineToDoc(transformed, elid, effectiveColor,
                             isSolid ? "" : ent.linetype, ent.layerName, 0.0,
                             isSolid ? "__SOLID__" : nullptr);
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
            // Skip ATTDEF tag texts (internal block labels, not visible in drawing).
            // ATTDEF tags are uppercase identifiers like "HC_SUPERPART", "粗糙度".
            // Heuristic: if every ASCII char is uppercase/underscore/digit, it's likely a tag.
            {
                bool looksLikeTag = !ent.text.empty();
                bool hasAsciiLetter = false;
                for (unsigned char c : ent.text) {
                    if (c >= 'a' && c <= 'z') { looksLikeTag = false; break; }
                    if (c >= 'A' && c <= 'Z') hasAsciiLetter = true;
                }
                // Must have at least one ASCII letter and contain underscore
                if (looksLikeTag && hasAsciiLetter && ent.text.find('_') != std::string::npos)
                    break;
            }
            if (!ent.pts.empty()) {
                auto [px, py] = transformPoint(ent.pts[0].first, ent.pts[0].second,
                                               insX, insY, xscale, yscale, angle);
                cadgf_vec2 pos = {px, py};
                std::string tname = encodeTextName(
                    ent.fontFam.empty() ? std::string("STFangsong") : ent.fontFam,
                    ent.widthFactor);
                cadgf_entity_id tid = cadgf_document_add_text(m_doc, &pos,
                    ent.height * std::abs(yscale),
                    ent.rotation + angle, ent.text.c_str(),
                    tname.c_str(), elid);
                if (tid && effectiveColor != 0 && effectiveColor != BYBLOCK_COLOR)
                    cadgf_document_set_entity_color(m_doc, tid, effectiveColor);
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
    if (dimasz   > 0.0) m_dimArrowSize  = dimasz;  // Don't multiply by DIMSCALE; entities already scaled
    if (dimtxt   > 0.0) m_dimTextHeight = dimtxt  * dimscale;
    if (dimexo   > 0.0) m_dimExo        = dimexo  * dimscale;
    if (dimexe   > 0.0) m_dimExe        = dimexe  * dimscale;
    if (dimlfac  > 0.0) m_dimLFac       = dimlfac;
    if (dimdec   > 0)   m_dimDecPrecision = std::min(dimdec, 6);
    if (ltscale  > 0.0) m_ltScale       = ltscale;

    // Read drawing extents ($EXTMIN/$EXTMAX = AutoCAD's zoom-extents bbox)
    auto readCoord = [&](const char* var, double& x, double& y) -> bool {
        auto it = data->vars.find(var);
        if (it == data->vars.end()) return false;
        if (it->second->type() != DRW_Variant::COORD) return false;
        x = it->second->content.v->x;
        y = it->second->content.v->y;
        return true;
    };
    double emX=0, emY=0, eMX=0, eMY=0;
    // DXF uses "$EXTMIN", DWG uses "EXTMIN" (both via same DRW_Header)
    bool hasMin = readCoord("$EXTMIN", emX, emY) || readCoord("EXTMIN", emX, emY);
    bool hasMax = readCoord("$EXTMAX", eMX, eMY) || readCoord("EXTMAX", eMX, eMY);
    if (hasMin && hasMax && eMX > emX && eMY > emY) {
        m_hasExtents = true;
        m_extMinX = emX; m_extMinY = emY;
        m_extMaxX = eMX; m_extMaxY = eMY;
    }
}

void CadgfDrwAdapter::addDimStyle(const DRW_Dimstyle& data) {
    // Use the Standard (default) dim style to set arrow/text sizes, or capture
    // the first dim style encountered as a fallback.
    bool isStandard = (data.name == "Standard" || data.name == "STANDARD"
                       || data.name == "ISO-25" || data.name == "iso-25");
    // Only override if this is the standard style, or if we haven't set a value yet
    // (m_dimArrowSize default 3.5 means "not set from header").
    double sc = std::max(0.01, data.dimscale);
    double eff_arrow = data.dimasz; // Don't multiply by dimscale; dimension entities are already scaled
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

void CadgfDrwAdapter::addTextStyle(const DRW_Textstyle& data) {
    TextStyleInfo info;
    info.fontFile = data.font;
    info.widthFactor = (data.width > 0.01) ? data.width : 1.0;
    // Map SHX font file names to known character width/height ratios
    std::string fn = data.font;
    for (char& c : fn) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    if (fn.find("romans") != std::string::npos || fn.find("isocp") != std::string::npos ||
        fn.find("simplex") != std::string::npos)
        info.charRatio = 0.6;
    else if (fn.find("txt") != std::string::npos || fn.find("monotxt") != std::string::npos)
        info.charRatio = 0.8;
    else if (fn.find("hz") != std::string::npos || fn.find("gbcbig") != std::string::npos ||
             fn.find("chineset") != std::string::npos || fn.find("gbenor") != std::string::npos)
        info.charRatio = 1.0; // CJK bigfont
    else if (fn.find("arial") != std::string::npos || fn.find("宋体") != std::string::npos)
        info.charRatio = 0.55; // TrueType
    else
        info.charRatio = 0.65; // general default
    m_textStyles[data.name] = info;
}

void CadgfDrwAdapter::addLayer(const DRW_Layer& data) {
    // Negative color means layer is off; bit 0 or 1 of flags means frozen
    bool isOff = (data.color < 0);
    bool isFrozen = (data.flags & 0x01) || (data.flags & 0x02);
    bool noPlot = !data.plotF; // code 290: false = non-plottable
    if (isOff || isFrozen || noPlot)
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
    // Store layer line weight and set on document layer
    double lw = drw_lweight_mm(data.lWeight);
    if (lw > 0.0) {
        m_layerLineWeight[data.name] = lw;
        // Set directly on document layer struct
        auto* doc = reinterpret_cast<core::Document*>(m_doc);
        if (auto* layer = doc->get_layer(id))
            layer->line_weight = lw;
    }
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

// Per-character width tables from SHX font files (extracted via ezdxf).
// Values in design units; divide by above-baseline height to get ratio.
// Romans.shx: above=21, 96 entries for chars 32-127
static const uint8_t kRomansWidths[96] = {
    21,10,15,21,21,24,27,11,14,14,16,29,11,26,10,22,
    20,19,22,21,20,20,20,20,19,20,10,11,24,26,24,17,
    27,18,21,21,21,19,18,21,22, 8,17,24,17,24,22,22,
    21,20,21,21,16,21,18,24,20,18,20,14,22,13,22,23,
    11,19,19,18,19,18,12,20,18, 8,10,19, 8,28,18,19,
    19,19,12,17,12,18,16,22,17,17,17,14, 8,14,25,13,
};
static constexpr int kRomansAbove = 21;

// Txt.shx: above=6, 96 entries for chars 32-127
static const uint8_t kTxtWidths[96] = {
     6, 2, 4, 5, 6, 6, 5, 3, 4, 4, 5, 5, 3, 6, 2, 6,
     5, 4, 6, 6, 6, 6, 6, 7, 6, 6, 2, 3, 5, 6, 5, 5,
     5, 5, 6, 5, 6, 6, 6, 5, 6, 4, 5, 6, 6, 5, 6, 6,
     6, 5, 5, 6, 6, 5, 7, 8, 6, 6, 6, 4, 6, 4, 4, 6,
     2, 5, 6, 5, 6, 6, 6, 6, 5, 2, 4, 5, 3, 5, 5, 6,
     6, 6, 5, 6, 6, 5, 5, 6, 4, 6, 7, 4, 2, 4, 5, 5,
};
static constexpr int kTxtAbove = 6;

// Estimate text width in drawing units using per-character SHX widths.
// fontName: SHX font file name (lowercase), used for table lookup
// widthFactor: DXF text style width factor × entity widthscale
static double estimateTextWidth(const std::string& txt, double height,
                                 double latinRatio = 0.6, double widthFactor = 1.0,
                                 const std::string& fontName = "") {
    // Select per-character width table based on font
    const uint8_t* charTable = nullptr;
    int charAbove = 0;
    if (fontName.find("romans") != std::string::npos ||
        fontName.find("isocp") != std::string::npos ||
        fontName.find("simplex") != std::string::npos) {
        charTable = kRomansWidths; charAbove = kRomansAbove;
    } else if (fontName.find("txt") != std::string::npos ||
               fontName.find("monotxt") != std::string::npos) {
        charTable = kTxtWidths; charAbove = kTxtAbove;
    }
    double w = 0.0;
    for (size_t i = 0; i < txt.size(); ) {
        auto c = static_cast<unsigned char>(txt[i]);
        if (c >= 0xE0) {
            w += height * 1.0; // CJK
            i += (c >= 0xF0) ? 4 : 3;
        } else if (c >= 0xC0) {
            w += height * latinRatio;
            i += 2;
        } else {
            if (charTable && c >= 32 && c < 128) {
                w += height * charTable[c - 32] / (double)charAbove;
            } else {
                w += height * latinRatio;
            }
            ++i;
        }
    }
    return w * widthFactor;
}

// Map a DXF text-style font file (SHX or TrueType) to a macOS Qt font family
// following Chinese engineering-drawing convention. The resolved family is
// carried on the entity's `name` field (empty for text otherwise) and read
// back by the canvas renderer — no core data-model change required.
static std::string resolveFontFamily(std::string f) {
    for (char& c : f) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    // Use non-localized macOS family names (avoids Qt font-alias population cost).
    // TrueType / SHX 宋体 (SimSun) → STSong
    if (f.find("simsun") != std::string::npos || f.find("nsimsun") != std::string::npos ||
        f.find("song")   != std::string::npos || f.find("\xe5\xae\x8b") != std::string::npos)
        return "STSong";
    // 楷体 (KaiTi)
    if (f.find("kai") != std::string::npos || f.find("\xe6\xa5\xb7") != std::string::npos)
        return "STKaiti";
    // 黑体 (SimHei) / generic sans
    if (f.find("hei")  != std::string::npos || f.find("\xe9\xbb\x91") != std::string::npos ||
        f.find("arial")!= std::string::npos || f.find("sans") != std::string::npos)
        return "STHeiti";
    // SHX single-stroke (romans/isocp/txt/simplex/gbenor) + CJK bigfont
    // (gbcbig/hzfs/hzdx/hgcad) → 仿宋, the standard technical-lettering look.
    return "STFangsong"; // default
}

// Resolve the Qt font family for a DXF text style name via m_textStyles.
std::string CadgfDrwAdapter::fontFamilyForStyle(const std::string& styleName) const {
    auto sit = m_textStyles.find(styleName);
    if (sit != m_textStyles.end()) return resolveFontFamily(sit->second.fontFile);
    return resolveFontFamily(""); // unknown style → engineering 仿宋 default
}

// DXF text-style width factor for a style name (entity widthscale applied by caller).
double CadgfDrwAdapter::widthFactorForStyle(const std::string& styleName) const {
    auto sit = m_textStyles.find(styleName);
    if (sit != m_textStyles.end() && sit->second.widthFactor > 0.01)
        return sit->second.widthFactor;
    return 1.0;
}

// Encode font family + width factor into the Entity::name carrier channel.
// "family"            (width == 1)   or   "family\x1f<width>"   (width != 1).
// Canvas splits on \x1f and applies a horizontal glyph scale.
static std::string encodeTextName(const std::string& family, double widthFactor) {
    if (widthFactor <= 0.0) widthFactor = 1.0;
    if (std::abs(widthFactor - 1.0) < 0.01) return family;
    char buf[24];
    snprintf(buf, sizeof(buf), "%.4g", widthFactor);
    return family + '\x1f' + buf;
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
    // Approximate horizontal alignment offset (since core::Text has no alignment fields)
    if (useSecPoint && data.height > 0.0) {
        // Look up font-specific width ratio from text style
        double latinR = 0.6, wFac = 1.0;
        std::string fontName;
        auto sit = m_textStyles.find(data.style);
        if (sit != m_textStyles.end()) {
            latinR = sit->second.charRatio;
            wFac = sit->second.widthFactor;
            fontName = sit->second.fontFile;
            for (char& c : fontName) c = (char)std::tolower((unsigned char)c);
        }
        wFac *= data.widthscale;
        double tw = estimateTextWidth(txt, data.height, latinR, wFac, fontName);
        double cosR = std::cos(rotRad), sinR = std::sin(rotRad);
        double dx = 0.0, dy = 0.0;
        switch (data.alignH) {
            case DRW_Text::HCenter: case DRW_Text::HMiddle:
                dx = -tw * 0.5; break;
            case DRW_Text::HRight:
                dx = -tw; break;
            default: break;
        }
        // Vertical offset: drawText draws from baseline; adjust for other origins
        switch (data.alignV) {
            case DRW_Text::VTop:
                dy = -data.height; break;
            case DRW_Text::VMiddle:
                dy = -data.height * 0.5; break;
            default: break; // VBaseLine, VBottom ≈ baseline already
        }
        // Rotate the offset by the text angle
        px += dx * cosR - dy * sinR;
        py += dx * sinR + dy * cosR;
    }
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Text;
        be.pts.push_back({px, py});
        be.height = data.height; be.rotation = rotRad;
        be.text = txt;
        be.widthFactor = widthFactorForStyle(data.style) * data.widthscale;
        be.fontFam = fontFamilyForStyle(data.style);
        be.layerName = data.layer; be.color = drw_entity_color(data);
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    cadgf_vec2 pos = {px, py};
    int lid = resolveLayer(data.layer);
    // Carry resolved Qt font family (+ width factor) on the entity name.
    std::string fam = encodeTextName(fontFamilyForStyle(data.style),
                                     widthFactorForStyle(data.style) * data.widthscale);
    cadgf_entity_id eid = cadgf_document_add_text(m_doc, &pos, data.height, rotRad, txt.c_str(), fam.c_str(), lid);
    // Set explicit entity color (BYLAYER entities keep color=0)
    uint32_t col = drw_entity_color(data);
    if (eid && col != 0 && col != BYBLOCK_COLOR)
        cadgf_document_set_entity_color(m_doc, eid, col);
    ++m_entityCount;
}

void CadgfDrwAdapter::addMText(const DRW_MText& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    std::string txt = stripDxfFormatting(data.text);
    if (txt.empty()) return;

    // Recover column/embedded MTEXT that libdxfrw mis-parses: the real
    // insertion lands in secPoint, basePoint gets the (1,0)-ish X-axis
    // vector, code-41 reference-rect width is read into `height`, and
    // updateAngle() fabricates a bogus angle = atan2(sec.y,sec.x). Detect
    // that unambiguous signature and recover position/angle; the true char
    // height is lost in libdxfrw's output, so fall back to the drawing's
    // dimension text height (DIMTXT*DIMSCALE — a drawing-appropriate size).
    double mBaseX = data.basePoint.x, mBaseY = data.basePoint.y;
    double mHeight = data.height, mAngle = data.angle;
    {
        double baseMag = std::hypot(data.basePoint.x, data.basePoint.y);
        double secMag  = std::hypot(data.secPoint.x,  data.secPoint.y);
        if (baseMag < 2.0 && secMag > 1000.0 && data.height > 500.0) {
            mBaseX = data.secPoint.x; mBaseY = data.secPoint.y;
            mAngle = 0.0;
            mHeight = (m_dimTextHeight > 0.0) ? m_dimTextHeight : 50.0;
        }
    }
    // DRW_MText::angle is in degrees; cadgf_document_add_text expects radians
    double rotRad = mAngle * M_PI / 180.0;

    double px = mBaseX, py = mBaseY;
    // Apply MTEXT attachment point offset (1=TopLeft … 9=BottomRight)
    // Since core::Text has no alignment fields, shift position at import time.
    if (mHeight > 0.0) {
        // Count lines for multi-line height
        int nLines = 1;
        for (char c : txt) if (c == '\n') ++nLines;
        // Estimate first-line width for horizontal alignment
        std::string firstLine = txt.substr(0, txt.find('\n'));
        double latinR = 0.6, wFac = 1.0;
        std::string fontName;
        auto sit = m_textStyles.find(data.style);
        if (sit != m_textStyles.end()) {
            latinR = sit->second.charRatio;
            wFac = sit->second.widthFactor;
            fontName = sit->second.fontFile;
            for (char& c : fontName) c = (char)std::tolower((unsigned char)c);
        }
        // MTEXT: DXF code 41 (libdxfrw DRW_Text::widthscale) is the reference
        // rectangle WIDTH, not a glyph width factor like for TEXT. Multiplying
        // it exploded the width estimate and corrupted the attachment offset
        // (px -> huge negative). Use the text-style width factor only.
        double tw = estimateTextWidth(firstLine, mHeight, latinR, wFac, fontName);
        double th = mHeight * 1.4 * nLines;

        int ap = data.textgen; // code 71: attachment point 1-9
        if (ap < 1 || ap > 9) ap = 1;  // default TopLeft
        double dx = 0.0, dy = 0.0;
        // Horizontal: 1,4,7=Left  2,5,8=Center  3,6,9=Right
        int hmod = ((ap - 1) % 3);
        if (hmod == 1) dx = -tw * 0.5; // Center
        else if (hmod == 2) dx = -tw;  // Right
        // Vertical: MTEXT basePoint is at anchor; renderer draws at baseline.
        // First convert anchor → top-of-text, then shift down by height
        // to get the first line's baseline position.
        // 1,2,3=Top → dy=0;  4,5,6=Middle → dy=+th/2;  7,8,9=Bottom → dy=+th
        int vmod = ((ap - 1) / 3);
        if (vmod == 1) dy = th * 0.5;  // Middle → top
        else if (vmod == 2) dy = th;   // Bottom → top
        dy -= mHeight; // top → baseline of first line
        // Rotate offset by text angle
        double cosR = std::cos(rotRad), sinR = std::sin(rotRad);
        px += dx * cosR - dy * sinR;
        py += dx * sinR + dy * cosR;
    }

    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Text;
        be.pts.push_back({px, py});
        be.height = mHeight; be.rotation = rotRad;
        be.text = txt;
        be.widthFactor = widthFactorForStyle(data.style); // MTEXT: code-41 = box width, not glyph factor
        be.fontFam = fontFamilyForStyle(data.style);
        be.layerName = data.layer; be.color = drw_entity_color(data);
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    cadgf_vec2 pos = {px, py};
    int lid = resolveLayer(data.layer);
    // Carry resolved Qt font family (+ width factor) on the entity name.
    std::string fam = encodeTextName(fontFamilyForStyle(data.style),
                                     widthFactorForStyle(data.style)); // MTEXT: not * data.widthscale
    cadgf_entity_id eid = cadgf_document_add_text(m_doc, &pos, mHeight, rotRad, txt.c_str(), fam.c_str(), lid);
    uint32_t col = drw_entity_color(data);
    if (eid && col != 0 && col != BYBLOCK_COLOR)
        cadgf_document_set_entity_color(m_doc, eid, col);
    ++m_entityCount;
}

// ─── SOLID/TRACE: 4-point filled shape → polyline ───

void CadgfDrwAdapter::addSolid(const DRW_Solid& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    // DRW_Solid inherits DRW_Trace: basePoint, secPoint, thirdPoint, fourPoint
    // DXF SOLID vertex order: p1, p2, p3, p4 where the winding is p1-p2-p4-p3 (zig-zag)
    // AutoCAD draws: triangle(p1,p2,p3) if p3==p4, else quad(p1,p2,p4,p3)
    std::vector<std::pair<double,double>> pts;
    bool isTriangle = (std::abs(data.thirdPoint.x - data.fourPoint.x) < 1e-10 &&
                       std::abs(data.thirdPoint.y - data.fourPoint.y) < 1e-10);
    if (isTriangle) {
        pts = {{data.basePoint.x, data.basePoint.y},
               {data.secPoint.x, data.secPoint.y},
               {data.thirdPoint.x, data.thirdPoint.y},
               {data.basePoint.x, data.basePoint.y}};
    } else {
        // DXF SOLID has zig-zag vertex order: 1-2-4-3 for correct quad fill
        pts = {{data.basePoint.x, data.basePoint.y},
               {data.secPoint.x, data.secPoint.y},
               {data.fourPoint.x, data.fourPoint.y},
               {data.thirdPoint.x, data.thirdPoint.y},
               {data.basePoint.x, data.basePoint.y}};
    }
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::LWPolyline; be.pts = pts;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        be.linetype = "__SOLID__"; // tag for filled rendering
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data),
                     "", data.layer, 0.0, "__SOLID__");
}

void CadgfDrwAdapter::addTrace(const DRW_Trace& data) {
    if (!m_inBlock && shouldSkipEntity(data)) return;
    // TRACE uses same zig-zag vertex order as SOLID
    bool isTriangle = (std::abs(data.thirdPoint.x - data.fourPoint.x) < 1e-10 &&
                       std::abs(data.thirdPoint.y - data.fourPoint.y) < 1e-10);
    std::vector<std::pair<double,double>> pts;
    if (isTriangle) {
        pts = {{data.basePoint.x, data.basePoint.y},
               {data.secPoint.x, data.secPoint.y},
               {data.thirdPoint.x, data.thirdPoint.y},
               {data.basePoint.x, data.basePoint.y}};
    } else {
        pts = {{data.basePoint.x, data.basePoint.y},
               {data.secPoint.x, data.secPoint.y},
               {data.fourPoint.x, data.fourPoint.y},
               {data.thirdPoint.x, data.thirdPoint.y},
               {data.basePoint.x, data.basePoint.y}};
    }
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::LWPolyline; be.pts = pts;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        be.linetype = "__SOLID__";
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data),
                     "", data.layer, 0.0, "__SOLID__");
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

// Forward declaration: defined in the DIMENSIONS section below.
static void addArrowhead(cadgf_document* doc,
                          double px, double py, double fromX, double fromY,
                          int lid, uint32_t col, double arrowLen);

// ─── LEADER: vertex list → polyline + arrowhead ───

void CadgfDrwAdapter::addLeader(const DRW_Leader* data) {
    if (!data) return;
    if (!m_inBlock && shouldSkipEntity(*data)) return;
    std::vector<std::pair<double,double>> pts;
    for (const auto* v : data->vertexlist)
        pts.push_back({v->x, v->y});
    if (pts.size() < 2) return;
    int lid = resolveLayer(data->layer);
    uint32_t col = drw_entity_color(*data);
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::LWPolyline; be.pts = pts;
        be.layerName = data->layer; be.color = col;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    addPolylineToDoc(pts, lid, col, data->lineType, data->layer, drw_lweight_mm(data->lWeight));
    // Add arrowhead at first vertex (tip pointing to the annotated object) when enabled
    if (data->arrow != 0 && pts.size() >= 2) {
        addArrowhead(m_doc, pts[0].first, pts[0].second,
                     pts[1].first, pts[1].second, lid, col, m_dimArrowSize);
    }
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
                // Respect CW/CCW direction for correct boundary winding
                if (arc->isccw == 1) {
                    // CCW: ensure ea > sa
                    if (ea <= sa) ea += 2.0 * M_PI;
                } else {
                    // CW: ensure ea < sa (go backwards)
                    if (ea >= sa) ea -= 2.0 * M_PI;
                }
                int segs = 32;
                for (int s = 0; s <= segs; ++s) {
                    double a = sa + (ea - sa) * s / segs;
                    pts.push_back({arc->basePoint.x + arc->radious * std::cos(a),
                                   arc->basePoint.y + arc->radious * std::sin(a)});
                }
            } else if (obj->eType == DRW::ELLIPSE) {
                auto* ell = static_cast<const DRW_Ellipse*>(obj);
                double cx = ell->basePoint.x, cy = ell->basePoint.y;
                double mx = ell->secPoint.x, my = ell->secPoint.y; // major axis endpoint (relative)
                double ratio = ell->ratio; // minor/major ratio
                double sa = ell->staparam, ea = ell->endparam;
                double majLen = std::sqrt(mx*mx + my*my);
                double rot = std::atan2(my, mx);
                int segs = 24;
                for (int s = 0; s <= segs; ++s) {
                    double a = sa + (ea - sa) * s / segs;
                    double ex = majLen * std::cos(a);
                    double ey = majLen * ratio * std::sin(a);
                    double cosR = std::cos(rot), sinR = std::sin(rot);
                    pts.push_back({cx + ex * cosR - ey * sinR,
                                   cy + ex * sinR + ey * cosR});
                }
            } else if (obj->eType == DRW::LWPOLYLINE) {
                auto* lw = static_cast<const DRW_LWPolyline*>(obj);
                for (const auto& v : lw->vertlist)
                    pts.push_back({v->x, v->y});
            }
        }
        if (pts.size() >= 2) {
            // For SOLID hatches: render boundary as filled polygon
            bool isSolid = (data->solid != 0);
            uint32_t hcol = drw_entity_color(*data);
            if (m_inBlock) {
                BlockEntity be; be.type = BlockEntity::LWPolyline; be.pts = pts;
                be.layerName = data->layer; be.color = hcol;
                if (isSolid) be.linetype = "__SOLID__";
                m_blocks[m_currentBlockName].push_back(be);
            } else if (isSolid) {
                // Close the polygon if not already closed
                if (pts.size() >= 3 &&
                    (std::abs(pts.front().first - pts.back().first) > 1e-6 ||
                     std::abs(pts.front().second - pts.back().second) > 1e-6))
                    pts.push_back(pts.front());
                addPolylineToDoc(pts, lid, hcol, "", data->layer, 0.0, "__SOLID__");
            } else {
                addPolylineToDoc(pts, lid, hcol);
            }
        }
    }

    // Pattern hatch fill: generate parallel lines clipped to actual boundary polygon.
    // Skip for SOLID hatches (already rendered as filled polygons above).
    if (!data->looplist.empty() && !m_inBlock && data->solid == 0) {
        // Build boundary polygons — one per loop. Each loop is a closed polygon.
        // For even-odd fill line clipping, we test intersections against ALL loops.
        std::vector<std::vector<std::pair<double,double>>> loops;
        double hMinX=1e18, hMinY=1e18, hMaxX=-1e18, hMaxY=-1e18;
        for (const auto* loop : data->looplist) {
            std::vector<std::pair<double,double>> boundary;
            for (const auto* obj : loop->objlist) {
                if (obj->eType == DRW::LINE) {
                    auto* ln = static_cast<const DRW_Line*>(obj);
                    if (boundary.empty()) boundary.push_back({ln->basePoint.x, ln->basePoint.y});
                    boundary.push_back({ln->secPoint.x, ln->secPoint.y});
                } else if (obj->eType == DRW::ARC) {
                    auto* arc = static_cast<const DRW_Arc*>(obj);
                    double sa = arc->staangle, ea = arc->endangle;
                    if (arc->isccw == 1) { if (ea <= sa) ea += 2.0*M_PI; }
                    else { if (ea >= sa) ea -= 2.0*M_PI; }
                    for (int s = 0; s <= 32; ++s) {
                        double a = sa + (ea - sa) * s / 32;
                        boundary.push_back({arc->basePoint.x + arc->radious * std::cos(a),
                                            arc->basePoint.y + arc->radious * std::sin(a)});
                    }
                } else if (obj->eType == DRW::ELLIPSE) {
                    auto* ell = static_cast<const DRW_Ellipse*>(obj);
                    double cx = ell->basePoint.x, cy = ell->basePoint.y;
                    double mx = ell->secPoint.x, my = ell->secPoint.y;
                    double ratio = ell->ratio;
                    double sa = ell->staparam, ea = ell->endparam;
                    double majLen = std::sqrt(mx*mx + my*my);
                    double rot = std::atan2(my, mx);
                    for (int s = 0; s <= 24; ++s) {
                        double a = sa + (ea - sa) * s / 24;
                        double ex = majLen * std::cos(a), ey = majLen * ratio * std::sin(a);
                        double cR = std::cos(rot), sR = std::sin(rot);
                        boundary.push_back({cx + ex*cR - ey*sR, cy + ex*sR + ey*cR});
                    }
                } else if (obj->eType == DRW::LWPOLYLINE) {
                    auto* lw = static_cast<const DRW_LWPolyline*>(obj);
                    for (const auto& v : lw->vertlist) boundary.push_back({v->x, v->y});
                    // Auto-close if LWPOLYLINE has closed flag
                    if ((lw->flags & 1) && lw->vertlist.size() >= 2)
                        boundary.push_back({lw->vertlist[0]->x, lw->vertlist[0]->y});
                }
            }
            // Close this loop
            if (boundary.size() >= 3 &&
                (std::abs(boundary.front().first - boundary.back().first) > 1e-6 ||
                 std::abs(boundary.front().second - boundary.back().second) > 1e-6))
                boundary.push_back(boundary.front());
            if (boundary.size() >= 3) {
                for (auto& [bx, by] : boundary) {
                    hMinX = std::min(hMinX, bx); hMinY = std::min(hMinY, by);
                    hMaxX = std::max(hMaxX, bx); hMaxY = std::max(hMaxY, by);
                }
                loops.push_back(std::move(boundary));
            }
        }

        double hW = hMaxX - hMinX, hH = hMaxY - hMinY;
        if (hW > 0.1 && hH > 0.1 && !loops.empty()) {
            // ANSI31 hatch pattern: base spacing = 3.175mm (1/8 inch).
            // DXF scale multiplies spacing.  For AutoCAD-matching density we use
            // the pattern spacing directly but cap to ensure enough visible lines.
            double baseSpacing = (data->scale > 0.01) ? data->scale * 3.175 : 3.175;
            double diag = std::sqrt(hW*hW + hH*hH);
            // Use pattern-based spacing, but guarantee at least ~300 lines across
            // the diagonal for visual density matching AutoCAD cross-sections.
            double maxSpacing = diag / 300.0;
            double spacing = std::min(baseSpacing, maxSpacing);
            // Clamp: minimum 0.1 units (prevent infinite loops), max 2000 lines
            if (spacing < 0.1) spacing = 0.1;
            if (diag / spacing > 2000) spacing = diag / 2000.0;
            // ANSI31 pattern base angle is 45°. DXF angle field is additional rotation.
            // So angle=0 → 45° lines, angle=90 → 135° lines.
            double baseAngle = 45.0; // ANSI31 default
            double ang = (baseAngle + data->angle) * M_PI / 180.0;
            double cosA = std::cos(ang), sinA = std::sin(ang);
            uint32_t hcol = drw_entity_color(*data);

            // Sweep range: project all loop points onto perpendicular axis
            double pmin = 1e18, pmax = -1e18;
            for (auto& loop : loops)
                for (auto& [bx, by] : loop) {
                    double p = -bx * sinA + by * cosA;
                    pmin = std::min(pmin, p); pmax = std::max(pmax, p);
                }

            for (double p = pmin; p <= pmax; p += spacing) {
                double ox = p * (-sinA), oy = p * cosA;
                // Find intersections with ALL loop edges (even-odd across all loops)
                std::vector<double> tHits;
                for (auto& loop : loops) {
                    for (size_t i = 0; i + 1 < loop.size(); ++i) {
                        double ex1 = loop[i].first, ey1 = loop[i].second;
                        double ex2 = loop[i+1].first, ey2 = loop[i+1].second;
                        double edx = ex2 - ex1, edy = ey2 - ey1;
                        double denom = cosA * edy - sinA * edx;
                        if (std::abs(denom) < 1e-10) continue;
                        double u = ((ex1 - ox) * sinA - (ey1 - oy) * cosA) / (-denom);
                        if (u < -1e-10 || u > 1.0 + 1e-10) continue;
                        double t = ((ex1 - ox) * edy - (ey1 - oy) * edx) / (-denom);
                        tHits.push_back(t);
                    }
                }
                std::sort(tHits.begin(), tHits.end());
                for (size_t j = 0; j + 1 < tHits.size(); j += 2) {
                    double t1 = tHits[j], t2 = tHits[j + 1];
                    if (t2 - t1 < 0.01) continue;
                    double x1 = ox + t1*cosA, y1 = oy + t1*sinA;
                    double x2 = ox + t2*cosA, y2 = oy + t2*sinA;
                    // Sanity: clip to hatch bounding box (reject lines that escape boundary)
                    double margin = spacing;
                    if (x1 < hMinX - margin || x1 > hMaxX + margin ||
                        y1 < hMinY - margin || y1 > hMaxY + margin ||
                        x2 < hMinX - margin || x2 > hMaxX + margin ||
                        y2 < hMinY - margin || y2 > hMaxY + margin) continue;
                    // BYLAYER: pass 0 so entity inherits layer color (matches AutoCAD).
                    // Only override white/near-white colors on dark backgrounds.
                    uint32_t fillCol = hcol;
                    addPolylineToDoc({{x1,y1},{x2,y2}}, lid, fillCol);
                }
            }
        }
    }
}

// ─── DIMENSIONS: render as lines + text ───

// Append a closed filled arrowhead at point (px,py) pointing FROM (fromX,fromY).
// arrowLen: arrow length in drawing units (default = 3.5 for AutoCAD default style).
static void addArrowhead(cadgf_document* doc,
                          double px, double py, double fromX, double fromY,
                          int lid, uint32_t col, double arrowLen = 3.5) {
    double dx = px - fromX, dy = py - fromY;
    double len = std::sqrt(dx*dx + dy*dy);
    if (len < 1e-10) return;
    // Cap arrow to 1/4 of dimension line length to avoid oversized arrows
    if (arrowLen > len * 0.25) arrowLen = len * 0.25;
    if (arrowLen > 8.0) arrowLen = 8.0; // absolute max 8 units
    double nx = dx / len, ny = dy / len;      // unit along dim line
    double px2 = -ny, py2 = nx;               // perpendicular
    double arrowWidth = arrowLen * 0.28;       // ~1/3.5 of arrow length
    // Closed filled triangle: tip → wing1 → wing2 → tip
    double ax = px - nx * arrowLen, ay = py - ny * arrowLen;
    std::vector<cadgf_vec2> tri = {
        {px, py},
        {ax + px2 * arrowWidth, ay + py2 * arrowWidth},
        {ax - px2 * arrowWidth, ay - py2 * arrowWidth},
        {px, py}  // close
    };
    cadgf_entity_id eid = cadgf_document_add_polyline_ex(doc, tri.data(),
                            static_cast<int>(tri.size()), "__SOLID__", lid);
    if (eid && col) cadgf_document_set_entity_color(doc, eid, col);
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
    cadgf_entity_id eid = cadgf_document_add_text(doc, &pos, textHeight, textRot, txt.c_str(),
        "STFangsong", lid);
    // Set dimension text color from the dimension entity
    uint32_t col = drw_entity_color(*dim);
    if (eid && col != 0 && col != BYBLOCK_COLOR)
        cadgf_document_set_entity_color(doc, eid, col);
}

// Check if a dimension entity's *D block exists with geometry.
// If so, expandUnreferencedBlocks() will render it — skip programmatic construction.
bool hasDimBlock(const DRW_Dimension* dim, const std::map<std::string, std::vector<BlockEntity>>& blocks) {
    std::string bn = const_cast<DRW_Dimension*>(dim)->getName();
    if (bn.empty()) return false;
    auto it = blocks.find(bn);
    return it != blocks.end() && !it->second.empty();
}

// Draw proper aligned dimension: extension lines + offset dimension line
void CadgfDrwAdapter::addDimAlign(const DRW_DimAligned* data) {
    if (!data) return;
    if (!m_inBlock && shouldSkipEntity(*data)) return;
    // Prefer AutoCAD's *D block geometry over programmatic construction
    if (!m_inBlock && hasDimBlock(data, m_blocks)) return;
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
    if (!m_inBlock && hasDimBlock(data, m_blocks)) return;
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
    if (!m_inBlock && hasDimBlock(data, m_blocks)) return;
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
    if (!m_inBlock && hasDimBlock(data, m_blocks)) return;
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
    if (!m_inBlock && hasDimBlock(data, m_blocks)) return;
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
                                    finalText.c_str(),
                                    "STFangsong", lid);
        }
    }
}

void CadgfDrwAdapter::addDimAngular3P(const DRW_DimAngular3p* data) {
    if (!data) return;
    if (!m_inBlock && shouldSkipEntity(*data)) return;
    if (!m_inBlock && hasDimBlock(data, m_blocks)) return;
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
    if (!m_inBlock && hasDimBlock(data, m_blocks)) return;
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
    cadgf_document_add_text(m_doc, &tp, m_dimTextHeight, 0.0, buf,
                            "STFangsong", lid);
}

// ─── Expand unreferenced XRef blocks ───

void CadgfDrwAdapter::expandUnreferencedBlocks() {
    for (auto& [name, entities] : m_blocks) {
        if (m_referencedBlocks.count(name)) continue;
        if (name.empty()) continue;
        if (entities.empty()) continue;
        // Allow *D blocks (dimension geometry from AutoCAD) to be expanded.
        // Skip other system blocks: *Model_Space, *Paper_Space, *T#, *U#, *X#
        if (name[0] == '*') {
            if (name.size() > 1 && name[1] == 'D' &&
                (name.size() == 2 || std::isdigit(static_cast<unsigned char>(name[2])))) {
                // *D# dimension block — expand it (contains AutoCAD-generated geometry)
            } else {
                continue; // skip other system blocks
            }
        }
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
