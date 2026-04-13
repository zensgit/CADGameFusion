#include "dxf_libdxfrw_adapter.hpp"
#include <vector>
#include <cmath>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

static uint32_t aci_to_rgb(int aci) {
    static const uint32_t table[] = {
        0x000000, 0xFF0000, 0xFFFF00, 0x00FF00, 0x00FFFF, 0x0000FF, 0xFF00FF, 0xFFFFFF,
        0x808080, 0xC0C0C0
    };
    if (aci >= 0 && aci < 10) return table[aci];
    if (aci >= 10 && aci <= 255) {
        // Simplified: map to grayscale-ish for higher ACI
        int r = ((aci * 37) % 200) + 55;
        int g = ((aci * 73) % 200) + 55;
        int b = ((aci * 113) % 200) + 55;
        return (static_cast<uint32_t>(r) << 16) | (static_cast<uint32_t>(g) << 8) | static_cast<uint32_t>(b);
    }
    return 0xDCDCE6;
}

static uint32_t drw_entity_color(const DRW_Entity& ent) {
    if (ent.color24 != -1) return static_cast<uint32_t>(ent.color24) & 0xFFFFFF;
    if (ent.color > 0 && ent.color <= 255) return aci_to_rgb(ent.color);
    return 0; // BYLAYER
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

void CadgfDrwAdapter::addPolylineToDoc(const std::vector<std::pair<double,double>>& pts, int lid, uint32_t color) {
    if (pts.empty()) return;
    std::vector<cadgf_vec2> vecs;
    vecs.reserve(pts.size());
    for (const auto& [x, y] : pts) vecs.push_back({x, y});
    cadgf_entity_id eid = cadgf_document_add_polyline_ex(m_doc, vecs.data(), static_cast<int>(vecs.size()), "", lid);
    if (color != 0 && eid != 0) {
        cadgf_document_set_entity_color(m_doc, eid, color);
    }
    ++m_entityCount;
}

void CadgfDrwAdapter::expandBlock(const std::string& blockName,
    double insX, double insY, double xscale, double yscale, double angle, int lid) {
    auto it = m_blocks.find(blockName);
    if (it == m_blocks.end()) return;

    for (const auto& ent : it->second) {
        int elid = resolveLayer(ent.layerName.empty() ? "" : ent.layerName);
        if (elid == 0) elid = lid;

        switch (ent.type) {
        case BlockEntity::Line:
        case BlockEntity::LWPolyline: {
            std::vector<std::pair<double,double>> transformed;
            transformed.reserve(ent.pts.size());
            for (const auto& [px, py] : ent.pts)
                transformed.push_back(transformPoint(px, py, insX, insY, xscale, yscale, angle));
            addPolylineToDoc(transformed, elid, ent.color);
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
            addPolylineToDoc(circ, elid, ent.color);
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
            addPolylineToDoc(arc, elid, ent.color);
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
            expandBlock(ent.blockName, combinedX, combinedY,
                        combinedXS, combinedYS, combinedAngle, elid);
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

void CadgfDrwAdapter::addHeader(const DRW_Header*) {}

void CadgfDrwAdapter::addLayer(const DRW_Layer& data) {
    uint32_t color = 0xDCDCE6;
    if (data.color >= 0 && data.color <= 255)
        color = aci_to_rgb(data.color);
    int id = 0;
    cadgf_document_add_layer(m_doc, data.name.c_str(), color, &id);
    m_layerMap[data.name] = id;
    ++m_layerCount;
}

// ─── Entity callbacks ───
// If m_inBlock, store in block definition. Otherwise add to document directly.

void CadgfDrwAdapter::addPoint(const DRW_Point& data) {
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
    std::vector<std::pair<double,double>> pts = {
        {data.basePoint.x, data.basePoint.y},
        {data.secPoint.x, data.secPoint.y}
    };
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Line; be.pts = pts;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data));
}

void CadgfDrwAdapter::addArc(const DRW_Arc& data) {
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Arc;
        be.cx = data.basePoint.x; be.cy = data.basePoint.y;
        be.radius = data.radious;
        be.startAngle = data.staangle; be.endAngle = data.endangle;
        be.layerName = data.layer; be.color = drw_entity_color(data);
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
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data));
}

void CadgfDrwAdapter::addCircle(const DRW_Circle& data) {
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Circle;
        be.cx = data.basePoint.x; be.cy = data.basePoint.y;
        be.radius = data.radious;
        be.layerName = data.layer; be.color = drw_entity_color(data);
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
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data));
}

