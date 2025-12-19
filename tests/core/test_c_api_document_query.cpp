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

    // Document settings: unit scale
    double unit_scale = cadgf_document_get_unit_scale(doc);
    assert(unit_scale == 1.0);
    ok = cadgf_document_set_unit_scale(doc, 2.5);
    assert(ok == CADGF_SUCCESS);
    unit_scale = cadgf_document_get_unit_scale(doc);
    assert(unit_scale == 2.5);

    // Group id allocation (monotonic)
    int gid1 = cadgf_document_alloc_group_id(doc);
    int gid2 = cadgf_document_alloc_group_id(doc);
    assert(gid1 >= 1);
    assert(gid2 == gid1 + 1);

    // Layer: add + enumerate + UTF-8 name query
    const char* layer_name = u8"图层_中文_Alpha";
    int layer_id = -1;
    int ok = cadgf_document_add_layer(doc, layer_name, 0x112233u, &layer_id);
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
    cadgf_entity_info_v2 ei2{};
    ok = cadgf_document_get_entity_info_v2(doc, eid, &ei2);
    assert(ok == CADGF_SUCCESS);
    assert(ei2.group_id == gid1);
    assert(ei2.visible == 1);
    assert(ei2.color == 0);

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

    cadgf_document_destroy(doc);
    return 0;
}
