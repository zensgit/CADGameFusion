// test_dxf_roundtrip_styles: JSON -> DXF (via dxf_writer) -> DXF import -> verify style & layer properties.
// Usage: test_dxf_roundtrip_styles <plugin_path> <document.json>
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

static std::string query_line_type(const cadgf_document* doc, cadgf_entity_id id) {
    int req = 0;
    if (!cadgf_document_get_entity_line_type(doc, id, nullptr, 0, &req) || req <= 0) return {};
    std::vector<char> buf(static_cast<size_t>(req));
    if (!cadgf_document_get_entity_line_type(doc, id, buf.data(), req, &req)) return {};
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return std::string(buf.begin(), buf.end());
}

static std::string query_layer_name(const cadgf_document* doc, int layer_id) {
    int req = 0;
    if (!cadgf_document_get_layer_name(doc, layer_id, nullptr, 0, &req) || req <= 0) return {};
    std::vector<char> buf(static_cast<size_t>(req));
    if (!cadgf_document_get_layer_name(doc, layer_id, buf.data(), req, &req)) return {};
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return std::string(buf.begin(), buf.end());
}

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

    const std::string tmp_dxf = (fs::temp_directory_path() / "cadgf_roundtrip_styles_test.dxf").string();
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

    // --- Step 4: Verify layer flags ---
    int layer_count = 0;
    cadgf_document_get_layer_count(doc, &layer_count);
    std::fprintf(stderr, "Layer count: %d\n", layer_count);

    bool found_layerC = false, found_layerB = false;
    for (int i = 0; i < layer_count; ++i) {
        int layer_id = 0;
        CHECK(cadgf_document_get_layer_id_at(doc, i, &layer_id));
        std::string name = query_layer_name(doc, layer_id);

        cadgf_layer_info_v2 info{};
        cadgf_document_get_layer_info_v2(doc, layer_id, &info);

        if (name == "LayerC") {
            found_layerC = true;
            std::fprintf(stderr, "LayerC: frozen=%d visible=%d\n", info.frozen, info.visible);
            CHECK(info.frozen == 1);
            CHECK(info.visible == 0);
        } else if (name == "LayerB") {
            found_layerB = true;
            std::fprintf(stderr, "LayerB: locked=%d\n", info.locked);
            CHECK(info.locked == 1);
        }
    }
    CHECK(found_layerC);
    CHECK(found_layerB);

    // --- Step 5: Verify entity style properties ---
    int entity_count = 0;
    cadgf_document_get_entity_count(doc, &entity_count);

    bool checked_polyline = false, checked_line = false, checked_spline = false;

    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id eid = 0;
        CHECK(cadgf_document_get_entity_id_at(doc, i, &eid));
        cadgf_entity_info info{};
        CHECK(cadgf_document_get_entity_info(doc, eid, &info));

        if (info.type == CADGF_ENTITY_TYPE_POLYLINE) {
            // Expect: line_type=DASHED, line_weight=0.5, color_aci=4
            std::string lt = query_line_type(doc, eid);
            std::fprintf(stderr, "POLYLINE line_type=%s\n", lt.c_str());
            CHECK(lt == "DASHED");

            double lw = 0.0;
            CHECK(cadgf_document_get_entity_line_weight(doc, eid, &lw));
            std::fprintf(stderr, "POLYLINE line_weight=%f\n", lw);
            CHECK_NEAR(lw, 0.5, 0.01);

            double lts = 0.0;
            CHECK(cadgf_document_get_entity_line_type_scale(doc, eid, &lts));
            std::fprintf(stderr, "POLYLINE line_type_scale=%f\n", lts);
            CHECK_NEAR(lts, 2.0, 0.01);

            int aci = 0;
            if (cadgf_document_get_entity_color_aci(doc, eid, &aci)) {
                std::fprintf(stderr, "POLYLINE color_aci=%d\n", aci);
                CHECK(aci == 4);
            }

            checked_polyline = true;
        } else if (info.type == CADGF_ENTITY_TYPE_LINE) {
            // Expect: line_type=CENTER, line_weight=0.35
            std::string lt = query_line_type(doc, eid);
            std::fprintf(stderr, "LINE line_type=%s\n", lt.c_str());
            CHECK(lt == "CENTER");

            double lw = 0.0;
            CHECK(cadgf_document_get_entity_line_weight(doc, eid, &lw));
            std::fprintf(stderr, "LINE line_weight=%f\n", lw);
            CHECK_NEAR(lw, 0.35, 0.01);

            double lts = 0.0;
            CHECK(cadgf_document_get_entity_line_type_scale(doc, eid, &lts));
            std::fprintf(stderr, "LINE line_type_scale=%f\n", lts);
            CHECK_NEAR(lts, 0.5, 0.01);

            // TRUECOLOR: entity color should be 0xFF0000 (red)
            cadgf_entity_info_v2 info2{};
            cadgf_document_get_entity_info_v2(doc, eid, &info2);
            std::fprintf(stderr, "LINE color=0x%06X\n", info2.color);
            CHECK(info2.color == 0xFF0000);

            checked_line = true;
        } else if (info.type == CADGF_ENTITY_TYPE_SPLINE) {
            // Expect: line_type=DASHED, line_weight=0.25, line_type_scale=1.25
            std::string lt = query_line_type(doc, eid);
            std::fprintf(stderr, "SPLINE line_type=%s\n", lt.c_str());
            CHECK(lt == "DASHED");

            double lw = 0.0;
            CHECK(cadgf_document_get_entity_line_weight(doc, eid, &lw));
            std::fprintf(stderr, "SPLINE line_weight=%f\n", lw);
            CHECK_NEAR(lw, 0.25, 0.01);

            double lts = 0.0;
            CHECK(cadgf_document_get_entity_line_type_scale(doc, eid, &lts));
            std::fprintf(stderr, "SPLINE line_type_scale=%f\n", lts);
            CHECK_NEAR(lts, 1.25, 0.01);

            checked_spline = true;
        }
    }

    CHECK(checked_polyline);
    CHECK(checked_line);
    CHECK(checked_spline);

    cadgf_document_destroy(doc);
    fs::remove(tmp_dxf);

    std::fprintf(stderr, "=== DXF round-trip styles test PASSED ===\n");
    return 0;
}