void CadgfDrwAdapter::addEllipse(const DRW_Ellipse& data) {
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
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data));
}

void CadgfDrwAdapter::addLWPolyline(const DRW_LWPolyline& data) {
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::LWPolyline;
        for (const auto& v : data.vertlist)
            be.pts.push_back({v->x, v->y});
        be.layerName = data.layer; be.color = drw_entity_color(data);
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    std::vector<std::pair<double,double>> pts;
    for (const auto& v : data.vertlist)
        pts.push_back({v->x, v->y});
    addPolylineToDoc(pts, resolveLayer(data.layer), drw_entity_color(data));
}

void CadgfDrwAdapter::addText(const DRW_Text& data) {
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Text;
        be.pts.push_back({data.basePoint.x, data.basePoint.y});
        be.height = data.height; be.rotation = data.angle;
        be.text = data.text;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    cadgf_vec2 pos = {data.basePoint.x, data.basePoint.y};
    cadgf_document_add_text(m_doc, &pos, data.height, data.angle, data.text.c_str(),
                            "", resolveLayer(data.layer));
    ++m_entityCount;
}

void CadgfDrwAdapter::addMText(const DRW_MText& data) {
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Text;
        be.pts.push_back({data.basePoint.x, data.basePoint.y});
        be.height = data.height; be.rotation = data.angle;
        be.text = data.text;
        be.layerName = data.layer; be.color = drw_entity_color(data);
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    cadgf_vec2 pos = {data.basePoint.x, data.basePoint.y};
    cadgf_document_add_text(m_doc, &pos, data.height, data.angle, data.text.c_str(),
                            "", resolveLayer(data.layer));
    ++m_entityCount;
}

// ─── SOLID/TRACE: 4-point filled shape → polyline ───

void CadgfDrwAdapter::addSolid(const DRW_Solid& data) {
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
    // DRW_Polyline uses vertex list from DRW_Polyline::vertlist (shared_ptr<DRW_Vertex>)
    // Some forks use different vertex storage; handle gracefully
    (void)data; // Heavyweight polyline rarely used in modern DXF; skip for now
}

// ─── SPLINE: sample to polyline ───

void CadgfDrwAdapter::addSpline(const DRW_Spline* data) {
    if (!data) return;
    // Use fit points if available, otherwise control points as approximation
    std::vector<std::pair<double,double>> pts;
    if (!data->fitlist.empty()) {
        for (const auto* p : data->fitlist)
            pts.push_back({p->x, p->y});
    } else if (!data->controllist.empty()) {
        for (const auto* p : data->controllist)
            pts.push_back({p->x, p->y});
    }
    if (pts.size() < 2) return;
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::LWPolyline; be.pts = pts;
        be.layerName = data->layer;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    addPolylineToDoc(pts, resolveLayer(data->layer), data ? drw_entity_color(*data) : 0);
}

// ─── LEADER: vertex list → polyline ───

void CadgfDrwAdapter::addLeader(const DRW_Leader* data) {
    if (!data) return;
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
    addPolylineToDoc(pts, resolveLayer(data->layer), data ? drw_entity_color(*data) : 0);
}

// ─── HATCH: extract boundary loops as polylines ───

