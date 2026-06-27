#include "core/core_c_api.h"
#include "dxf_libdxfrw_adapter.hpp"
#include "libdxfrw.h"

#include <cstdio>

static bool require(bool condition, const char* message) {
    if (condition) return true;
    std::fprintf(stderr, "%s\n", message);
    return false;
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
    if (!require(entity_count > 0, "dimension block produced no entities")) return 5;

    bool saw_green_dimension_line = false;
    bool saw_yellow_dimension_text = false;
    bool saw_bylayer_truewhite_child = false;
    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        if (!require(cadgf_document_get_entity_id_at(doc, i, &id) != 0, "entity id query failed")) return 6;
        cadgf_entity_info_v2 info{};
        if (!require(cadgf_document_get_entity_info_v2(doc, id, &info) != 0, "entity info query failed")) return 7;

        if ((info.type == CADGF_ENTITY_TYPE_LINE || info.type == CADGF_ENTITY_TYPE_POLYLINE) &&
            info.color == 0x00FF00u) {
            saw_green_dimension_line = true;
        }
        if (info.type == CADGF_ENTITY_TYPE_TEXT && info.color == 0xFFFF00u) {
            saw_yellow_dimension_text = true;
        }
        if (info.color == 0u) {
            saw_bylayer_truewhite_child = true;
        }
    }

    if (!require(saw_green_dimension_line,
                 "explicit green child dimension geometry was flattened to the true-white parent layer")) return 8;
    if (!require(saw_yellow_dimension_text,
                 "explicit yellow child dimension text was flattened to the true-white parent layer")) return 9;
    if (!require(saw_bylayer_truewhite_child,
                 "BYLAYER dimension children should still inherit the true-white parent layer")) return 10;

    cadgf_document_destroy(doc);
    return 0;
}
