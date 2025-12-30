#include "core/core_c_api.h"
#include "plugin_registry.hpp"

#include <cassert>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <map>
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

static bool layer_exists(const cadgf_document* doc, const std::string& name) {
    int count = 0;
    if (!cadgf_document_get_layer_count(doc, &count)) return false;
    for (int i = 0; i < count; ++i) {
        int layer_id = 0;
        if (!cadgf_document_get_layer_id_at(doc, i, &layer_id)) continue;
        if (get_layer_name(doc, layer_id) == name) return true;
    }
    return false;
}

static bool get_layer_info_by_name(const cadgf_document* doc, const std::string& name,
                                   int* out_layer_id, cadgf_layer_info_v2* out_info) {
    int count = 0;
    if (!cadgf_document_get_layer_count(doc, &count)) return false;
    for (int i = 0; i < count; ++i) {
        int layer_id = 0;
        if (!cadgf_document_get_layer_id_at(doc, i, &layer_id)) continue;
        if (get_layer_name(doc, layer_id) != name) continue;
        if (out_layer_id) *out_layer_id = layer_id;
        if (out_info) {
            if (!cadgf_document_get_layer_info_v2(doc, layer_id, out_info)) return false;
        }
        return true;
    }
    return false;
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
    assert(entity_count == 7);

    std::map<int, int> type_counts;
    cadgf_entity_id polyline_id = 0;
    cadgf_entity_id line_id = 0;
    cadgf_entity_id spline_id = 0;
    cadgf_entity_id text_id = 0;

    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        assert(cadgf_document_get_entity_id_at(doc, i, &id));
        cadgf_entity_info info{};
        assert(cadgf_document_get_entity_info(doc, id, &info));
        type_counts[info.type] += 1;
        if (info.type == CADGF_ENTITY_TYPE_POLYLINE) {
            polyline_id = id;
        } else if (info.type == CADGF_ENTITY_TYPE_LINE) {
            line_id = id;
        } else if (info.type == CADGF_ENTITY_TYPE_SPLINE) {
            spline_id = id;
        } else if (info.type == CADGF_ENTITY_TYPE_TEXT) {
            text_id = id;
        }
    }

    assert(type_counts[CADGF_ENTITY_TYPE_POLYLINE] == 1);
    assert(type_counts[CADGF_ENTITY_TYPE_LINE] == 1);
    assert(type_counts[CADGF_ENTITY_TYPE_CIRCLE] == 1);
    assert(type_counts[CADGF_ENTITY_TYPE_ARC] == 1);
    assert(type_counts[CADGF_ENTITY_TYPE_ELLIPSE] == 1);
    assert(type_counts[CADGF_ENTITY_TYPE_SPLINE] == 1);
    assert(type_counts[CADGF_ENTITY_TYPE_TEXT] == 1);

    assert(polyline_id != 0);
    int required_points = 0;
    assert(cadgf_document_get_polyline_points(doc, polyline_id, nullptr, 0, &required_points));
    assert(required_points == 5);

    assert(line_id != 0);
    int line_type_required = 0;
    assert(cadgf_document_get_entity_line_type(doc, line_id, nullptr, 0, &line_type_required));
    std::vector<char> line_type_buf(static_cast<size_t>(line_type_required));
    int line_type_required2 = 0;
    assert(cadgf_document_get_entity_line_type(doc, line_id, line_type_buf.data(),
                                              static_cast<int>(line_type_buf.size()), &line_type_required2));
    assert(std::strcmp(line_type_buf.data(), "CENTER") == 0);
    cadgf_entity_info_v2 line_info{};
    assert(cadgf_document_get_entity_info_v2(doc, line_id, &line_info));
    assert(line_info.color == 0xFF0000u);
    double line_weight = 0.0;
    double line_scale = 0.0;
    assert(cadgf_document_get_entity_line_weight(doc, line_id, &line_weight));
    assert(cadgf_document_get_entity_line_type_scale(doc, line_id, &line_scale));
    assert_near(line_weight, 0.35);
    assert_near(line_scale, 0.5);

    assert(spline_id != 0);
    int spline_line_type_required = 0;
    assert(cadgf_document_get_entity_line_type(doc, spline_id, nullptr, 0, &spline_line_type_required));
    std::vector<char> spline_line_type_buf(static_cast<size_t>(spline_line_type_required));
    int spline_line_type_required2 = 0;
    assert(cadgf_document_get_entity_line_type(doc, spline_id, spline_line_type_buf.data(),
                                              static_cast<int>(spline_line_type_buf.size()),
                                              &spline_line_type_required2));
    assert(std::strcmp(spline_line_type_buf.data(), "DASHED") == 0);
    double spline_weight = 0.0;
    double spline_scale = 0.0;
    assert(cadgf_document_get_entity_line_weight(doc, spline_id, &spline_weight));
    assert(cadgf_document_get_entity_line_type_scale(doc, spline_id, &spline_scale));
    assert_near(spline_weight, 0.25);
    assert_near(spline_scale, 1.25);

    assert(text_id != 0);
    cadgf_vec2 text_pos{};
    double text_height = 0.0;
    double text_rotation = 0.0;
    int text_required = 0;
    assert(cadgf_document_get_text(doc, text_id, &text_pos, &text_height, &text_rotation,
                                   nullptr, 0, &text_required));
    std::vector<char> text_buf(static_cast<size_t>(text_required));
    int text_required2 = 0;
    assert(cadgf_document_get_text(doc, text_id, &text_pos, &text_height, &text_rotation,
                                   text_buf.data(), static_cast<int>(text_buf.size()), &text_required2));
    assert(std::strcmp(text_buf.data(), "Hello DXF") == 0);

    assert(layer_exists(doc, "LayerA"));
    assert(layer_exists(doc, "LayerB"));
    assert(layer_exists(doc, "LayerC"));
    assert(layer_exists(doc, "LayerD"));
    assert(layer_exists(doc, "LayerText"));

    cadgf_layer_info_v2 layer_info{};
    int layer_id = 0;
    assert(get_layer_info_by_name(doc, "LayerA", &layer_id, &layer_info));
    assert(layer_info.printable == 0);
    assert(layer_info.visible == 1);
    assert(layer_info.locked == 0);
    assert(layer_info.frozen == 0);
    assert(layer_info.color == 0x00FFFFu);

    assert(get_layer_info_by_name(doc, "LayerB", &layer_id, &layer_info));
    assert(layer_info.locked == 1);
    assert(layer_info.frozen == 0);
    assert(layer_info.visible == 1);
    assert(layer_info.color == 0xFFFF00u);

    assert(get_layer_info_by_name(doc, "LayerC", &layer_id, &layer_info));
    assert(layer_info.frozen == 1);
    assert(layer_info.visible == 0);
    assert(layer_info.locked == 0);
    assert(layer_info.color == 0x00FF00u);

    cadgf_document_destroy(doc);
    return 0;
}
