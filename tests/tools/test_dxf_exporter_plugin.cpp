// test_dxf_exporter_plugin: Smoke test for the DXF exporter plugin.
// Creates a document via C API, exports via DXF exporter plugin, re-imports, verifies entity count.
// Usage: test_dxf_exporter_plugin <exporter_plugin_path> <importer_plugin_path>
#include "core/core_c_api.h"
#include "plugin_registry.hpp"

#include <cmath>
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

#define CHECK_NEAR(val, expected, eps) do { \
    if (std::fabs((val) - (expected)) > (eps)) { \
        std::fprintf(stderr, "FAIL at %s:%d: %f != %f (eps=%f)\n", __FILE__, __LINE__, \
                     (double)(val), (double)(expected), (double)(eps)); \
        return 1; \
    } \
} while(0)

int main(int argc, char** argv) {
    if (argc < 3) {
        std::fprintf(stderr, "Usage: %s <exporter_plugin_path> <importer_plugin_path>\n", argv[0]);
        return 2;
    }

    // --- Step 1: Create a document with 1 line + 1 circle ---
    cadgf_document* doc = cadgf_document_create();
    CHECK(doc);

    cadgf_line ld{};
    ld.a = {0.0, 0.0};
    ld.b = {10.0, 5.0};
    cadgf_entity_id line_id = cadgf_document_add_line(doc, &ld, "test_line", 0);
    CHECK(line_id != 0);

    cadgf_circle cd{};
    cd.center = {3.0, 3.0};
    cd.radius = 2.5;
    cadgf_entity_id circle_id = cadgf_document_add_circle(doc, &cd, "test_circle", 0);
    CHECK(circle_id != 0);

    int count = 0;
    cadgf_document_get_entity_count(doc, &count);
    CHECK(count == 2);

    // --- Step 2: Load exporter plugin and export to DXF ---
    cadgf::PluginRegistry export_registry;
    std::string err;
    if (!export_registry.load_plugin(argv[1], &err)) {
        std::fprintf(stderr, "Exporter plugin load failed: %s\n", err.c_str());
        cadgf_document_destroy(doc);
        return 3;
    }

    const cadgf_exporter_api_v1* exporter = export_registry.find_exporter_by_extension(".dxf");
    CHECK(exporter);

    const std::string tmp_dxf = (fs::temp_directory_path() / "cadgf_exporter_smoke_test.dxf").string();
    cadgf_error_v1 outErr{};
    CHECK(exporter->export_document(doc, tmp_dxf.c_str(), nullptr, &outErr));
    cadgf_document_destroy(doc);

    // --- Step 3: Load importer plugin and re-import ---
    cadgf_document* doc2 = cadgf_document_create();
    CHECK(doc2);

    cadgf::PluginRegistry import_registry;
    if (!import_registry.load_plugin(argv[2], &err)) {
        std::fprintf(stderr, "Importer plugin load failed: %s\n", err.c_str());
        cadgf_document_destroy(doc2);
        fs::remove(tmp_dxf);
        return 3;
    }

    const cadgf_importer_api_v1* importer = import_registry.find_importer_by_extension(".dxf");
    CHECK(importer);

    cadgf_error_v1 importErr{};
    CHECK(importer->import_to_document(doc2, tmp_dxf.c_str(), &importErr));

    // --- Step 4: Verify entity count == 2 ---
    int imported_count = 0;
    cadgf_document_get_entity_count(doc2, &imported_count);
    std::fprintf(stderr, "Imported entities: %d (expected 2)\n", imported_count);
    CHECK(imported_count == 2);

    // --- Step 5: Verify geometry ---
    bool found_line = false, found_circle = false;
    for (int i = 0; i < imported_count; ++i) {
        cadgf_entity_id eid = 0;
        CHECK(cadgf_document_get_entity_id_at(doc2, i, &eid));
        cadgf_entity_info info{};
        CHECK(cadgf_document_get_entity_info(doc2, eid, &info));

        if (info.type == CADGF_ENTITY_TYPE_LINE) {
            cadgf_line l{};
            CHECK(cadgf_document_get_line(doc2, eid, &l));
            CHECK_NEAR(l.a.x, 0.0, 1e-4);
            CHECK_NEAR(l.a.y, 0.0, 1e-4);
            CHECK_NEAR(l.b.x, 10.0, 1e-4);
            CHECK_NEAR(l.b.y, 5.0, 1e-4);
            found_line = true;
        } else if (info.type == CADGF_ENTITY_TYPE_CIRCLE) {
            cadgf_circle c{};
            CHECK(cadgf_document_get_circle(doc2, eid, &c));
            CHECK_NEAR(c.center.x, 3.0, 1e-4);
            CHECK_NEAR(c.center.y, 3.0, 1e-4);
            CHECK_NEAR(c.radius, 2.5, 1e-4);
            found_circle = true;
        }
    }
    CHECK(found_line);
    CHECK(found_circle);

    cadgf_document_destroy(doc2);
    fs::remove(tmp_dxf);

    std::fprintf(stderr, "=== DXF exporter plugin smoke test PASSED ===\n");
    return 0;
}
