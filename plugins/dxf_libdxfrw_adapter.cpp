#include "dxf_libdxfrw_adapter.hpp"
#include <vector>
#include <cmath>

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

void CadgfDrwAdapter::addPolylineToDoc(const std::vector<std::pair<double,double>>& pts, int lid) {
    if (pts.empty()) return;
    std::vector<cadgf_vec2> vecs;
    vecs.reserve(pts.size());
    for (const auto& [x, y] : pts) vecs.push_back({x, y});
    cadgf_document_add_polyline_ex(m_doc, vecs.data(), static_cast<int>(vecs.size()), "", lid);
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
            addPolylineToDoc(transformed, elid);
            break;
        }
        case BlockEntity::Circle: {
            // Approximate circle as polyline
            std::vector<std::pair<double,double>> circ;
            double r = ent.radius * std::abs(xscale);
            auto [cx, cy] = transformPoint(ent.cx, ent.cy, insX, insY, xscale, yscale, angle);
            for (int s = 0; s <= 64; ++s) {
                double a = 2.0 * M_PI * s / 64;
                circ.push_back({cx + r * std::cos(a), cy + r * std::sin(a)});
            }
            addPolylineToDoc(circ, elid);
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
            addPolylineToDoc(arc, elid);
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
    uint32_t color = 0xFFFFFF;
    if (data.color >= 0 && data.color <= 255)
        color = static_cast<uint32_t>(data.color) * 0x010101;
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
        be.layerName = data.layer;
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
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Line;
        be.pts.push_back({data.basePoint.x, data.basePoint.y});
        be.pts.push_back({data.secPoint.x, data.secPoint.y});
        be.layerName = data.layer;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    cadgf_line line;
    line.a = {data.basePoint.x, data.basePoint.y};
    line.b = {data.secPoint.x, data.secPoint.y};
    cadgf_document_add_line(m_doc, &line, "", resolveLayer(data.layer));
    ++m_entityCount;
}

void CadgfDrwAdapter::addArc(const DRW_Arc& data) {
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Arc;
        be.cx = data.basePoint.x; be.cy = data.basePoint.y;
        be.radius = data.radious;
        be.startAngle = data.staangle; be.endAngle = data.endangle;
        be.layerName = data.layer;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    cadgf_arc arc;
    arc.center = {data.basePoint.x, data.basePoint.y};
    arc.radius = data.radious;
    arc.start_angle = data.staangle;
    arc.end_angle = data.endangle;
    arc.clockwise = 0;
    cadgf_document_add_arc(m_doc, &arc, "", resolveLayer(data.layer));
    ++m_entityCount;
}

void CadgfDrwAdapter::addCircle(const DRW_Circle& data) {
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Circle;
        be.cx = data.basePoint.x; be.cy = data.basePoint.y;
        be.radius = data.radious;
        be.layerName = data.layer;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    cadgf_circle circle;
    circle.center = {data.basePoint.x, data.basePoint.y};
    circle.radius = data.radious;
    cadgf_document_add_circle(m_doc, &circle, "", resolveLayer(data.layer));
    ++m_entityCount;
}

void CadgfDrwAdapter::addEllipse(const DRW_Ellipse& data) {
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Ellipse;
        be.cx = data.basePoint.x; be.cy = data.basePoint.y;
        double mx = data.secPoint.x, my = data.secPoint.y;
        be.rx = std::sqrt(mx*mx + my*my);
        be.ry = be.rx * data.ratio;
        be.ellRot = std::atan2(my, mx);
        be.ellStart = data.staparam; be.ellEnd = data.endparam;
        be.layerName = data.layer;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    cadgf_ellipse ell;
    ell.center = {data.basePoint.x, data.basePoint.y};
    double mx = data.secPoint.x, my = data.secPoint.y;
    ell.rx = std::sqrt(mx*mx + my*my);
    ell.ry = ell.rx * data.ratio;
    ell.rotation = std::atan2(my, mx);
    ell.start_angle = data.staparam;
    ell.end_angle = data.endparam;
    cadgf_document_add_ellipse(m_doc, &ell, "", resolveLayer(data.layer));
    ++m_entityCount;
}

void CadgfDrwAdapter::addLWPolyline(const DRW_LWPolyline& data) {
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::LWPolyline;
        for (const auto& v : data.vertlist)
            be.pts.push_back({v->x, v->y});
        be.layerName = data.layer;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    std::vector<std::pair<double,double>> pts;
    for (const auto& v : data.vertlist)
        pts.push_back({v->x, v->y});
    addPolylineToDoc(pts, resolveLayer(data.layer));
}

void CadgfDrwAdapter::addText(const DRW_Text& data) {
    if (m_inBlock) {
        BlockEntity be; be.type = BlockEntity::Text;
        be.pts.push_back({data.basePoint.x, data.basePoint.y});
        be.height = data.height; be.rotation = data.angle;
        be.text = data.text;
        be.layerName = data.layer;
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
        be.layerName = data.layer;
        m_blocks[m_currentBlockName].push_back(be);
        return;
    }
    cadgf_vec2 pos = {data.basePoint.x, data.basePoint.y};
    cadgf_document_add_text(m_doc, &pos, data.height, data.angle, data.text.c_str(),
                            "", resolveLayer(data.layer));
    ++m_entityCount;
}

// ─── INSERT: expand block reference ───

void CadgfDrwAdapter::addInsert(const DRW_Insert& data) {
    int lid = resolveLayer(data.layer);
    expandBlock(data.name, data.basePoint.x, data.basePoint.y,
                data.xscale, data.yscale, data.angle, lid);
}
