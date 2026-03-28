#include "core/core_c_api.h"
#include "plugin_registry.hpp"

#include <cassert>
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

static bool parse_meta_int(const std::string& value, int* out) {
    if (!out) return false;
    char* end = nullptr;
    const long parsed = std::strtol(value.c_str(), &end, 10);
    if (!end || end == value.c_str()) return false;
    *out = static_cast<int>(parsed);
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
    assert(meta == "LayoutMixed");
    assert(query_doc_meta_value(doc, "dxf.default_space", &meta));
    assert(meta == "1");

    int entity_count = 0;
    assert(cadgf_document_get_entity_count(doc, &entity_count));
    assert(entity_count >= 6);

    int found_insert = 0;
    int found_hatch = 0;
    int found_dimension_text = 0;
    int found_dimension_geometry = 0;
    int found_paperspace = 0;
    int found_paperspace_text = 0;

    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        assert(cadgf_document_get_entity_id_at(doc, i, &id));
        cadgf_entity_info info{};
        assert(cadgf_document_get_entity_info(doc, id, &info));

        std::string entity_space;
        if (query_entity_meta_value(doc, id, "space", &entity_space) && entity_space == "1") {
            found_paperspace += 1;
            assert(query_entity_meta_value(doc, id, "layout", &meta));
            assert(meta == "LayoutMixed");
            if (info.type == CADGF_ENTITY_TYPE_TEXT) {
                found_paperspace_text += 1;
            }
        }

        std::string source_type;
        if (!query_entity_meta_value(doc, id, "source_type", &source_type)) {
            continue;
        }
        if (source_type == "INSERT") {
            found_insert += 1;
            continue;
        }
        if (source_type == "HATCH") {
            found_hatch += 1;
            continue;
        }
        if (source_type != "DIMENSION") {
            continue;
        }

        assert(query_entity_meta_value(doc, id, "edit_mode", &meta));
        assert(meta == "proxy");
        assert(query_entity_meta_value(doc, id, "proxy_kind", &meta));
        assert(meta == "dimension");
        assert(query_entity_meta_value(doc, id, "block_name", &meta));
        assert(!meta.empty());
        int dim_type = 0;
        assert(query_entity_meta_value(doc, id, "dim_type", &meta));
        assert(parse_meta_int(meta, &dim_type));
        assert(dim_type == 32);
        assert(query_entity_meta_value(doc, id, "dim_style", &meta));
        assert(meta == "Standard");

        if (info.type == CADGF_ENTITY_TYPE_TEXT) {
            assert(query_entity_meta_value(doc, id, "text_kind", &meta));
            assert(meta == "dimension");
            found_dimension_text += 1;
        } else {
            found_dimension_geometry += 1;
        }
    }

    assert(found_insert >= 1);
    assert(found_hatch >= 1);
    assert(found_dimension_text >= 1);
    assert(found_dimension_geometry >= 1);
    assert(found_paperspace >= 1);
    assert(found_paperspace_text >= 1);

    cadgf_document_destroy(doc);
    return 0;
}
