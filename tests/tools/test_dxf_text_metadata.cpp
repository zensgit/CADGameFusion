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

    std::string meta_value;
    assert(query_doc_meta_value(doc, "dxf.default_text_height", &meta_value));
    double default_text_height = 0.0;
    assert(parse_meta_double(meta_value, &default_text_height));
    assert_near(default_text_height, 5.0);

    int entity_count = 0;
    assert(cadgf_document_get_entity_count(doc, &entity_count));
    assert(entity_count >= 2);

    int found_text = 0;
    int found_dimension = 0;

    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        assert(cadgf_document_get_entity_id_at(doc, i, &id));
        cadgf_entity_info info{};
        assert(cadgf_document_get_entity_info(doc, id, &info));
        if (info.type != CADGF_ENTITY_TYPE_TEXT) continue;

        cadgf_vec2 text_pos{};
        double text_height = 0.0;
        double text_rotation = 0.0;
        int text_required = 0;
        assert(cadgf_document_get_text(doc, id, &text_pos, &text_height, &text_rotation,
                                       nullptr, 0, &text_required));
        std::vector<char> text_buf(static_cast<size_t>(text_required));
        int text_required2 = 0;
        assert(cadgf_document_get_text(doc, id, &text_pos, &text_height, &text_rotation,
                                       text_buf.data(), static_cast<int>(text_buf.size()), &text_required2));
        const std::string text_value = std::string(text_buf.data());

        std::string kind;
        if (!query_entity_meta_value(doc, id, "text_kind", &kind)) continue;

        if (kind == "text") {
            assert(text_value == "Aligned Text");
            std::string meta;
            int halign = 0;
            int valign = 0;
            int attachment = 0;
            assert(query_entity_meta_value(doc, id, "text_halign", &meta));
            assert(parse_meta_int(meta, &halign));
            assert(query_entity_meta_value(doc, id, "text_valign", &meta));
            assert(parse_meta_int(meta, &valign));
            assert(query_entity_meta_value(doc, id, "text_attachment", &meta));
            assert(parse_meta_int(meta, &attachment));
            assert(halign == 2);
            assert(valign == 2);
            assert(attachment == 6);
            double width_factor = 0.0;
            assert(query_entity_meta_value(doc, id, "text_width_factor", &meta));
            assert(parse_meta_double(meta, &width_factor));
            assert_near(width_factor, 0.8);
            found_text += 1;
        } else if (kind == "dimension") {
            assert(text_value == "123.45");
            std::string meta;
            assert(query_entity_meta_value(doc, id, "source_type", &meta));
            assert(meta == "DIMENSION");
            assert(query_entity_meta_value(doc, id, "edit_mode", &meta));
            assert(meta == "proxy");
            assert(query_entity_meta_value(doc, id, "proxy_kind", &meta));
            assert(meta == "dimension");
            assert(query_entity_meta_value(doc, id, "block_name", &meta));
            assert(meta == "*D0");
            int dim_type = 0;
            assert(query_entity_meta_value(doc, id, "dim_type", &meta));
            assert(parse_meta_int(meta, &dim_type));
            assert(dim_type == 0);
            assert(query_entity_meta_value(doc, id, "dim_style", &meta));
            assert(meta == "STANDARD");
            std::string pos_x;
            std::string pos_y;
            double dim_x = 0.0;
            double dim_y = 0.0;
            assert(query_entity_meta_value(doc, id, "dim_text_pos_x", &pos_x));
            assert(query_entity_meta_value(doc, id, "dim_text_pos_y", &pos_y));
            assert(parse_meta_double(pos_x, &dim_x));
            assert(parse_meta_double(pos_y, &dim_y));
            assert_near(dim_x, 5.0);
            assert_near(dim_y, 2.0);
            assert(query_entity_meta_value(doc, id, "dim_text_rotation", &meta));
            double dim_rot = 0.0;
            assert(parse_meta_double(meta, &dim_rot));
            assert_near(dim_rot, 0.0);
            found_dimension += 1;
        }
    }

    assert(found_text == 1);
    assert(found_dimension == 1);

    cadgf_document_destroy(doc);
    return 0;
}
