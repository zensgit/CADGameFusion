#include "core/core_c_api.h"
#include "plugin_registry.hpp"

#include <cassert>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string>
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

static std::string get_entity_line_type(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    if (!cadgf_document_get_entity_line_type(doc, id, nullptr, 0, &required) || required <= 0) {
        return std::string();
    }
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    if (!cadgf_document_get_entity_line_type(doc, id, buf.data(),
                                             static_cast<int>(buf.size()), &required2)) {
        return std::string();
    }
    return std::string(buf.data());
}

static double get_entity_line_weight(const cadgf_document* doc, cadgf_entity_id id) {
    double weight = 0.0;
    assert(cadgf_document_get_entity_line_weight(doc, id, &weight));
    return weight;
}

static double get_entity_line_scale(const cadgf_document* doc, cadgf_entity_id id) {
    double scale = 0.0;
    assert(cadgf_document_get_entity_line_type_scale(doc, id, &scale));
    return scale;
}

static std::string get_entity_color_source(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    if (!cadgf_document_get_entity_color_source(doc, id, nullptr, 0, &required) || required <= 0) {
        return std::string();
    }
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    if (!cadgf_document_get_entity_color_source(doc, id, buf.data(),
                                                static_cast<int>(buf.size()), &required2)) {
        return std::string();
    }
    return std::string(buf.data());
}

static bool parse_meta_int(const std::string& value, int* out) {
    if (!out) return false;
    char* end = nullptr;
    const long parsed = std::strtol(value.c_str(), &end, 10);
    if (!end || end == value.c_str()) return false;
    *out = static_cast<int>(parsed);
    return true;
}

static void assert_near(double value, double expected, double eps = 1e-6) {
    assert(std::fabs(value - expected) <= eps);
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
    assert(meta == "LayoutStyle");

    int entity_count = 0;
    assert(cadgf_document_get_entity_count(doc, &entity_count));
    assert(entity_count >= 4);

    int note_count = 0;
    int byblock_insert_count = 0;
    int bylayer_insert_count = 0;

    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        assert(cadgf_document_get_entity_id_at(doc, i, &id));
        cadgf_entity_info info{};
        assert(cadgf_document_get_entity_info(doc, id, &info));

        std::string space;
        if (!query_entity_meta_value(doc, id, "space", &space) || space != "1") {
            continue;
        }
        assert(query_entity_meta_value(doc, id, "layout", &meta));
        assert(meta == "LayoutStyle");

        if (info.type == CADGF_ENTITY_TYPE_TEXT) {
            std::string value;
            assert(query_entity_meta_value(doc, id, "text_kind", &meta));
            assert(meta == "text");
            const std::string value_key =
                "dxf.entity." + std::to_string(static_cast<unsigned long long>(id)) + ".value";
            assert(query_doc_meta_value(doc, value_key, &value));
            if (value == "LAYOUT STYLE NOTE") {
                note_count += 1;
            }
            continue;
        }

        assert(query_entity_meta_value(doc, id, "source_type", &meta));
        assert(meta == "INSERT");
        assert(query_entity_meta_value(doc, id, "edit_mode", &meta));
        assert(meta == "exploded");
        assert(query_entity_meta_value(doc, id, "proxy_kind", &meta));
        assert(meta == "insert");
        assert(query_entity_meta_value(doc, id, "block_name", &meta));
        assert(meta == "PaperStyledBlock");

        cadgf_entity_info_v2 info_v2{};
        assert(cadgf_document_get_entity_info_v2(doc, id, &info_v2));
        const std::string color_source = get_entity_color_source(doc, id);
        const std::string line_type = get_entity_line_type(doc, id);
        const double line_weight = get_entity_line_weight(doc, id);
        const double line_scale = get_entity_line_scale(doc, id);

        if (color_source == "BYBLOCK") {
            byblock_insert_count += 1;
            assert(line_type == "CENTER");
            assert_near(line_weight, 0.5);
            assert_near(line_scale, 0.25);
            assert(info_v2.color == 0xFF0000u);
            continue;
        }

        assert(color_source == "BYLAYER");
        bylayer_insert_count += 1;
        assert(line_type == "CENTER2");
        assert_near(line_weight, 0.25);
        assert_near(line_scale, 0.6);
        assert(info_v2.color == 0x00FFFFu);
    }

    assert(note_count >= 1);
    assert(byblock_insert_count >= 1);
    assert(bylayer_insert_count >= 1);

    cadgf_document_destroy(doc);
    return 0;
}
