#include <cassert>
#include <cstring>
#include <string>
#include <vector>

extern "C" {
#include "core/core_c_api.h"
}

int main() {
    cadgf_document* doc = cadgf_document_create();
    assert(doc);
    int ok = CADGF_SUCCESS;

    assert(cadgf_get_abi_version() == CADGF_ABI_VERSION);
    const char* version = cadgf_get_version();
    assert(version && version[0] != '\0');
    (void)cadgf_get_feature_flags();

    // Document settings: unit scale
    double unit_scale = cadgf_document_get_unit_scale(doc);
    assert(unit_scale == 1.0);
    ok = cadgf_document_set_unit_scale(doc, 2.5);
    assert(ok == CADGF_SUCCESS);
    unit_scale = cadgf_document_get_unit_scale(doc);
    assert(unit_scale == 2.5);

    // Document metadata: set/get fields
    ok = cadgf_document_set_label(doc, "DocLabel");
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_set_author(doc, "DocAuthor");
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_set_company(doc, "DocCompany");
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_set_comment(doc, "DocComment");
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_set_created_at(doc, "2025-12-25T00:00:00Z");
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_set_modified_at(doc, "2025-12-25T01:00:00Z");
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_set_unit_name(doc, "mm");
    assert(ok == CADGF_SUCCESS);

    int label_required = 0;
    ok = cadgf_document_get_label(doc, nullptr, 0, &label_required);
    assert(ok == CADGF_SUCCESS);
    std::vector<char> label_buf(static_cast<size_t>(label_required));
    int label_required2 = 0;
    ok = cadgf_document_get_label(doc, label_buf.data(), static_cast<int>(label_buf.size()), &label_required2);
    assert(ok == CADGF_SUCCESS);
    assert(label_required2 == label_required);
    assert(std::strcmp(label_buf.data(), "DocLabel") == 0);

    ok = cadgf_document_set_meta_value(doc, "k1", "v1");
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_set_meta_value(doc, "k2", "v2");
    assert(ok == CADGF_SUCCESS);
    int meta_count = 0;
    ok = cadgf_document_get_meta_count(doc, &meta_count);
    assert(ok == CADGF_SUCCESS);
    assert(meta_count == 2);

    int key_required = 0;
    ok = cadgf_document_get_meta_key_at(doc, 0, nullptr, 0, &key_required);
    assert(ok == CADGF_SUCCESS);
    std::vector<char> key_buf(static_cast<size_t>(key_required));
    int key_required2 = 0;
    ok = cadgf_document_get_meta_key_at(doc, 0, key_buf.data(), static_cast<int>(key_buf.size()), &key_required2);
    assert(ok == CADGF_SUCCESS);
    assert(std::strcmp(key_buf.data(), "k1") == 0);

    int val_required = 0;
    ok = cadgf_document_get_meta_value(doc, "k2", nullptr, 0, &val_required);
    assert(ok == CADGF_SUCCESS);
    std::vector<char> val_buf(static_cast<size_t>(val_required));
    int val_required2 = 0;
    ok = cadgf_document_get_meta_value(doc, "k2", val_buf.data(), static_cast<int>(val_buf.size()), &val_required2);
    assert(ok == CADGF_SUCCESS);
    assert(std::strcmp(val_buf.data(), "v2") == 0);

    // Group id allocation (monotonic)
    int gid1 = cadgf_document_alloc_group_id(doc);
    int gid2 = cadgf_document_alloc_group_id(doc);
    assert(gid1 >= 1);
    assert(gid2 == gid1 + 1);

    // Layer: add + enumerate + UTF-8 name query
    const char* layer_name = u8"图层_中文_Alpha";
    int layer_id = -1;
    ok = cadgf_document_add_layer(doc, layer_name, 0x112233u, &layer_id);
    assert(ok == CADGF_SUCCESS);
    assert(layer_id > 0);

    int layer_count = 0;
    ok = cadgf_document_get_layer_count(doc, &layer_count);
    assert(ok == CADGF_SUCCESS);
    assert(layer_count >= 2); // includes default layer 0

    int layer0 = -1;
    ok = cadgf_document_get_layer_id_at(doc, 0, &layer0);
    assert(ok == CADGF_SUCCESS);
    assert(layer0 == 0);

    cadgf_layer_info li{};
    ok = cadgf_document_get_layer_info(doc, layer_id, &li);
    assert(ok == CADGF_SUCCESS);
    assert(li.id == layer_id);
    assert(li.color == 0x112233u);
    assert(li.visible == 1);
    assert(li.locked == 0);

    cadgf_layer_info_v2 li2{};
    ok = cadgf_document_get_layer_info_v2(doc, layer_id, &li2);
    assert(ok == CADGF_SUCCESS);
    assert(li2.printable == 1);
    assert(li2.frozen == 0);
    assert(li2.construction == 0);

    ok = cadgf_document_set_layer_visible(doc, layer_id, 0);
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_set_layer_locked(doc, layer_id, 1);
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_set_layer_printable(doc, layer_id, 0);
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_set_layer_frozen(doc, layer_id, 1);
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_set_layer_construction(doc, layer_id, 1);
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_set_layer_color(doc, layer_id, 0x445566u);
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_get_layer_info(doc, layer_id, &li);
    assert(ok == CADGF_SUCCESS);
    assert(li.visible == 0);
    assert(li.locked == 1);
    assert(li.color == 0x445566u);

    ok = cadgf_document_get_layer_info_v2(doc, layer_id, &li2);
    assert(ok == CADGF_SUCCESS);
    assert(li2.printable == 0);
    assert(li2.frozen == 1);
    assert(li2.construction == 1);

    int required_name_bytes = 0;
    ok = cadgf_document_get_layer_name(doc, layer_id, nullptr, 0, &required_name_bytes);
    assert(ok == CADGF_SUCCESS);
    assert(required_name_bytes == static_cast<int>(std::strlen(layer_name)) + 1);

    std::vector<char> name_buf(static_cast<size_t>(required_name_bytes));
    int required_name_bytes2 = 0;
    ok = cadgf_document_get_layer_name(doc, layer_id, name_buf.data(), static_cast<int>(name_buf.size()), &required_name_bytes2);
    assert(ok == CADGF_SUCCESS);
    assert(required_name_bytes2 == required_name_bytes);
    assert(std::strcmp(name_buf.data(), layer_name) == 0);

    // Entity: add + enumerate + get info/name + points
    cadgf_vec2 pts[3] = {{0, 0}, {1, 0}, {1, 1}};
    const char* ent_name = u8"实体_中文_A";
    cadgf_entity_id eid = cadgf_document_add_polyline_ex(doc, pts, 3, ent_name, layer_id);
    assert(eid != 0);

    int ent_count = 0;
    ok = cadgf_document_get_entity_count(doc, &ent_count);
    assert(ok == CADGF_SUCCESS);
    assert(ent_count >= 1);

    cadgf_entity_id first_id = 0;
    ok = cadgf_document_get_entity_id_at(doc, 0, &first_id);
    assert(ok == CADGF_SUCCESS);
    assert(first_id == eid);

    cadgf_entity_info ei{};
    ok = cadgf_document_get_entity_info(doc, eid, &ei);
    assert(ok == CADGF_SUCCESS);
    assert(ei.id == eid);
    assert(ei.type == CADGF_ENTITY_TYPE_POLYLINE);
    assert(ei.layer_id == layer_id);

    ok = cadgf_document_set_entity_group_id(doc, eid, gid1);
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_set_entity_visible(doc, eid, 0);
    assert(ok == CADGF_SUCCESS);
    ok = cadgf_document_set_entity_color(doc, eid, 0x778899u);
    assert(ok == CADGF_SUCCESS);
    cadgf_entity_info_v2 ei2{};
    ok = cadgf_document_get_entity_info_v2(doc, eid, &ei2);
    assert(ok == CADGF_SUCCESS);
    assert(ei2.group_id == gid1);
    assert(ei2.visible == 0);
    assert(ei2.color == 0x778899u);

    ok = cadgf_document_set_entity_line_type(doc, eid, "DASHED");
    assert(ok == CADGF_SUCCESS);
    int line_type_required = 0;
    ok = cadgf_document_get_entity_line_type(doc, eid, nullptr, 0, &line_type_required);
    assert(ok == CADGF_SUCCESS);
    std::vector<char> line_type_buf(static_cast<size_t>(line_type_required));
    int line_type_required2 = 0;
    ok = cadgf_document_get_entity_line_type(doc, eid, line_type_buf.data(), static_cast<int>(line_type_buf.size()), &line_type_required2);
    assert(ok == CADGF_SUCCESS);
    assert(line_type_required2 == line_type_required);
    assert(std::strcmp(line_type_buf.data(), "DASHED") == 0);

    ok = cadgf_document_set_entity_line_weight(doc, eid, 0.75);
    assert(ok == CADGF_SUCCESS);
    double line_weight = 0.0;
    ok = cadgf_document_get_entity_line_weight(doc, eid, &line_weight);
    assert(ok == CADGF_SUCCESS);
    assert(line_weight == 0.75);

    ok = cadgf_document_set_entity_line_type_scale(doc, eid, 1.5);
    assert(ok == CADGF_SUCCESS);
    double line_scale = 0.0;
    ok = cadgf_document_get_entity_line_type_scale(doc, eid, &line_scale);
    assert(ok == CADGF_SUCCESS);
    assert(line_scale == 1.5);

    int ent_required_bytes = 0;
    ok = cadgf_document_get_entity_name(doc, eid, nullptr, 0, &ent_required_bytes);
    assert(ok == CADGF_SUCCESS);
    assert(ent_required_bytes == static_cast<int>(std::strlen(ent_name)) + 1);

    std::vector<char> ent_name_buf(static_cast<size_t>(ent_required_bytes));
    int ent_required_bytes2 = 0;
    ok = cadgf_document_get_entity_name(doc, eid, ent_name_buf.data(), static_cast<int>(ent_name_buf.size()), &ent_required_bytes2);
    assert(ok == CADGF_SUCCESS);
    assert(ent_required_bytes2 == ent_required_bytes);
    assert(std::strcmp(ent_name_buf.data(), ent_name) == 0);

    int required_points = 0;
    ok = cadgf_document_get_polyline_points(doc, eid, nullptr, 0, &required_points);
    assert(ok == CADGF_SUCCESS);
    assert(required_points == 3);

    std::vector<cadgf_vec2> out_pts(static_cast<size_t>(required_points));
    int required_points2 = 0;
    ok = cadgf_document_get_polyline_points(doc, eid, out_pts.data(), static_cast<int>(out_pts.size()), &required_points2);
    assert(ok == CADGF_SUCCESS);
    assert(required_points2 == required_points);
    assert(out_pts[0].x == 0.0 && out_pts[0].y == 0.0);
    assert(out_pts[1].x == 1.0 && out_pts[1].y == 0.0);
    assert(out_pts[2].x == 1.0 && out_pts[2].y == 1.0);

    cadgf_vec2 new_pts[3] = {{2, 2}, {3, 2}, {3, 3}};
    ok = cadgf_document_set_polyline_points(doc, eid, new_pts, 3);
    assert(ok == CADGF_SUCCESS);

    int required_points3 = 0;
    ok = cadgf_document_get_polyline_points(doc, eid, nullptr, 0, &required_points3);
    assert(ok == CADGF_SUCCESS);
    assert(required_points3 == 3);
    std::vector<cadgf_vec2> out_pts2(static_cast<size_t>(required_points3));
    int required_points4 = 0;
    ok = cadgf_document_get_polyline_points(doc, eid, out_pts2.data(), static_cast<int>(out_pts2.size()), &required_points4);
    assert(ok == CADGF_SUCCESS);
    assert(out_pts2[0].x == 2.0 && out_pts2[0].y == 2.0);
    assert(out_pts2[1].x == 3.0 && out_pts2[1].y == 2.0);
    assert(out_pts2[2].x == 3.0 && out_pts2[2].y == 3.0);

    cadgf_point p{};
    p.p = cadgf_vec2{4.0, 5.0};
    cadgf_entity_id pid = cadgf_document_add_point(doc, &p, "pt", layer_id);
    assert(pid != 0);
    cadgf_entity_info pi{};
    ok = cadgf_document_get_entity_info(doc, pid, &pi);
    assert(ok == CADGF_SUCCESS);
    assert(pi.type == CADGF_ENTITY_TYPE_POINT);
    cadgf_point p_out{};
    ok = cadgf_document_get_point(doc, pid, &p_out);
    assert(ok == CADGF_SUCCESS);
    assert(p_out.p.x == 4.0 && p_out.p.y == 5.0);
    cadgf_point p_new{};
    p_new.p = cadgf_vec2{6.0, 7.0};
    ok = cadgf_document_set_point(doc, pid, &p_new);
    assert(ok == CADGF_SUCCESS);

    cadgf_line l{};
    l.a = cadgf_vec2{0.0, 0.0};
    l.b = cadgf_vec2{1.0, 2.0};
    cadgf_entity_id lid = cadgf_document_add_line(doc, &l, "line", layer_id);
    assert(lid != 0);
    cadgf_entity_info li_ent{};
    ok = cadgf_document_get_entity_info(doc, lid, &li_ent);
    assert(ok == CADGF_SUCCESS);
    assert(li_ent.type == CADGF_ENTITY_TYPE_LINE);
    cadgf_line l_out{};
    ok = cadgf_document_get_line(doc, lid, &l_out);
    assert(ok == CADGF_SUCCESS);
    assert(l_out.a.x == 0.0 && l_out.a.y == 0.0);
    assert(l_out.b.x == 1.0 && l_out.b.y == 2.0);

    cadgf_arc a{};
    a.center = cadgf_vec2{0.0, 0.0};
    a.radius = 2.0;
    a.start_angle = 0.0;
    a.end_angle = 1.57;
    a.clockwise = 0;
    cadgf_entity_id aid = cadgf_document_add_arc(doc, &a, "arc", layer_id);
    assert(aid != 0);
    cadgf_entity_info ai{};
    ok = cadgf_document_get_entity_info(doc, aid, &ai);
    assert(ok == CADGF_SUCCESS);
    assert(ai.type == CADGF_ENTITY_TYPE_ARC);
    cadgf_arc a_out{};
    ok = cadgf_document_get_arc(doc, aid, &a_out);
    assert(ok == CADGF_SUCCESS);
    assert(a_out.radius == 2.0);

    cadgf_circle c{};
    c.center = cadgf_vec2{1.0, 2.0};
    c.radius = 3.0;
    cadgf_entity_id cid = cadgf_document_add_circle(doc, &c, "circle", layer_id);
    assert(cid != 0);
    cadgf_entity_info ci{};
    ok = cadgf_document_get_entity_info(doc, cid, &ci);
    assert(ok == CADGF_SUCCESS);
    assert(ci.type == CADGF_ENTITY_TYPE_CIRCLE);
    cadgf_circle c_out{};
    ok = cadgf_document_get_circle(doc, cid, &c_out);
    assert(ok == CADGF_SUCCESS);
    assert(c_out.radius == 3.0);

    cadgf_ellipse e{};
    e.center = cadgf_vec2{2.0, 3.0};
    e.rx = 4.0;
    e.ry = 2.0;
    e.rotation = 0.25;
    e.start_angle = 0.0;
    e.end_angle = 3.14;
    cadgf_entity_id ellipse_id = cadgf_document_add_ellipse(doc, &e, "ellipse", layer_id);
    assert(ellipse_id != 0);
    cadgf_entity_info ei_ell{};
    ok = cadgf_document_get_entity_info(doc, ellipse_id, &ei_ell);
    assert(ok == CADGF_SUCCESS);
    assert(ei_ell.type == CADGF_ENTITY_TYPE_ELLIPSE);
    cadgf_ellipse e_out{};
    ok = cadgf_document_get_ellipse(doc, ellipse_id, &e_out);
    assert(ok == CADGF_SUCCESS);
    assert(e_out.rx == 4.0);
    e.rx = 5.0;
    ok = cadgf_document_set_ellipse(doc, ellipse_id, &e);
    assert(ok == CADGF_SUCCESS);

    cadgf_vec2 text_pos = {1.0, 2.0};
    cadgf_entity_id tid = cadgf_document_add_text(doc, &text_pos, 3.0, 0.5, "Hello", "text", layer_id);
    assert(tid != 0);
    cadgf_entity_info ti{};
    ok = cadgf_document_get_entity_info(doc, tid, &ti);
    assert(ok == CADGF_SUCCESS);
    assert(ti.type == CADGF_ENTITY_TYPE_TEXT);
    int text_required = 0;
    ok = cadgf_document_get_text(doc, tid, nullptr, nullptr, nullptr, nullptr, 0, &text_required);
    assert(ok == CADGF_SUCCESS);
    std::vector<char> text_buf(static_cast<size_t>(text_required));
    int text_required2 = 0;
    cadgf_vec2 text_pos_out{};
    double text_h = 0.0;
    double text_rot = 0.0;
    ok = cadgf_document_get_text(doc, tid, &text_pos_out, &text_h, &text_rot,
                                 text_buf.data(), static_cast<int>(text_buf.size()),
                                 &text_required2);
    assert(ok == CADGF_SUCCESS);
    assert(text_required2 == text_required);
    assert(std::strcmp(text_buf.data(), "Hello") == 0);
    assert(text_pos_out.x == 1.0 && text_pos_out.y == 2.0);
    assert(text_h == 3.0);
    assert(text_rot == 0.5);

    cadgf_vec2 spline_pts[3] = {{0.0, 0.0}, {1.0, 1.0}, {2.0, 0.0}};
    double spline_knots[6] = {0.0, 0.0, 0.0, 1.0, 1.0, 1.0};
    cadgf_entity_id sid = cadgf_document_add_spline(doc, spline_pts, 3, spline_knots, 6, 3, "spline", layer_id);
    assert(sid != 0);
    cadgf_entity_info si{};
    ok = cadgf_document_get_entity_info(doc, sid, &si);
    assert(ok == CADGF_SUCCESS);
    assert(si.type == CADGF_ENTITY_TYPE_SPLINE);
    int required_ctrl = 0;
    int required_knots = 0;
    int spline_degree = 0;
    ok = cadgf_document_get_spline(doc, sid, nullptr, 0, &required_ctrl,
                                   nullptr, 0, &required_knots, &spline_degree);
    assert(ok == CADGF_SUCCESS);
    assert(required_ctrl == 3);
    assert(required_knots == 6);
    assert(spline_degree == 3);
    std::vector<cadgf_vec2> spline_out(static_cast<size_t>(required_ctrl));
    std::vector<double> spline_knots_out(static_cast<size_t>(required_knots));
    ok = cadgf_document_get_spline(doc, sid, spline_out.data(), static_cast<int>(spline_out.size()),
                                   &required_ctrl, spline_knots_out.data(), static_cast<int>(spline_knots_out.size()),
                                   &required_knots, &spline_degree);
    assert(ok == CADGF_SUCCESS);
    assert(spline_out[1].x == 1.0 && spline_out[1].y == 1.0);

    cadgf_document_destroy(doc);
    return 0;
}
