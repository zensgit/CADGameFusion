// test_dwg_importer_plugin: Smoke test for DWG importer plugin.
// Opens a real .dwg file via the DWG importer plugin, verifies entities were imported.
// Usage: test_dwg_importer_plugin <dwg_plugin_path> <input.dwg>
// Exit 0 = PASS, 1 = FAIL, 2 = SKIP (missing dwg2dxf or DXF plugin)
#include "core/core_c_api.h"
#include "plugin_registry.hpp"

#include <cstdio>
#include <cstring>
#include <filesystem>
#include <string>

namespace fs = std::filesystem;

#define CHECK(cond) do { \
    if (!(cond)) { \
        std::fprintf(stderr, "FAIL at %s:%d: %s\n", __FILE__, __LINE__, #cond); \
        return 1; \
    } \
} while(0)

int main(int argc, char** argv) {
    if (argc < 3) {
        std::fprintf(stderr, "Usage: %s <dwg_plugin_path> <input.dwg>\n", argv[0]);
        return 2;
    }

    const std::string plugin_path = argv[1];
    const std::string input_dwg = argv[2];

    if (!fs::exists(input_dwg)) {
        std::fprintf(stderr, "SKIP: input DWG not found: %s\n", input_dwg.c_str());
        return 2;
    }

    // --- Load DWG importer plugin ---
    cadgf::PluginRegistry registry;
    std::string err;
    if (!registry.load_plugin(plugin_path, &err)) {
        std::fprintf(stderr, "Plugin load failed: %s\n", err.c_str());
        return 1;
    }

    const cadgf_importer_api_v1* importer = registry.find_importer_by_extension(".dwg");
    CHECK(importer);

    // --- Import DWG ---
    cadgf_document* doc = cadgf_document_create();
    CHECK(doc);

    cadgf_error_v1 outErr{};
    int32_t rc = importer->import_to_document(doc, input_dwg.c_str(), &outErr);
    if (!rc) {
        // If dwg2dxf or DXF plugin not found, treat as SKIP
        if (outErr.code == 2 || outErr.code == 3) {
            std::fprintf(stderr, "SKIP: %s\n", outErr.message);
            cadgf_document_destroy(doc);
            return 2;
        }
        std::fprintf(stderr, "FAIL: import failed (code %d): %s\n", outErr.code, outErr.message);
        cadgf_document_destroy(doc);
        return 1;
    }

    // --- Verify something was imported ---
    int entity_count = 0;
    cadgf_document_get_entity_count(doc, &entity_count);
    std::fprintf(stderr, "Imported %d entities from %s\n", entity_count, input_dwg.c_str());
    CHECK(entity_count > 0);

    int layer_count = 0;
    cadgf_document_get_layer_count(doc, &layer_count);
    std::fprintf(stderr, "Imported %d layers\n", layer_count);
    CHECK(layer_count >= 1);

    // --- Print entity type summary ---
    int types[9] = {};
    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id eid = 0;
        if (!cadgf_document_get_entity_id_at(doc, i, &eid)) continue;
        cadgf_entity_info info{};
        if (!cadgf_document_get_entity_info(doc, eid, &info)) continue;
        if (info.type >= 0 && info.type < 9) ++types[info.type];
    }
    std::fprintf(stderr, "Entity types: polyline=%d point=%d line=%d arc=%d circle=%d "
                         "ellipse=%d spline=%d text=%d hatch=%d\n",
                 types[0], types[1], types[2], types[3], types[4],
                 types[5], types[6], types[7], types[8]);

    cadgf_document_destroy(doc);

    std::fprintf(stderr, "=== DWG importer plugin smoke test PASSED ===\n");
    return 0;
}
