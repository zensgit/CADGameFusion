#include "core/core_c_api.h"
#include "dxf_libdxfrw_adapter.hpp"
#include "libdxfrw.h"

#include <cstdio>
#include <filesystem>
#include <fstream>
#include <string>
#include <vector>

static bool require(bool condition, const char* message) {
    if (condition) return true;
    std::fprintf(stderr, "%s\n", message);
    return false;
}

static const char* kPatternHatchDxf = R"DXF(  0
SECTION
  2
ENTITIES
  0
HATCH
  5
2F
100
AcDbEntity
  8
HATCH
 62
7
100
AcDbHatch
 10
0.0
 20
0.0
 30
0.0
210
0.0
220
0.0
230
1.0
  2
ANSI31
 70
0
 71
0
 91
1
 92
3
 72
0
 73
1
 93
4
 10
0.0
 20
0.0
 10
20.0
 20
0.0
 10
20.0
 20
10.0
 10
0.0
 20
10.0
 97
0
 75
1
 76
1
 52
0.0
 41
1.0
 77
0
 78
1
 53
45.0
 43
0.0
 44
0.0
 45
-2.2450640303
 46
2.2450640303
 79
0
 98
0
  0
ENDSEC
  0
EOF
)DXF";

static std::filesystem::path write_fixture() {
    const auto path = std::filesystem::temp_directory_path() /
                      "cadgf_pattern_hatch_boundary_visibility.dxf";
    std::ofstream out(path, std::ios::binary | std::ios::trunc);
    out << kPatternHatchDxf;
    return path;
}

static cadgf_document* import_dxf(const char* dxf_path) {
    cadgf_document* doc = cadgf_document_create();
    if (!doc) return nullptr;

    CadgfDrwAdapter adapter(doc);
    dxfRW reader(dxf_path);
    if (!reader.read(&adapter, false)) {
        std::fprintf(stderr, "DXF read failed: %s\n", dxf_path);
        cadgf_document_destroy(doc);
        return nullptr;
    }
    adapter.expandUnreferencedBlocks();
    return doc;
}

static std::string get_entity_line_type(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    if (!cadgf_document_get_entity_line_type(doc, id, nullptr, 0, &required) || required <= 0) {
        return {};
    }
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    if (!cadgf_document_get_entity_line_type(doc, id, buf.data(),
                                             static_cast<int>(buf.size()), &required2)) {
        return {};
    }
    return std::string(buf.data());
}

int main() {
    const auto fixture = write_fixture();
    cadgf_document* doc = import_dxf(fixture.string().c_str());
    if (!doc) return 2;

    int entity_count = 0;
    if (!require(cadgf_document_get_entity_count(doc, &entity_count) != 0, "entity count query failed")) return 3;
    if (!require(entity_count > 0, "hatch fixture produced no entities")) return 4;

    int hatch_fill_segments = 0;
    int visible_boundary_polylines = 0;
    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        if (!require(cadgf_document_get_entity_id_at(doc, i, &id) != 0, "entity id query failed")) return 5;
        cadgf_entity_info info{};
        if (!require(cadgf_document_get_entity_info(doc, id, &info) != 0, "entity info query failed")) return 6;
        if (info.type != CADGF_ENTITY_TYPE_POLYLINE) continue;

        const std::string lt = get_entity_line_type(doc, id);
        if (lt == "__HATCH_FILL__") {
            ++hatch_fill_segments;
        } else {
            ++visible_boundary_polylines;
        }
    }

    if (!require(hatch_fill_segments > 0, "pattern hatch produced no visible fill strokes")) return 7;
    if (!require(visible_boundary_polylines == 0,
                 "pattern hatch boundary loop leaked as visible geometry")) return 8;

    cadgf_document_destroy(doc);
    return 0;
}
