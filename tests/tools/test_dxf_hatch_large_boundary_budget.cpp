#include "core/core_c_api.h"
#include "plugin_registry.hpp"

#include <cassert>
#include <cstdio>
#include <cstdlib>
#include <map>
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

static int meta_int_or(const cadgf_document* doc, const char* key, int fallback = 0) {
    std::string value;
    if (!query_doc_meta_value(doc, key, &value)) return fallback;
    char* end = nullptr;
    const long parsed = std::strtol(value.c_str(), &end, 10);
    if (!end || end == value.c_str()) return fallback;
    return static_cast<int>(parsed);
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

    std::map<int, int> type_counts;
    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        assert(cadgf_document_get_entity_id_at(doc, i, &id));
        cadgf_entity_info info{};
        assert(cadgf_document_get_entity_info(doc, id, &info));
        type_counts[info.type] += 1;
    }

    // Expect hatch boundary polyline + many scanline segments (but no explosion).
    assert(type_counts[CADGF_ENTITY_TYPE_POLYLINE] >= 1);
    const int line_count = type_counts[CADGF_ENTITY_TYPE_LINE];
    assert(line_count > 1000);
    assert(line_count < 50000);

    // Verify compute-budget guard triggered and was attributed in metadata.
    std::string clamped;
    assert(query_doc_meta_value(doc, "dxf.hatch_pattern_clamped", &clamped));
    assert(clamped == "1");

    assert(meta_int_or(doc, "dxf.hatch_pattern_boundary_points_clamped_hatches", -1) == 0);
    assert(meta_int_or(doc, "dxf.hatch_pattern_boundary_points_max", 0) >= 3000);

    assert(meta_int_or(doc, "dxf.hatch_pattern_edge_budget_exhausted_hatches", -1) == 1);
    assert(meta_int_or(doc, "dxf.hatch_pattern_edge_checks", 0) >= 10000000);

    cadgf_document_destroy(doc);
    return 0;
}

