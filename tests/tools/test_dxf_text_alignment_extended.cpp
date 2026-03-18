#include "core/core_c_api.h"
#include "plugin_registry.hpp"

#include <cassert>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <vector>

static void assert_near(double value, double expected, double eps = 1e-6) {
    assert(std::fabs(value - expected) <= eps);
}

static std::string read_text_value(const cadgf_document* doc, cadgf_entity_id id) {
    cadgf_vec2 pos{};
    double height = 0.0;
    double rotation = 0.0;
    int required = 0;
    if (!cadgf_document_get_text(doc, id, &pos, &height, &rotation, nullptr, 0, &required) || required <= 0) {
        return {};
    }
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    if (!cadgf_document_get_text(doc, id, &pos, &height, &rotation,
                                 buf.data(), static_cast<int>(buf.size()), &required2)) {
        return {};
    }
    return std::string(buf.data());
}

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

static int meta_int_or(const cadgf_document* doc, const char* key, int fallback = 0) {
    std::string value;
    if (!query_doc_meta_value(doc, key, &value)) return fallback;
    char* end = nullptr;
    const long parsed = std::strtol(value.c_str(), &end, 10);
    if (!end || end == value.c_str()) return fallback;
    return static_cast<int>(parsed);
}

static std::string query_text_kind(const cadgf_document* doc, cadgf_entity_id id) {
    std::string kind;
    const std::string key = "dxf.entity." + std::to_string(static_cast<unsigned long long>(id)) + ".text_kind";
    (void)query_doc_meta_value(doc, key, &kind);
    return kind;
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
    assert(entity_count > 0);

    int found_text_full = 0;
    int found_text_partial = 0;
    int found_attrib_full = 0;
    int found_attdef_partial = 0;
    int found_mtext_partial = 0;

    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        assert(cadgf_document_get_entity_id_at(doc, i, &id));
        cadgf_entity_info info{};
        assert(cadgf_document_get_entity_info(doc, id, &info));
        if (info.type != CADGF_ENTITY_TYPE_TEXT) continue;

        const std::string value = read_text_value(doc, id);
        cadgf_vec2 pos{};
        double height = 0.0;
        double rotation = 0.0;
        int required = 0;
        assert(cadgf_document_get_text(doc, id, &pos, &height, &rotation, nullptr, 0, &required));

        const std::string kind = query_text_kind(doc, id);

        if (value == "TEXT_FULL_ALIGN") {
            assert_near(pos.x, 5.0);
            assert_near(pos.y, 2.0);
            assert(kind == "text");
            found_text_full += 1;
        } else if (value == "TEXT_PARTIAL_ALIGN_X_ONLY") {
            assert_near(pos.x, 10.0);
            assert_near(pos.y, 20.0);
            assert(kind == "text");
            found_text_partial += 1;
        } else if (value == "ATTRIB_FULL_ALIGN") {
            assert_near(pos.x, 300.0);
            assert_near(pos.y, 400.0);
            assert(kind == "attrib");
            found_attrib_full += 1;
        } else if (value == "ATTDEF_PARTIAL_ALIGN_Y_ONLY") {
            assert_near(pos.x, 50.0);
            assert_near(pos.y, 60.0);
            assert(kind == "attdef");
            found_attdef_partial += 1;
        } else if (value == "MTEXT_PARTIAL_ALIGN_X_ONLY") {
            assert_near(pos.x, 70.0);
            assert_near(pos.y, 80.0);
            assert(kind == "mtext");
            found_mtext_partial += 1;
        }
    }

    assert(found_text_full == 1);
    assert(found_text_partial == 1);
    assert(found_attrib_full == 1);
    assert(found_attdef_partial == 1);
    assert(found_mtext_partial == 1);

    // Import attribution meta (strict align policy applies to TEXT/ATTRIB/ATTDEF).
    std::string policy;
    assert(query_doc_meta_value(doc, "dxf.text.align_policy", &policy));
    assert(policy == "strict");
    assert(meta_int_or(doc, "dxf.text.entities_seen", -1) == 5);
    assert(meta_int_or(doc, "dxf.text.entities_emitted", -1) == 5);
    assert(meta_int_or(doc, "dxf.text.skipped_missing_xy", -1) == 0);
    assert(meta_int_or(doc, "dxf.text.align_complete", -1) == 2);
    assert(meta_int_or(doc, "dxf.text.align_partial", -1) == 3);
    assert(meta_int_or(doc, "dxf.text.align_partial_x_only", -1) == 2);
    assert(meta_int_or(doc, "dxf.text.align_partial_y_only", -1) == 1);
    assert(meta_int_or(doc, "dxf.text.align_used", -1) == 2);
    assert(meta_int_or(doc, "dxf.text.nonfinite_values", -1) == 0);

    cadgf_document_destroy(doc);
    return 0;
}

