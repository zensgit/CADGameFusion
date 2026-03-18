#include "core/core_c_api.h"
#include "plugin_registry.hpp"

#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <set>
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
    assert(viewport_count == 2);

    std::set<std::string> viewport_layouts;
    for (int i = 0; i < viewport_count; ++i) {
        const std::string key = "dxf.viewport." + std::to_string(i) + ".layout";
        assert(query_doc_meta_value(doc, key, &meta));
        viewport_layouts.insert(meta);
    }
    assert(viewport_layouts.count("LayoutA") == 1);
    assert(viewport_layouts.count("LayoutB") == 1);

    int entity_count = 0;
    assert(cadgf_document_get_entity_count(doc, &entity_count));
    assert(entity_count >= 4);

    int model_count = 0;
    int paper_count = 0;
    std::set<std::string> paper_layouts;
    int layout_a_text = 0;
    int layout_b_text = 0;

    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        assert(cadgf_document_get_entity_id_at(doc, i, &id));
        cadgf_entity_info info{};
        assert(cadgf_document_get_entity_info(doc, id, &info));

        std::string space;
        if (!query_entity_meta_value(doc, id, "space", &space)) {
            model_count += 1;
            continue;
        }
        if (space == "0") {
            model_count += 1;
            continue;
        }
        assert(space == "1");
        paper_count += 1;

        assert(query_entity_meta_value(doc, id, "layout", &meta));
        paper_layouts.insert(meta);

        if (info.type != CADGF_ENTITY_TYPE_TEXT) {
            continue;
        }

        const std::string text_key = "dxf.entity." + std::to_string(static_cast<unsigned long long>(id)) + ".value";
        std::string text_value;
        if (!query_doc_meta_value(doc, text_key, &text_value)) {
            continue;
        }
        if (meta == "LayoutA" && text_value == "LAYOUT A NOTE") {
            layout_a_text += 1;
        }
        if (meta == "LayoutB" && text_value == "LAYOUT B NOTE") {
            layout_b_text += 1;
        }
    }

    assert(model_count >= 2);
    assert(paper_count >= 2);
    assert(paper_layouts.count("LayoutA") == 1);
    assert(paper_layouts.count("LayoutB") == 1);
    assert(layout_a_text >= 1);
    assert(layout_b_text >= 1);

    cadgf_document_destroy(doc);
    return 0;
}