void CadgfDrwAdapter::addHatch(const DRW_Hatch* data) {
    if (!data) return;
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

    // Simple hatch fill: generate parallel lines inside boundary
    if (!data->looplist.empty() && !m_inBlock) {
        // Compute boundary bbox
        double hMinX=1e18, hMinY=1e18, hMaxX=-1e18, hMaxY=-1e18;
        for (const auto* loop : data->looplist) {
            for (const auto* obj : loop->objlist) {
                if (obj->eType == DRW::LINE) {
                    auto* ln = static_cast<const DRW_Line*>(obj);
                    auto check = [&](double x, double y) {
                        if(x<hMinX)hMinX=x; if(y<hMinY)hMinY=y;
                        if(x>hMaxX)hMaxX=x; if(y>hMaxY)hMaxY=y;
                    };
                    check(ln->basePoint.x, ln->basePoint.y);
                    check(ln->secPoint.x, ln->secPoint.y);
                }
            }
        }
        double hW = hMaxX - hMinX, hH = hMaxY - hMinY;
        if (hW > 0.1 && hH > 0.1) {
            // Generate 45-degree hatch lines
            double spacing = std::max(1.0, std::min(hW, hH) / 15.0);
            double diag = hW + hH;
            uint32_t hcol = drw_entity_color(*data);
            for (double d = -diag; d < diag; d += spacing) {
                // Line: y = x - d + hMinY, clipped to bbox
                double x1 = hMinX, y1 = x1 - d + hMinY;
                double x2 = hMaxX, y2 = x2 - d + hMinY;
                // Clip to bbox
                if (y1 < hMinY) { x1 = d + hMinY - hMinY + hMinX; y1 = hMinY; }
                if (y1 > hMaxY) { x1 = d + hMinY - hMaxY + hMinX + (hMaxY-hMinY); y1 = hMaxY; }
                if (y2 < hMinY) { x2 = d + hMinY - hMinY + hMinX; y2 = hMinY; }
                if (y2 > hMaxY) { x2 = d + hMinY + (hMaxY-hMinY) + hMinX - (hMaxY-hMinY); y2 = hMaxY; }
                // Simple clip
                x1 = std::max(hMinX, std::min(hMaxX, x1));
                x2 = std::max(hMinX, std::min(hMaxX, x2));
                y1 = std::max(hMinY, std::min(hMaxY, y1));
                y2 = std::max(hMinY, std::min(hMaxY, y2));
                if (std::abs(x2-x1) > 0.01 || std::abs(y2-y1) > 0.01) {
                    addPolylineToDoc({{x1,y1},{x2,y2}}, lid, hcol);
                }
            }
        }
    }
}

// ─── DIMENSIONS: render as lines + text ───

// Helper: add dimension text at textPoint
void addDimText(cadgf_document* doc, const DRW_Dimension* dim, int lid,
                double def1x, double def1y, double def2x, double def2y) {
    if (!dim) return;
    std::string txt = dim->getText();
    if (txt.empty() || txt == "<>") {
        double dx = def2x - def1x, dy = def2y - def1y;
        double dist = std::sqrt(dx*dx + dy*dy);
        char buf[32]; snprintf(buf, sizeof(buf), "%.1f", dist);
        txt = buf;
    }
    // Text position: use textPoint if set, otherwise midpoint of def points
    double tx = dim->getTextPoint().x, ty = dim->getTextPoint().y;
    if (std::abs(tx) < 1e-10 && std::abs(ty) < 1e-10) {
        tx = (def1x + def2x) / 2; ty = (def1y + def2y) / 2;
    }
    cadgf_vec2 pos = {tx, ty};
    cadgf_document_add_text(doc, &pos, 3.5, 0, txt.c_str(), "", lid);
}

void CadgfDrwAdapter::addDimAlign(const DRW_DimAligned* data) {
    if (!data) return;
    int lid = resolveLayer(data->layer);
    uint32_t col = drw_entity_color(*data);
    // Def points → dim line
    std::vector<std::pair<double,double>> pts = {
        {data->getDef1Point().x, data->getDef1Point().y},
        {data->getDef2Point().x, data->getDef2Point().y}
    };
    // Extension lines to defPoint (dimension line position)
    std::vector<std::pair<double,double>> ext1 = {
        {data->getDef1Point().x, data->getDef1Point().y},
        {data->getDefPoint().x, data->getDefPoint().y}
    };
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Line; be.pts = pts;
        be.layerName = data->layer; be.color = col;
        m_blocks[m_currentBlockName].push_back(be);
    } else {
        addPolylineToDoc(pts, lid, col);
        addPolylineToDoc(ext1, lid, col);
        addDimText(m_doc, data, lid, data->getDef1Point().x, data->getDef1Point().y, data->getDef2Point().x, data->getDef2Point().y);
    }
}

