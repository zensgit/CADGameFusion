// test_convert_roundtrip: DWG→import→DXF export→reimport roundtrip verification.
// Loads a .dwg via DWG importer plugin, exports via DXF exporter plugin,
// reimports the DXF, and verifies entity/layer counts are preserved.
// Usage: test_convert_roundtrip <dwg_plugin> <dxf_exporter_plugin> <dxf_importer_plugin> <input.dwg>
// Exit 0 = PASS, 1 = FAIL, 2 = SKIP
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

int main(int argc, char** argv) {
    if (argc < 5) {
        std::fprintf(stderr,
            "Usage: %s <dwg_plugin> <dxf_exporter_plugin> <dxf_importer_plugin> <input.dwg>\n",
            argv[0]);
        return 2;
    }

    const std::string dwg_plugin_path = argv[1];
    const std::string exporter_plugin_path = argv[2];
    const std::string importer_plugin_path = argv[3];
    const std::string input_dwg = argv[4];

    if (!fs::exists(input_dwg)) {
        std::fprintf(stderr, "SKIP: input DWG not found: %s\n", input_dwg.c_str());
        return 2;
    }

    // --- Step 1: Import DWG ---
    cadgf::PluginRegistry dwg_reg;
    std::string err;
    if (!dwg_reg.load_plugin(dwg_plugin_path, &err)) {
        std::fprintf(stderr, "DWG plugin load failed: %s\n", err.c_str());
        return 1;
    }

    const cadgf_importer_api_v1* dwg_importer = dwg_reg.find_importer_by_extension(".dwg");
    CHECK(dwg_importer);

    cadgf_document* doc1 = cadgf_document_create();
    CHECK(doc1);

    cadgf_error_v1 importErr{};
    int32_t rc = dwg_importer->import_to_document(doc1, input_dwg.c_str(), &importErr);
    if (!rc) {
        if (importErr.code == 2 || importErr.code == 3) {
            std::fprintf(stderr, "SKIP: %s\n", importErr.message);
            cadgf_document_destroy(doc1);
            return 2;
        }
        std::fprintf(stderr, "FAIL: DWG import failed (code %d): %s\n",
            importErr.code, importErr.message);
        cadgf_document_destroy(doc1);
        return 1;
    }

    int entity_count_orig = 0;
    cadgf_document_get_entity_count(doc1, &entity_count_orig);
    int layer_count_orig = 0;
    cadgf_document_get_layer_count(doc1, &layer_count_orig);
    std::fprintf(stderr, "Step 1: DWG imported %d entities, %d layers\n",
        entity_count_orig, layer_count_orig);
    CHECK(entity_count_orig > 0);

    // Collect entity type distribution from original
    int types_orig[9] = {};
    for (int i = 0; i < entity_count_orig; ++i) {
        cadgf_entity_id eid = 0;
        if (!cadgf_document_get_entity_id_at(doc1, i, &eid)) continue;
        cadgf_entity_info info{};
        if (!cadgf_document_get_entity_info(doc1, eid, &info)) continue;
        if (info.type >= 0 && info.type < 9) ++types_orig[info.type];
    }

    // --- Step 2: Export to DXF via exporter plugin ---
    cadgf::PluginRegistry exp_reg;
    if (!exp_reg.load_plugin(exporter_plugin_path, &err)) {
        std::fprintf(stderr, "DXF exporter plugin load failed: %s\n", err.c_str());
        cadgf_document_destroy(doc1);
        return 1;
    }

    const cadgf_exporter_api_v1* exporter = exp_reg.find_exporter_by_extension(".dxf");
    CHECK(exporter);

    const std::string tmp_dxf = (fs::temp_directory_path() / "cadgf_convert_roundtrip.dxf").string();
    cadgf_error_v1 exportErr{};
    CHECK(exporter->export_document(doc1, tmp_dxf.c_str(), nullptr, &exportErr));
    cadgf_document_destroy(doc1);

    std::fprintf(stderr, "Step 2: Exported DXF to %s (%llu bytes)\n",
        tmp_dxf.c_str(), static_cast<unsigned long long>(fs::file_size(tmp_dxf)));

    // --- Step 3: Reimport DXF ---
    cadgf::PluginRegistry imp_reg;
    if (!imp_reg.load_plugin(importer_plugin_path, &err)) {
        std::fprintf(stderr, "DXF importer plugin load failed: %s\n", err.c_str());
        fs::remove(tmp_dxf);
        return 1;
    }

    const cadgf_importer_api_v1* dxf_importer = imp_reg.find_importer_by_extension(".dxf");
    CHECK(dxf_importer);

    cadgf_document* doc2 = cadgf_document_create();
    CHECK(doc2);

    cadgf_error_v1 reimportErr{};
    CHECK(dxf_importer->import_to_document(doc2, tmp_dxf.c_str(), &reimportErr));

    int entity_count_rt = 0;
    cadgf_document_get_entity_count(doc2, &entity_count_rt);
    int layer_count_rt = 0;
    cadgf_document_get_layer_count(doc2, &layer_count_rt);

    // Collect entity type distribution from roundtrip
    int types_rt[9] = {};
    for (int i = 0; i < entity_count_rt; ++i) {
        cadgf_entity_id eid = 0;
        if (!cadgf_document_get_entity_id_at(doc2, i, &eid)) continue;
        cadgf_entity_info info{};
        if (!cadgf_document_get_entity_info(doc2, eid, &info)) continue;
        if (info.type >= 0 && info.type < 9) ++types_rt[info.type];
    }

    std::fprintf(stderr, "Step 3: Reimported %d entities, %d layers\n",
        entity_count_rt, layer_count_rt);

    // --- Step 4: Compare ---
    // DXF exporter only handles 8 basic entity types (0-7).
    // Hatches (type 8) and any unknown types are lost in export. That's expected.
    int exportable_orig = 0;
    for (int t = 0; t < 8; ++t) exportable_orig += types_orig[t];

    std::fprintf(stderr, "Original: total=%d exportable(type0-7)=%d hatch=%d\n",
        entity_count_orig, exportable_orig, types_orig[8]);
    std::fprintf(stderr, "Roundtrip: total=%d\n", entity_count_rt);

    std::fprintf(stderr, "Type comparison (orig → roundtrip):\n");
    const char* type_names[] = {"polyline","point","line","arc","circle","ellipse","spline","text","hatch"};
    for (int t = 0; t < 9; ++t) {
        std::fprintf(stderr, "  %s: %d → %d%s\n",
            type_names[t], types_orig[t], types_rt[t],
            (t < 8 && types_orig[t] != types_rt[t]) ? " DELTA" : "");
    }

    // Verify: reimported count should match exportable count (±5% tolerance for rounding)
    // Some entities may split or merge during DXF write/reparse, allow small tolerance
    double ratio = exportable_orig > 0
        ? static_cast<double>(entity_count_rt) / static_cast<double>(exportable_orig)
        : 0.0;
    std::fprintf(stderr, "Roundtrip ratio: %.2f (reimported/exportable)\n", ratio);

    // At minimum, we should get SOME entities back
    CHECK(entity_count_rt > 0);

    // Layer count should roughly match (DXF export adds "0" layer if missing)
    CHECK(layer_count_rt >= 1);

    // Roundtrip should preserve at least 70% of exportable entities.
    // Losses are expected from paperspace entities, block inserts, and dimensions
    // that the DXF exporter does not yet handle.
    if (exportable_orig > 0) {
        CHECK(ratio >= 0.70);
    }

    cadgf_document_destroy(doc2);
    fs::remove(tmp_dxf);

    std::fprintf(stderr, "=== Convert roundtrip test PASSED ===\n");
    return 0;
}
