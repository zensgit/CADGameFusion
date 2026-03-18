// test_dxf_roundtrip: JSON -> DXF (via dxf_writer) -> DXF import -> verify geometry.
// Usage: test_dxf_roundtrip <plugin_path> <document.json>
#include "core/core_c_api.h"
#include "plugin_registry.hpp"
#include "dxf_writer.hpp"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

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
        std::fprintf(stderr, "Usage: %s <plugin_path> <document.json>\n", argv[0]);
        return 2;
    }

    // --- Step 1: Read source document.json ---
    std::ifstream fin(argv[2]);
    CHECK(fin.good());
    nlohmann::json srcDoc;
    fin >> srcDoc;
    fin.close();

    // --- Step 2: Write DXF via dxf_writer ---
    std::string dxf = dxf_writer::writeDxf(srcDoc);
    CHECK(!dxf.empty());
    std::fprintf(stderr, "DXF: %zu bytes\n", dxf.size());

    const std::string tmp_dxf = (fs::temp_directory_path() / "cadgf_roundtrip_test.dxf").string();
    {
        std::ofstream fout(tmp_dxf);
        CHECK(fout.good());
        fout << dxf;
    }

    // --- Step 3: Import the DXF back via plugin ---
    cadgf_document* doc = cadgf_document_create();
    CHECK(doc);

    cadgf::PluginRegistry registry;
    std::string err;
    if (!registry.load_plugin(argv[1], &err)) {
        std::fprintf(stderr, "Plugin load failed: %s\n", err.c_str());
        cadgf_document_destroy(doc);
        fs::remove(tmp_dxf);
        return 3;
    }

    const cadgf_importer_api_v1* importer = registry.find_importer_by_extension(".dxf");
    CHECK(importer);

    cadgf_error_v1 outErr{};
    CHECK(importer->import_to_document(doc, tmp_dxf.c_str(), &outErr));

    // --- Step 4: Verify entity count ---
    int entity_count = 0;
    cadgf_document_get_entity_count(doc, &entity_count);

    int expected_count = 0;
    for (const auto& ent : srcDoc["entities"]) {
        int type = ent.value("type", -1);
        if (type == 0 || type == 2 || type == 3 || type == 4 || type == 7) ++expected_count;
    }
    std::fprintf(stderr, "Entities: %d imported, %d expected\n", entity_count, expected_count);
    CHECK(entity_count == expected_count);

    // --- Step 5: Verify geometry ---
    int lines = 0, circles = 0, arcs = 0, polylines = 0, texts = 0;

    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id eid = 0;
        CHECK(cadgf_document_get_entity_id_at(doc, i, &eid));
        cadgf_entity_info info{};
        CHECK(cadgf_document_get_entity_info(doc, eid, &info));

        if (info.type == CADGF_ENTITY_TYPE_LINE) {
            cadgf_line ld{};
            CHECK(cadgf_document_get_line(doc, eid, &ld));
            CHECK_NEAR(ld.a.x, 0.0, 1e-4);
            CHECK_NEAR(ld.a.y, 0.0, 1e-4);
            CHECK_NEAR(ld.b.x, 2.0, 1e-4);
            CHECK_NEAR(ld.b.y, 0.0, 1e-4);
            ++lines;
        } else if (info.type == CADGF_ENTITY_TYPE_CIRCLE) {
            cadgf_circle cd{};
            CHECK(cadgf_document_get_circle(doc, eid, &cd));
            CHECK_NEAR(cd.center.x, 3.0, 1e-4);
            CHECK_NEAR(cd.center.y, 3.0, 1e-4);
            CHECK_NEAR(cd.radius, 1.0, 1e-4);
            ++circles;
        } else if (info.type == CADGF_ENTITY_TYPE_ARC) {
            cadgf_arc ad{};
            CHECK(cadgf_document_get_arc(doc, eid, &ad));
            CHECK_NEAR(ad.center.x, 5.0, 1e-4);
            CHECK_NEAR(ad.center.y, 5.0, 1e-4);
            CHECK_NEAR(ad.radius, 2.0, 1e-4);
            CHECK_NEAR(ad.start_angle, 0.0, 1e-4);
            CHECK_NEAR(ad.end_angle, 1.5708, 0.01);
            ++arcs;
        } else if (info.type == CADGF_ENTITY_TYPE_POLYLINE) {
            int pt_count = 0;
            CHECK(cadgf_document_get_polyline_points(doc, eid, nullptr, 0, &pt_count));
            CHECK(pt_count >= 4);
            std::vector<cadgf_vec2> pts(static_cast<size_t>(pt_count));
            int r2 = 0;
            CHECK(cadgf_document_get_polyline_points(doc, eid, pts.data(), pt_count, &r2));
            CHECK_NEAR(pts[0].x, 0.0, 1e-4);
            CHECK_NEAR(pts[0].y, 0.0, 1e-4);
            ++polylines;
        } else if (info.type == CADGF_ENTITY_TYPE_TEXT) {
            cadgf_vec2 pos{};
            double height = 0, rotation = 0;
            char text_buf[256] = {};
            int req = 0;
            CHECK(cadgf_document_get_text(doc, eid, &pos, &height, &rotation,
                                          text_buf, sizeof(text_buf), &req));
            CHECK_NEAR(pos.x, 1.0, 1e-4);
            CHECK_NEAR(pos.y, 4.0, 1e-4);
            CHECK_NEAR(height, 0.5, 1e-4);
            CHECK(std::strcmp(text_buf, "Hello DXF") == 0);
            ++texts;
        }
    }

    std::fprintf(stderr, "Summary: %d lines, %d circles, %d arcs, %d polylines, %d texts\n",
                 lines, circles, arcs, polylines, texts);
    CHECK(lines == 1);
    CHECK(circles == 1);
    CHECK(arcs == 1);
    CHECK(polylines == 1);
    CHECK(texts == 1);

    // --- Step 6: Verify layers ---
    int layer_count = 0;
    cadgf_document_get_layer_count(doc, &layer_count);
    CHECK(layer_count >= 1);

    cadgf_document_destroy(doc);
    fs::remove(tmp_dxf);

    std::fprintf(stderr, "=== DXF round-trip test PASSED ===\n");
    return 0;
}
