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

static unsigned int get_entity_color(const cadgf_document* doc, cadgf_entity_id id) {
    cadgf_entity_info_v2 info{};
    assert(cadgf_document_get_entity_info_v2(doc, id, &info));
    return info.color;
}

static double get_entity_line_scale(const cadgf_document* doc, cadgf_entity_id id) {
    double scale = 0.0;
    assert(cadgf_document_get_entity_line_type_scale(doc, id, &scale));
    return scale;
}

static std::string get_entity_line_type(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    assert(cadgf_document_get_entity_line_type(doc, id, nullptr, 0, &required));
    assert(required > 0);
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    assert(cadgf_document_get_entity_line_type(doc, id, buf.data(),
                                               static_cast<int>(buf.size()), &required2));
    return std::string(buf.data());
}

static double get_entity_line_weight(const cadgf_document* doc, cadgf_entity_id id) {
    double weight = 0.0;
    assert(cadgf_document_get_entity_line_weight(doc, id, &weight));
    return weight;
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
    assert(entity_count == 13);

    cadgf_entity_id line_id = 0;
    cadgf_entity_id nested_line_id = 0;
    cadgf_entity_id byblock_fallback_id = 0;
    cadgf_entity_id bylayer_id = 0;
    cadgf_entity_id explicit_id = 0;
    cadgf_entity_id byblock_insert_scale_id = 0;
    cadgf_entity_id polyline_id = 0;
    cadgf_entity_id arc_id = 0;
    cadgf_entity_id text_id = 0;
    cadgf_entity_id spline_id = 0;
    cadgf_entity_id missing_layer_id = 0;
    cadgf_entity_id layer0_id = 0;
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
            } else if (layer_name == "LayerByblockNoInsert") {
                byblock_fallback_id = id;
            } else if (layer_name == "LayerBylayer") {
                bylayer_id = id;
            } else if (layer_name == "LayerExplicit") {
                explicit_id = id;
            } else if (layer_name == "LayerByblockInsertScale") {
                byblock_insert_scale_id = id;
            } else if (layer_name == "LayerMissing") {
                missing_layer_id = id;
            } else if (layer_name == "0") {
                layer0_id = id;
            }
        } else if (info.type == CADGF_ENTITY_TYPE_POLYLINE) {
            const std::string layer_name = get_layer_name(doc, info.layer_id);
            if (layer_name == "LayerPolyByblock") {
                polyline_id = id;
            }
        } else if (info.type == CADGF_ENTITY_TYPE_ARC) {
            const std::string layer_name = get_layer_name(doc, info.layer_id);
            if (layer_name == "LayerArcBylayer") {
                arc_id = id;
            }
        } else if (info.type == CADGF_ENTITY_TYPE_TEXT) {
            const std::string layer_name = get_layer_name(doc, info.layer_id);
            if (layer_name == "LayerTextByblock") {
                text_id = id;
            }
        } else if (info.type == CADGF_ENTITY_TYPE_SPLINE) {
            const std::string layer_name = get_layer_name(doc, info.layer_id);
            if (layer_name == "LayerSplineBylayer") {
                spline_id = id;
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
    cadgf_entity_info_v2 line_info{};
    assert(cadgf_document_get_entity_info_v2(doc, line_id, &line_info));
    assert(line_info.color == 0xFF0000u);
    assert(get_entity_line_type(doc, line_id) == "CENTER");
    assert_near(get_entity_line_weight(doc, line_id), 0.5);
    assert_near(get_entity_line_scale(doc, line_id), 0.25);

    assert(nested_line_id != 0);
    cadgf_line nested_line{};
    assert(cadgf_document_get_line(doc, nested_line_id, &nested_line));
    assert_near(nested_line.a.x, 5.0);
    assert_near(nested_line.a.y, 9.0);
    assert_near(nested_line.b.x, 5.0);
    assert_near(nested_line.b.y, 11.0);
    assert(get_entity_layer_name(doc, nested_line_id) == "LayerNestedInsert");
    cadgf_entity_info_v2 nested_info{};
    assert(cadgf_document_get_entity_info_v2(doc, nested_line_id, &nested_info));
    assert(nested_info.color == 0x00FF00u);
    assert(get_entity_line_type(doc, nested_line_id) == "DASHED");
    assert_near(get_entity_line_weight(doc, nested_line_id), 0.2);
    assert_near(get_entity_line_scale(doc, nested_line_id), 0.75);

    assert(byblock_fallback_id != 0);
    cadgf_line byblock_fallback_line{};
    assert(cadgf_document_get_line(doc, byblock_fallback_id, &byblock_fallback_line));
    assert(get_entity_layer_name(doc, byblock_fallback_id) == "LayerByblockNoInsert");
    assert(get_entity_line_type(doc, byblock_fallback_id) == "DASHDOT");
    assert_near(get_entity_line_weight(doc, byblock_fallback_id), 0.7);
    assert(get_entity_color(doc, byblock_fallback_id) == 0xFFFF00u);
    assert_near(get_entity_line_scale(doc, byblock_fallback_id), 1.5);

    assert(bylayer_id != 0);
    cadgf_line bylayer_line{};
    assert(cadgf_document_get_line(doc, bylayer_id, &bylayer_line));
    assert(get_entity_layer_name(doc, bylayer_id) == "LayerBylayer");
    assert(get_entity_line_type(doc, bylayer_id) == "CENTER2");
    assert_near(get_entity_line_weight(doc, bylayer_id), 0.25);
    assert(get_entity_color(doc, bylayer_id) == 0x00FFFFu);
    assert_near(get_entity_line_scale(doc, bylayer_id), 0.6);

    assert(explicit_id != 0);
    cadgf_line explicit_line{};
    assert(cadgf_document_get_line(doc, explicit_id, &explicit_line));
    assert(get_entity_layer_name(doc, explicit_id) == "LayerExplicit");
    assert(get_entity_line_type(doc, explicit_id) == "HIDDEN");
    assert_near(get_entity_line_weight(doc, explicit_id), 0.8);
    assert(get_entity_color(doc, explicit_id) == 0x0000FFu);
    assert_near(get_entity_line_scale(doc, explicit_id), 2.5);

    assert(byblock_insert_scale_id != 0);
    cadgf_line byblock_insert_scale_line{};
    assert(cadgf_document_get_line(doc, byblock_insert_scale_id, &byblock_insert_scale_line));
    assert(get_entity_layer_name(doc, byblock_insert_scale_id) == "LayerByblockInsertScale");
    assert(get_entity_line_type(doc, byblock_insert_scale_id) == "DASHDOT");
    assert_near(get_entity_line_weight(doc, byblock_insert_scale_id), 0.9);
    assert(get_entity_color(doc, byblock_insert_scale_id) == 0xFF0000u);
    assert_near(get_entity_line_scale(doc, byblock_insert_scale_id), 1.3);

    assert(polyline_id != 0);
    assert(get_entity_layer_name(doc, polyline_id) == "LayerPolyByblock");
    assert(get_entity_line_type(doc, polyline_id) == "PHANTOM");
    assert_near(get_entity_line_weight(doc, polyline_id), 0.9);
    assert(get_entity_color(doc, polyline_id) == 0xFF00FFu);
    assert_near(get_entity_line_scale(doc, polyline_id), 0.4);

    assert(arc_id != 0);
    cadgf_arc arc{};
    assert(cadgf_document_get_arc(doc, arc_id, &arc));
    assert(get_entity_layer_name(doc, arc_id) == "LayerArcBylayer");
    assert(get_entity_line_type(doc, arc_id) == "PHANTOM2");
    assert_near(get_entity_line_weight(doc, arc_id), 0.6);
    assert(get_entity_color(doc, arc_id) == 0xC0C0C0u);
    assert_near(get_entity_line_scale(doc, arc_id), 0.9);

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
    assert(std::strcmp(text_buf.data(), "TextByBlock") == 0);
    assert(get_entity_layer_name(doc, text_id) == "LayerTextByblock");
    assert(get_entity_line_type(doc, text_id) == "DASHDOTX");
    assert_near(get_entity_line_weight(doc, text_id), 0.3);
    assert(get_entity_color(doc, text_id) == 0xFF0000u);
    assert_near(get_entity_line_scale(doc, text_id), 2.2);

    assert(spline_id != 0);
    assert(get_entity_layer_name(doc, spline_id) == "LayerSplineBylayer");
    assert(get_entity_line_type(doc, spline_id) == "CENTERX");
    assert_near(get_entity_line_weight(doc, spline_id), 0.45);
    assert(get_entity_color(doc, spline_id) == 0xFFFFFFu);
    assert_near(get_entity_line_scale(doc, spline_id), 0.8);

    assert(missing_layer_id != 0);
    cadgf_line missing_line{};
    assert(cadgf_document_get_line(doc, missing_layer_id, &missing_line));
    assert(get_entity_layer_name(doc, missing_layer_id) == "LayerMissing");
    assert(get_entity_line_type(doc, missing_layer_id).empty());
    assert_near(get_entity_line_weight(doc, missing_layer_id), 0.0);
    assert_near(get_entity_line_scale(doc, missing_layer_id), 0.0);
    assert(get_entity_color(doc, missing_layer_id) == 0u);

    assert(layer0_id != 0);
    cadgf_line layer0_line{};
    assert(cadgf_document_get_line(doc, layer0_id, &layer0_line));
    assert(get_entity_layer_name(doc, layer0_id) == "0");
    assert(get_entity_line_type(doc, layer0_id) == "HIDDEN2");
    assert_near(get_entity_line_weight(doc, layer0_id), 0.55);
    assert_near(get_entity_line_scale(doc, layer0_id), 1.7);
    assert(get_entity_color(doc, layer0_id) == 0x808080u);

    assert(circle_id != 0);
    cadgf_circle circle{};
    assert(cadgf_document_get_circle(doc, circle_id, &circle));
    assert_near(circle.center.x, 3.0);
    assert_near(circle.center.y, 7.0);
    assert_near(circle.radius, 1.0);
    assert(get_entity_layer_name(doc, circle_id) == "LayerInsert");
    cadgf_entity_info_v2 circle_info{};
    assert(cadgf_document_get_entity_info_v2(doc, circle_id, &circle_info));
    assert(line_info.group_id >= 1);
    assert(circle_info.group_id == line_info.group_id);
    assert(nested_info.group_id >= 1);
    assert(nested_info.group_id != line_info.group_id);

    cadgf_document_destroy(doc);
    return 0;
}
