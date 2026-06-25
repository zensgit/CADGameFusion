#include "core/core_c_api.h"
#include "dxf_libdxfrw_adapter.hpp"
#include "libdxfrw.h"

#include <cmath>
#include <cstdio>
#include <string>

static bool require(bool condition, const char* message) {
    if (condition) return true;
    std::fprintf(stderr, "%s\n", message);
    return false;
}

static bool same_segment(const cadgf_line& line, double ax, double ay, double bx, double by) {
    const bool forward =
        std::fabs(line.a.x - ax) < 1e-6 &&
        std::fabs(line.a.y - ay) < 1e-6 &&
        std::fabs(line.b.x - bx) < 1e-6 &&
        std::fabs(line.b.y - by) < 1e-6;
    const bool reverse =
        std::fabs(line.a.x - bx) < 1e-6 &&
        std::fabs(line.a.y - by) < 1e-6 &&
        std::fabs(line.b.x - ax) < 1e-6 &&
        std::fabs(line.b.y - ay) < 1e-6;
    return forward || reverse;
}

static bool same_segment(const cadgf_vec2* points, double ax, double ay, double bx, double by) {
    const bool forward =
        std::fabs(points[0].x - ax) < 1e-6 &&
        std::fabs(points[0].y - ay) < 1e-6 &&
        std::fabs(points[1].x - bx) < 1e-6 &&
        std::fabs(points[1].y - by) < 1e-6;
    const bool reverse =
        std::fabs(points[0].x - bx) < 1e-6 &&
        std::fabs(points[0].y - by) < 1e-6 &&
        std::fabs(points[1].x - ax) < 1e-6 &&
        std::fabs(points[1].y - ay) < 1e-6;
    return forward || reverse;
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

int main(int argc, char** argv) {
    if (argc < 2) {
        std::fprintf(stderr, "Usage: %s <dxf_path>\n", argv[0]);
        return 2;
    }

    cadgf_document* doc = import_dxf(argv[1]);
    if (!doc) return 3;

    int entity_count = 0;
    if (!require(cadgf_document_get_entity_count(doc, &entity_count) != 0, "entity count query failed")) return 4;
    if (!require(entity_count > 0, "referenced dimension block produced no entities")) return 5;

    bool saw_orphan_dimension_block_line = false;
    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        if (!require(cadgf_document_get_entity_id_at(doc, i, &id) != 0, "entity id query failed")) return 6;
        cadgf_entity_info info{};
        if (!require(cadgf_document_get_entity_info(doc, id, &info) != 0, "entity info query failed")) return 7;
        if (info.type == CADGF_ENTITY_TYPE_LINE) {
            cadgf_line line{};
            if (!require(cadgf_document_get_line(doc, id, &line) != 0, "line query failed")) return 8;
            if (same_segment(line, 100.0, 100.0, 200.0, 200.0)) {
                saw_orphan_dimension_block_line = true;
            }
        } else if (info.type == CADGF_ENTITY_TYPE_POLYLINE) {
            int required_points = 0;
            if (!require(cadgf_document_get_polyline_points(doc, id, nullptr, 0, &required_points) != 0,
                         "polyline point count query failed")) return 9;
            if (required_points == 2) {
                cadgf_vec2 points[2]{};
                int required_points2 = 0;
                if (!require(cadgf_document_get_polyline_points(doc, id, points, 2, &required_points2) != 0,
                             "polyline point query failed")) return 10;
                if (same_segment(points, 100.0, 100.0, 200.0, 200.0)) {
                    saw_orphan_dimension_block_line = true;
                }
            }
        }
    }

    if (!require(!saw_orphan_dimension_block_line, "orphan *D dimension block leaked into model geometry")) return 10;

    cadgf_document_destroy(doc);
    return 0;
}