void CadgfDrwAdapter::addDimLinear(const DRW_DimLinear* data) {
    if (!data) return;
    int lid = resolveLayer(data->layer);
    uint32_t col = drw_entity_color(*data);
    std::vector<std::pair<double,double>> pts = {
        {data->getDef1Point().x, data->getDef1Point().y},
        {data->getDef2Point().x, data->getDef2Point().y}
    };
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Line; be.pts = pts;
        be.layerName = data->layer; be.color = col;
        m_blocks[m_currentBlockName].push_back(be);
    } else {
        addPolylineToDoc(pts, lid, col);
        addDimText(m_doc, data, lid, data->getDef1Point().x, data->getDef1Point().y, data->getDef2Point().x, data->getDef2Point().y);
    }
}

void CadgfDrwAdapter::addDimRadial(const DRW_DimRadial* data) {
    if (!data) return;
    int lid = resolveLayer(data->layer);
    uint32_t col = drw_entity_color(*data);
    std::vector<std::pair<double,double>> pts = {
        {data->getCenterPoint().x, data->getCenterPoint().y},
        {data->getDiameterPoint().x, data->getDiameterPoint().y}
    };
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Line; be.pts = pts;
        be.layerName = data->layer; be.color = col;
        m_blocks[m_currentBlockName].push_back(be);
    } else {
        addPolylineToDoc(pts, lid, col);
        addDimText(m_doc, data, lid, data->getCenterPoint().x, data->getCenterPoint().y, data->getDiameterPoint().x, data->getDiameterPoint().y);
    }
}

void CadgfDrwAdapter::addDimDiametric(const DRW_DimDiametric* data) {
    if (!data) return;
    int lid = resolveLayer(data->layer);
    uint32_t col = drw_entity_color(*data);
    std::vector<std::pair<double,double>> pts = {
        {data->getDiameter1Point().x, data->getDiameter1Point().y},
        {data->getDiameter2Point().x, data->getDiameter2Point().y}
    };
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Line; be.pts = pts;
        be.layerName = data->layer; be.color = col;
        m_blocks[m_currentBlockName].push_back(be);
    } else {
        addPolylineToDoc(pts, lid, col);
        addDimText(m_doc, data, lid, data->getDiameter1Point().x, data->getDiameter1Point().y, data->getDiameter2Point().x, data->getDiameter2Point().y);
    }
}

void CadgfDrwAdapter::addDimAngular(const DRW_DimAngular* data) {
    if (!data) return;
    int lid = resolveLayer(data->layer);
    // Just draw the two lines of the angle
    std::vector<std::pair<double,double>> pts1 = {
        {data->getFirstLine1().x, data->getFirstLine1().y},
        {data->getFirstLine2().x, data->getFirstLine2().y}
    };
    std::vector<std::pair<double,double>> pts2 = {
        {data->getSecondLine1().x, data->getSecondLine1().y},
        {data->getSecondLine2().x, data->getSecondLine2().y}
    };
    if (m_inBlock) {
        BlockEntity be1; be1.type = BlockEntity::Line; be1.pts = pts1;
        be1.layerName = data->layer;
        m_blocks[m_currentBlockName].push_back(be1);
        BlockEntity be2; be2.type = BlockEntity::Line; be2.pts = pts2;
        be2.layerName = data->layer;
        m_blocks[m_currentBlockName].push_back(be2);
    } else {
        addPolylineToDoc(pts1, lid);
        addPolylineToDoc(pts2, lid);
    }
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
    expandBlock(data.name, data.basePoint.x, data.basePoint.y,
                data.xscale, data.yscale, data.angle, lid);
}
