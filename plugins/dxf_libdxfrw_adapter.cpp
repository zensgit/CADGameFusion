#include "dxf_libdxfrw_adapter.hpp"
#include <vector>
#include <cmath>

int CadgfDrwAdapter::resolveLayer(const DRW_Entity& ent) {
    const std::string& name = ent.layer;
    if (name.empty()) return 0;
    auto it = m_layerMap.find(name);
    if (it != m_layerMap.end()) return it->second;
    int id = 0;
    cadgf_document_add_layer(m_doc, name.c_str(), 0xFFFFFF, &id);
    m_layerMap[name] = id;
    ++m_layerCount;
    return id;
}

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

void CadgfDrwAdapter::addPoint(const DRW_Point& data) {
    cadgf_point pt;
    pt.p.x = data.basePoint.x;
    pt.p.y = data.basePoint.y;
    int lid = resolveLayer(data);
    cadgf_document_add_point(m_doc, &pt, "", lid);
    ++m_entityCount;
}

void CadgfDrwAdapter::addLine(const DRW_Line& data) {
    cadgf_line line;
    line.a.x = data.basePoint.x;
    line.a.y = data.basePoint.y;
    line.b.x = data.secPoint.x;
    line.b.y = data.secPoint.y;
    int lid = resolveLayer(data);
    cadgf_document_add_line(m_doc, &line, "", lid);
    ++m_entityCount;
}

void CadgfDrwAdapter::addArc(const DRW_Arc& data) {
    cadgf_arc arc;
    arc.center.x = data.basePoint.x;
    arc.center.y = data.basePoint.y;
    arc.radius = data.radious;
    arc.start_angle = data.staangle;
    arc.end_angle = data.endangle;
    arc.clockwise = 0;
    int lid = resolveLayer(data);
    cadgf_document_add_arc(m_doc, &arc, "", lid);
    ++m_entityCount;
}

void CadgfDrwAdapter::addCircle(const DRW_Circle& data) {
    cadgf_circle circle;
    circle.center.x = data.basePoint.x;
    circle.center.y = data.basePoint.y;
    circle.radius = data.radious;
    int lid = resolveLayer(data);
    cadgf_document_add_circle(m_doc, &circle, "", lid);
    ++m_entityCount;
}

void CadgfDrwAdapter::addEllipse(const DRW_Ellipse& data) {
    cadgf_ellipse ell;
    ell.center.x = data.basePoint.x;
    ell.center.y = data.basePoint.y;
    double mx = data.secPoint.x, my = data.secPoint.y;
    ell.rx = std::sqrt(mx*mx + my*my);
    ell.ry = ell.rx * data.ratio;
    ell.rotation = std::atan2(my, mx);
    ell.start_angle = data.staparam;
    ell.end_angle = data.endparam;
    int lid = resolveLayer(data);
    cadgf_document_add_ellipse(m_doc, &ell, "", lid);
    ++m_entityCount;
}

void CadgfDrwAdapter::addLWPolyline(const DRW_LWPolyline& data) {
    std::vector<cadgf_vec2> pts;
    pts.reserve(data.vertlist.size());
    for (const auto& v : data.vertlist) {
        pts.push_back({v->x, v->y});
    }
    if (pts.empty()) return;
    int lid = resolveLayer(data);
    cadgf_document_add_polyline_ex(m_doc, pts.data(), static_cast<int>(pts.size()), "", lid);
    ++m_entityCount;
}

void CadgfDrwAdapter::addText(const DRW_Text& data) {
    cadgf_vec2 pos = {data.basePoint.x, data.basePoint.y};
    int lid = resolveLayer(data);
    cadgf_document_add_text(m_doc, &pos, data.height, data.angle, data.text.c_str(), "", lid);
    ++m_entityCount;
}

void CadgfDrwAdapter::addMText(const DRW_MText& data) {
    cadgf_vec2 pos = {data.basePoint.x, data.basePoint.y};
    int lid = resolveLayer(data);
    cadgf_document_add_text(m_doc, &pos, data.height, data.angle, data.text.c_str(), "", lid);
    ++m_entityCount;
}
