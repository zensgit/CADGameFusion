#include "core/core_c_api.h"
#include "plugin_registry.hpp"

#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <unordered_map>
#include <vector>

static bool query_doc_meta_value(const cadgf_document* doc, const std::string& key, std::string* out) {
    if (!doc || !out || key.empty()) return false;
    int required = 0;
    if (!cadgf_document_get_meta_value(doc, key.c_str(), nullptr, 0, &required) || required <= 0) {
        return false;
    }
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    if (!cadgf_document_get_meta_value(doc, key.c_str(), buf.data(), static_cast<int>(buf.size()), &required2)) {
        return false;
    }
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    *out = std::string(buf.begin(), buf.end());
    return !out->empty();
}

static bool query_entity_meta_value(const cadgf_document* doc,
                                    cadgf_entity_id id,
                                    const char* suffix,
                                    std::string* out) {
    if (!suffix || !*suffix) return false;
    const std::string key = "dxf.entity." + std::to_string(static_cast<unsigned long long>(id)) + "." + suffix;
    return query_doc_meta_value(doc, key, out);
}

static bool read_text_value(const cadgf_document* doc, cadgf_entity_id id, std::string* out) {
    if (!doc || !out) return false;
    cadgf_vec2 pos{};
    double height = 0.0;
    double rotation = 0.0;
    int required = 0;
    if (!cadgf_document_get_text(doc, id, &pos, &height, &rotation, nullptr, 0, &required) || required <= 0) {
        return false;
    }
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    if (!cadgf_document_get_text(doc, id, &pos, &height, &rotation, buf.data(),
                                 static_cast<int>(buf.size()), &required2)) {
        return false;
    }
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    *out = std::string(buf.begin(), buf.end());
    return true;
}

static bool parse_meta_int(const std::string& value, int* out) {
    if (!out) return false;
    char* end = nullptr;
    const long parsed = std::strtol(value.c_str(), &end, 10);
    if (!end || end == value.c_str()) return false;
    *out = static_cast<int>(parsed);
    return true;
}

static bool parse_meta_double(const std::string& value, double* out) {
    if (!out) return false;
    char* end = nullptr;
    const double parsed = std::strtod(value.c_str(), &end);
    if (!end || end == value.c_str()) return false;
    *out = parsed;
    return true;
}

