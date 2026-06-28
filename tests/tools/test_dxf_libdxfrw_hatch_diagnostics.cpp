#include "core/core_c_api.h"
#include "dxf_libdxfrw_adapter.hpp"
#include "libdxfrw.h"

#include <cmath>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <string>

static bool require(bool condition, const char* message) {
    if (condition) return true;
    std::fprintf(stderr, "%s\n", message);
    return false;
}

static bool near(double a, double b, double eps = 1e-6) {
    return std::abs(a - b) <= eps;
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
                      "cadgf_pattern_hatch_diagnostics.dxf";
    std::ofstream out(path, std::ios::binary | std::ios::trunc);
    out << kPatternHatchDxf;
    return path;
}

int main() {
    const auto fixture = write_fixture();
    cadgf_document* doc = cadgf_document_create();
    if (!require(doc != nullptr, "document allocation failed")) return 2;

    CadgfDrwAdapter adapter(doc);
    dxfRW reader(fixture.string().c_str());
    if (!require(reader.read(&adapter, false), "DXF read failed")) {
        cadgf_document_destroy(doc);
        return 3;
    }
    adapter.expandUnreferencedBlocks();

    const auto& records = adapter.hatchPatternDiagnostics();
    if (!require(records.size() == 1, "expected exactly one hatch diagnostic record")) return 4;
    const auto& hatch = records.front();
    if (!require(hatch.patternName == "ANSI31", "pattern name not captured")) return 5;
    if (!require(hatch.layerName == "HATCH", "layer name not captured")) return 6;
    if (!require(!hatch.inBlock, "fixture hatch should be model-space")) return 7;
    if (!require(!hatch.solid, "fixture hatch should be a pattern hatch")) return 8;
    if (!require(hatch.hatchStyle == 1, "hatch style not captured")) return 9;
    if (!require(hatch.hatchPattern == 1, "hatch pattern type not captured")) return 10;
    if (!require(hatch.doubleFlag == 0, "double flag not captured")) return 11;
    if (!require(hatch.defLines == 1, "definition-line count not captured")) return 12;
    if (!require(hatch.loopCount == 1, "loop count not captured")) return 13;
    if (!require(hatch.usableLoopCount == 1, "usable loop count not captured")) return 14;
    if (!require(hatch.familyCount == 1, "family count not captured")) return 15;
    if (!require(hatch.emittedSegments > 0, "emitted hatch segment count not captured")) return 16;
    if (!require(near(hatch.angleDeg, 0.0), "angle not captured")) return 17;
    if (!require(near(hatch.scale, 1.0), "scale not captured")) return 18;
    if (!require(near(hatch.spacing, 3.175), "effective spacing not captured")) return 19;
    if (!require(!hatch.spacingCapped, "spacing should not be capped for fixture")) return 20;
    if (!require(near(hatch.bboxWidth, 20.0), "bbox width not captured")) return 21;
    if (!require(near(hatch.bboxHeight, 10.0), "bbox height not captured")) return 22;
    if (!require(hatch.colorAci == 7, "ACI color not captured")) return 23;
    if (!require(hatch.colorRgb == 0xFFFFFF, "RGB color not captured")) return 24;

    cadgf_document_destroy(doc);
    return 0;
}
