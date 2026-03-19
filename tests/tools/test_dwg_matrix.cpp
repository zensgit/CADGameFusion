// test_dwg_matrix: Batch smoke test for DWG importer plugin across a matrix of real .dwg files.
// Reads a JSON matrix file (plm_dwg_open_matrix_cases.json) and imports each .dwg via plugin.
// Reports per-case PASS/SKIP/FAIL and summary counts.
// Usage: test_dwg_matrix <dwg_plugin_path> <matrix_json_path>
// Exit 0 = all cases PASS or SKIP, 1 = any FAIL
#include "core/core_c_api.h"
#include "plugin_registry.hpp"
#include "../../tools/third_party/json.hpp"

#include <cstdio>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

namespace fs = std::filesystem;
using json = nlohmann::json;

struct CaseResult {
    std::string id;
    std::string status; // "PASS", "SKIP", "FAIL"
    int entity_count = 0;
    int layer_count = 0;
    std::string message;
};

static CaseResult run_case(const cadgf_importer_api_v1* importer,
                           const std::string& id,
                           const std::string& dwg_path) {
    CaseResult r;
    r.id = id;

    if (!fs::exists(dwg_path)) {
        r.status = "SKIP";
        r.message = "file not found";
        return r;
    }

    cadgf_document* doc = cadgf_document_create();
    if (!doc) {
        r.status = "FAIL";
        r.message = "cadgf_document_create returned null";
        return r;
    }

    cadgf_error_v1 err{};
    int32_t rc = importer->import_to_document(doc, dwg_path.c_str(), &err);
    if (!rc) {
        // dwg2dxf or DXF plugin not found → SKIP
        if (err.code == 2 || err.code == 3) {
            r.status = "SKIP";
            r.message = err.message;
        } else {
            r.status = "FAIL";
            r.message = std::string("import failed (code ") + std::to_string(err.code) + "): " + err.message;
        }
        cadgf_document_destroy(doc);
        return r;
    }

    cadgf_document_get_entity_count(doc, &r.entity_count);
    cadgf_document_get_layer_count(doc, &r.layer_count);

    if (r.entity_count <= 0) {
        r.status = "FAIL";
        r.message = "0 entities imported";
        cadgf_document_destroy(doc);
        return r;
    }

    // Collect entity type distribution
    int types[9] = {};
    for (int i = 0; i < r.entity_count; ++i) {
        cadgf_entity_id eid = 0;
        if (!cadgf_document_get_entity_id_at(doc, i, &eid)) continue;
        cadgf_entity_info info{};
        if (!cadgf_document_get_entity_info(doc, eid, &info)) continue;
        if (info.type >= 0 && info.type < 9) ++types[info.type];
    }

    char buf[256];
    std::snprintf(buf, sizeof(buf),
        "%d entities, %d layers (poly=%d pt=%d ln=%d arc=%d cir=%d ell=%d spl=%d txt=%d hat=%d)",
        r.entity_count, r.layer_count,
        types[0], types[1], types[2], types[3], types[4],
        types[5], types[6], types[7], types[8]);
    r.message = buf;
    r.status = "PASS";

    cadgf_document_destroy(doc);
    return r;
}

int main(int argc, char** argv) {
    if (argc < 3) {
        std::fprintf(stderr, "Usage: %s <dwg_plugin_path> <matrix_json_path>\n", argv[0]);
        return 2;
    }

    const std::string plugin_path = argv[1];
    const std::string matrix_path = argv[2];

    // Load matrix JSON
    if (!fs::exists(matrix_path)) {
        std::fprintf(stderr, "FAIL: matrix JSON not found: %s\n", matrix_path.c_str());
        return 2;
    }
    std::ifstream ifs(matrix_path);
    json matrix;
    try {
        ifs >> matrix;
    } catch (const std::exception& e) {
        std::fprintf(stderr, "FAIL: parse matrix JSON: %s\n", e.what());
        return 2;
    }

    if (!matrix.contains("cases") || !matrix["cases"].is_array()) {
        std::fprintf(stderr, "FAIL: matrix JSON missing 'cases' array\n");
        return 2;
    }

    // Load DWG plugin
    cadgf::PluginRegistry registry;
    std::string err;
    if (!registry.load_plugin(plugin_path, &err)) {
        std::fprintf(stderr, "Plugin load failed: %s\n", err.c_str());
        return 1;
    }

    const cadgf_importer_api_v1* importer = registry.find_importer_by_extension(".dwg");
    if (!importer) {
        std::fprintf(stderr, "FAIL: DWG plugin has no .dwg importer\n");
        return 1;
    }

    // Run all cases
    std::vector<CaseResult> results;
    int pass = 0, skip = 0, fail = 0;

    for (const auto& c : matrix["cases"]) {
        std::string id = c.value("id", "unknown");
        std::string dwg_path = c.value("input_dwg", "");

        CaseResult r = run_case(importer, id, dwg_path);
        std::fprintf(stderr, "  [%s] %s: %s\n",
            r.status.c_str(), r.id.c_str(), r.message.c_str());

        if (r.status == "PASS") ++pass;
        else if (r.status == "SKIP") ++skip;
        else ++fail;

        results.push_back(std::move(r));
    }

    // Summary
    int total = static_cast<int>(results.size());
    std::fprintf(stderr, "\n=== DWG Matrix Summary: %d total, %d PASS, %d SKIP, %d FAIL ===\n",
        total, pass, skip, fail);

    if (fail > 0) {
        std::fprintf(stderr, "FAILED cases:\n");
        for (const auto& r : results) {
            if (r.status == "FAIL") {
                std::fprintf(stderr, "  - %s: %s\n", r.id.c_str(), r.message.c_str());
            }
        }
    }

    // Exit 0 if no failures (SKIPs are OK)
    return fail > 0 ? 1 : 0;
}
