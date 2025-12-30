#include "core/core_c_api.h"
#include "plugin_registry.hpp"

#include <cassert>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

static std::string get_layer_name(const cadgf_document* doc, int layer_id) {
    int required = 0;
    if (!cadgf_document_get_layer_name(doc, layer_id, nullptr, 0, &required) || required <= 0) {
        return std::string();
    }
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    if (!cadgf_document_get_layer_name(doc, layer_id, buf.data(), static_cast<int>(buf.size()), &required2)) {
        return std::string();
    }
    return std::string(buf.data());
}

static std::string get_entity_layer_name(const cadgf_document* doc, cadgf_entity_id id) {
    cadgf_entity_info info{};
    if (!cadgf_document_get_entity_info(doc, id, &info)) return std::string();
    return get_layer_name(doc, info.layer_id);
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
    const int32_t importer_count = api->importer_count();
    assert(importer_count > 0);
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
    assert(entity_count == 3);

    cadgf_entity_id line_id = 0;
    cadgf_entity_id nested_line_id = 0;
    cadgf_entity_id circle_id = 0;
    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        assert(cadgf_document_get_entity_id_at(doc, i, &id));
        cadgf_entity_info info{};
        assert(cadgf_document_get_entity_info(doc, id, &info));
        if (info.type == CADGF_ENTITY_TYPE_LINE) {
            const std::string layer_name = get_layer_name(doc, info.layer_id);
            if (layer_name == "LayerBlock") {
                line_id = id;
            } else if (layer_name == "LayerNestedInsert") {
                nested_line_id = id;
            }
        } else if (info.type == CADGF_ENTITY_TYPE_CIRCLE) {
            circle_id = id;
        }
    }

    assert(line_id != 0);
    cadgf_line line{};
    assert(cadgf_document_get_line(doc, line_id, &line));
    assert_near(line.a.x, 5.0);
    assert_near(line.a.y, 5.0);
    assert_near(line.b.x, 5.0);
    assert_near(line.b.y, 9.0);
    assert(get_entity_layer_name(doc, line_id) == "LayerBlock");

    assert(nested_line_id != 0);
    cadgf_line nested_line{};
    assert(cadgf_document_get_line(doc, nested_line_id, &nested_line));
    assert_near(nested_line.a.x, 5.0);
    assert_near(nested_line.a.y, 9.0);
    assert_near(nested_line.b.x, 5.0);
    assert_near(nested_line.b.y, 11.0);
    assert(get_entity_layer_name(doc, nested_line_id) == "LayerNestedInsert");

    assert(circle_id != 0);
    cadgf_circle circle{};
    assert(cadgf_document_get_circle(doc, circle_id, &circle));
    assert_near(circle.center.x, 3.0);
    assert_near(circle.center.y, 7.0);
    assert_near(circle.radius, 1.0);
    assert(get_entity_layer_name(doc, circle_id) == "LayerInsert");

    cadgf_document_destroy(doc);
    return 0;
}
