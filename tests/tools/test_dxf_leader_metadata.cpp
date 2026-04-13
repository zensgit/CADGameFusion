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
    if (!cadgf_document_get_meta_value(doc, key.c_str(), buf.data(), static_cast<int>(buf.size()), &required2)) {
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

    int entity_count = 0;
    assert(cadgf_document_get_entity_count(doc, &entity_count));
    assert(entity_count == 1);

    cadgf_entity_id id = 0;
    assert(cadgf_document_get_entity_id_at(doc, 0, &id));
    cadgf_entity_info info{};
    assert(cadgf_document_get_entity_info(doc, id, &info));
    assert(info.type == CADGF_ENTITY_TYPE_POLYLINE);

    int point_count = 0;
    assert(cadgf_document_get_polyline_points(doc, id, nullptr, 0, &point_count));
    assert(point_count == 3);
    std::vector<cadgf_vec2> points(static_cast<size_t>(point_count));
    int pc2 = 0;
    assert(cadgf_document_get_polyline_points(doc, id, points.data(), point_count, &pc2));
    assert(points[0].x == 6.0);
    assert(points[0].y == 6.0);
    assert(points[1].x == 18.0);
    assert(points[1].y == 18.0);
    assert(points[2].x == 32.0);
    assert(points[2].y == 12.0);

    assert(get_entity_meta(doc, id, "source_type") == "LEADER");
    assert(get_entity_meta(doc, id, "edit_mode") == "proxy");
    assert(get_entity_meta(doc, id, "proxy_kind") == "leader");
    assert(get_entity_meta(doc, id, "space") == "0");

    cadgf_document_destroy(doc);
    return 0;
}
