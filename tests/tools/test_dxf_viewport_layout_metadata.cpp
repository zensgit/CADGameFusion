#include "core/core_c_api.h"
#include "plugin_registry.hpp"

#include <cassert>
#include <cstdio>
#include <string>
#include <vector>

static std::string get_doc_meta_value(const cadgf_document* doc, const std::string& key) {
    int required = 0;
    if (!cadgf_document_get_meta_value(doc, key.c_str(), nullptr, 0, &required) || required <= 0) {
        return std::string();
    }
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    if (!cadgf_document_get_meta_value(doc, key.c_str(), buf.data(),
                                       static_cast<int>(buf.size()), &required2)) {
        return std::string();
    }
    return std::string(buf.data());
}

static std::string get_entity_meta(const cadgf_document* doc, cadgf_entity_id id, const char* suffix) {
    const std::string key = "dxf.entity." + std::to_string(static_cast<unsigned long long>(id)) + "." + suffix;
    return get_doc_meta_value(doc, key);
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

    assert(get_doc_meta_value(doc, "dxf.default_space") == "1");
    assert(get_doc_meta_value(doc, "dxf.viewport.count") == "1");

    const std::string viewport_layout = get_doc_meta_value(doc, "dxf.viewport.0.layout");
    const std::string expected_paper_layout = viewport_layout.empty() ? std::string("PaperSpace") : viewport_layout;
    assert(!expected_paper_layout.empty());

    int entity_count = 0;
    assert(cadgf_document_get_entity_count(doc, &entity_count));
    assert(entity_count == 5);

    int paper_entities = 0;
    int model_entities = 0;
    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        assert(cadgf_document_get_entity_id_at(doc, i, &id));
        const std::string space = get_entity_meta(doc, id, "space");
        if (space == "1") {
            paper_entities += 1;
            assert(get_entity_meta(doc, id, "layout") == expected_paper_layout);
        } else {
            model_entities += 1;
            assert(get_entity_meta(doc, id, "layout").empty());
        }
    }

    assert(paper_entities == 4);
    assert(model_entities == 1);

    cadgf_document_destroy(doc);
    return 0;
}