int main(int argc, char** argv) {
    if (argc < 3) {
        std::fprintf(stderr, "Usage: %s <plugin_path> <dxf_path>\n", argv[0]);
        return 2;
    }

    const std::string plugin_path = argv[1];
    const std::string dxf_path = argv[2];

    cadgf_document* doc = cadgf_document_create();
    assert(doc);

    cadgf::PluginRegistry registry;
    std::string err;
    if (!registry.load_plugin(plugin_path, &err)) {
        std::fprintf(stderr, "Failed to load plugin: %s\n", err.c_str());
        cadgf_document_destroy(doc);
        return 3;
    }

    const auto& plugins = registry.plugins();
    assert(!plugins.empty());
    const cadgf_plugin_api_v1* api = plugins.front().api;
    assert(api);
    const cadgf_importer_api_v1* importer = api->get_importer(0);
    assert(importer && importer->import_to_document);

    cadgf_error_v1 import_err{};
    const int imported = importer->import_to_document(doc, dxf_path.c_str(), &import_err);
    if (!imported) {
        std::fprintf(stderr, "Import failed: %s\n", import_err.message);
        cadgf_document_destroy(doc);
        return 4;
    }

    std::string meta;
    int viewport_count = 0;
    assert(query_doc_meta_value(doc, "dxf.viewport.count", &meta));
    assert(parse_meta_int(meta, &viewport_count));
    assert(viewport_count == 1);
    assert(query_doc_meta_value(doc, "dxf.viewport.0.layout", &meta));
    assert(meta == "LayoutCombo");
    assert(query_doc_meta_value(doc, "dxf.default_space", &meta));
    assert(meta == "1");

    int entity_count = 0;
    assert(cadgf_document_get_entity_count(doc, &entity_count));
    assert(entity_count >= 24);

    int leader_count = 0;
    int hatch_count = 0;
    int solid_hatch_count = 0;
    int ansi_hatch_count = 0;
    int insert_count = 0;
    int text_count = 0;
    int mtext_count = 0;
    int dimension_text_count = 0;
    int dimension_geometry_count = 0;
    int dimension_anchor_count = 0;
    int dimension_split_member_count = 0;
    int leader_text_proxy_count = 0;
    int third_note_proxy_count = 0;
    int third_note_group_id = -1;
    int dimension_bundle_for_78 = -1;
    int dimension_bundle_for_58 = -1;
    std::unordered_map<int, int> leader_group_members;
    std::unordered_map<int, int> dimension_bundle_members;
    std::unordered_map<int, int> dimension_bundle_split_members;

    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        assert(cadgf_document_get_entity_id_at(doc, i, &id));
        cadgf_entity_info_v2 info{};
        assert(cadgf_document_get_entity_info_v2(doc, id, &info));

        std::string space;
        if (!query_entity_meta_value(doc, id, "space", &space) || space != "1") {
            continue;
        }
        assert(query_entity_meta_value(doc, id, "layout", &meta));
        assert(meta == "LayoutCombo");

        if (info.type == CADGF_ENTITY_TYPE_TEXT) {
            std::string text_kind;
            assert(query_entity_meta_value(doc, id, "text_kind", &text_kind));
            if (text_kind == "text") {
                text_count += 1;
            } else if (text_kind == "mtext") {
                mtext_count += 1;
            } else if (text_kind == "dimension") {
                dimension_text_count += 1;
            }
        }

        std::string source_type;
        if (!query_entity_meta_value(doc, id, "source_type", &source_type)) {
            continue;
        }

        if (source_type == "LEADER") {
            std::string edit_mode;
            std::string proxy_kind;
            assert(query_entity_meta_value(doc, id, "edit_mode", &edit_mode));
            assert(query_entity_meta_value(doc, id, "proxy_kind", &proxy_kind));
            assert(edit_mode == "proxy");
            assert(proxy_kind == "leader");
            leader_count += 1;
            leader_group_members[info.group_id] += 1;
            if (info.type == CADGF_ENTITY_TYPE_TEXT) {
                std::string value;
                assert(read_text_value(doc, id, &value));
                leader_text_proxy_count += 1;
                if (value == "THIRD NOTE") {
                    third_note_proxy_count += 1;
                    third_note_group_id = info.group_id;
                }
            }
            continue;
        }

        if (source_type == "HATCH") {
            std::string edit_mode;
            std::string proxy_kind;
            std::string hatch_pattern;
            assert(query_entity_meta_value(doc, id, "edit_mode", &edit_mode));
            assert(query_entity_meta_value(doc, id, "proxy_kind", &proxy_kind));
            assert(query_entity_meta_value(doc, id, "hatch_pattern", &hatch_pattern));
            assert(edit_mode == "proxy");
            assert(proxy_kind == "hatch");
            hatch_count += 1;
            if (hatch_pattern == "SOLID") solid_hatch_count += 1;
            if (hatch_pattern == "ANSI31") ansi_hatch_count += 1;
            continue;
        }

        if (source_type == "INSERT") {
            std::string edit_mode;
            std::string proxy_kind;
            std::string block_name;
            assert(query_entity_meta_value(doc, id, "edit_mode", &edit_mode));
            assert(query_entity_meta_value(doc, id, "proxy_kind", &proxy_kind));
            assert(query_entity_meta_value(doc, id, "block_name", &block_name));
            assert(edit_mode == "exploded");
            assert(proxy_kind == "insert");
            assert(block_name == "PaperComboBlock");
            insert_count += 1;
            continue;
        }

        if (source_type == "DIMENSION") {
            std::string edit_mode;
            std::string proxy_kind;
            std::string source_bundle_meta;
            assert(query_entity_meta_value(doc, id, "edit_mode", &edit_mode));
            assert(query_entity_meta_value(doc, id, "proxy_kind", &proxy_kind));
            assert(query_entity_meta_value(doc, id, "source_bundle_id", &source_bundle_meta));
            assert(edit_mode == "proxy");
            assert(proxy_kind == "dimension");
            assert(query_entity_meta_value(doc, id, "dim_style", &meta));
            assert(meta == "Standard");
            int source_bundle_id = -1;
            assert(parse_meta_int(source_bundle_meta, &source_bundle_id));
            assert(source_bundle_id >= 1);
            dimension_bundle_members[source_bundle_id] += 1;
            if (info.group_id != source_bundle_id) {
                dimension_split_member_count += 1;
                dimension_bundle_split_members[source_bundle_id] += 1;
            }
            if (info.type == CADGF_ENTITY_TYPE_TEXT) {
                std::string value;
                assert(read_text_value(doc, id, &value));
                std::string source_anchor_x;
                std::string source_anchor_y;
                std::string driver_type;
                std::string driver_kind;
                assert(query_entity_meta_value(doc, id, "source_anchor_x", &source_anchor_x));
                assert(query_entity_meta_value(doc, id, "source_anchor_y", &source_anchor_y));
                assert(query_entity_meta_value(doc, id, "source_anchor_driver_type", &driver_type));
                assert(query_entity_meta_value(doc, id, "source_anchor_driver_kind", &driver_kind));
                double anchor_x = 0.0;
                double anchor_y = 0.0;
                assert(parse_meta_double(source_anchor_x, &anchor_x));
                assert(parse_meta_double(source_anchor_y, &anchor_y));
                assert(driver_type == "line");
                assert(driver_kind == "midpoint");
                if (value == "78") {
                    assert(anchor_x == 65.0);
                    assert(anchor_y == 0.0);
                    assert(info.group_id == source_bundle_id);
                    dimension_bundle_for_78 = source_bundle_id;
                    dimension_anchor_count += 1;
                } else if (value == "58") {
                    assert(anchor_x == 235.0);
                    assert(anchor_y == 0.0);
                    assert(info.group_id == source_bundle_id);
                    dimension_bundle_for_58 = source_bundle_id;
                    dimension_anchor_count += 1;
                }
            } else {
                dimension_geometry_count += 1;
            }
        }
    }

    assert(leader_count >= 2);
    assert(hatch_count >= 2);
    assert(solid_hatch_count >= 1);
    assert(ansi_hatch_count >= 1);
    assert(insert_count >= 6);
    assert(text_count >= 4);
    assert(mtext_count >= 2);
    assert(dimension_text_count >= 2);
    assert(dimension_geometry_count >= 2);
    assert(dimension_anchor_count == 2);
    assert(dimension_bundle_for_78 >= 1);
    assert(dimension_bundle_for_58 >= 1);
    assert(dimension_bundle_for_78 != dimension_bundle_for_58);
    assert(dimension_bundle_members[dimension_bundle_for_78] == 9);
    assert(dimension_bundle_members[dimension_bundle_for_58] == 9);
    assert(dimension_bundle_split_members[dimension_bundle_for_78] == 2);
    assert(dimension_bundle_split_members[dimension_bundle_for_58] == 2);
    assert(dimension_split_member_count == 4);
    assert(leader_text_proxy_count == 1);
    assert(third_note_proxy_count == 1);
    assert(third_note_group_id >= 1);
    assert(leader_group_members[third_note_group_id] == 2);
    int solo_leader_groups = 0;
    for (const auto& entry : leader_group_members) {
        if (entry.second == 1) solo_leader_groups += 1;
    }
    assert(solo_leader_groups >= 1);

    cadgf_document_destroy(doc);
    return 0;
}
