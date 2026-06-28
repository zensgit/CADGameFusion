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

static const char* kMTextInlineColorDxf = R"DXF(  0
SECTION
  2
TABLES
  0
TABLE
  2
LAYER
 70
1
  0
LAYER
  2
Layer7
 70
0
 62
7
  6
Continuous
  0
ENDTAB
  0
ENDSEC
  0
SECTION
  2
ENTITIES
  0
MTEXT
  5
10
100
AcDbEntity
  8
Layer7
100
AcDbMText
 10
0.0
 20
0.0
 30
0.0
 40
5.0
 41
100.0
 71
1
 72
5
  1
{\C2;INLINE YELLOW}
  0
ENDSEC
  0
EOF
)DXF";

static std::filesystem::path write_fixture() {
    const auto path = std::filesystem::temp_directory_path() /
                      "cadgf_mtext_inline_color.dxf";
    std::ofstream out(path, std::ios::binary | std::ios::trunc);
    out << kMTextInlineColorDxf;
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

static std::string get_text(const cadgf_document* doc, cadgf_entity_id id) {
    cadgf_vec2 pos{};
    double height = 0.0;
    double rotation = 0.0;
    int required = 0;
    if (!cadgf_document_get_text(doc, id, &pos, &height, &rotation, nullptr, 0, &required) || required <= 0) {
        return {};
    }
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    if (!cadgf_document_get_text(doc, id, &pos, &height, &rotation, buf.data(),
                                 static_cast<int>(buf.size()), &required2)) {
        return {};
    }
    return std::string(buf.data());
}

static std::string get_entity_color_source(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    if (!cadgf_document_get_entity_color_source(doc, id, nullptr, 0, &required) || required <= 0) {
        return {};
    }
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    if (!cadgf_document_get_entity_color_source(doc, id, buf.data(),
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
    if (!require(entity_count > 0, "inline-color MTEXT fixture produced no entities")) return 4;

    cadgf_entity_id text_id = 0;
    cadgf_entity_info_v2 text_info{};
    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        if (!require(cadgf_document_get_entity_id_at(doc, i, &id) != 0, "entity id query failed")) return 5;
        cadgf_entity_info_v2 info{};
        if (!require(cadgf_document_get_entity_info_v2(doc, id, &info) != 0, "entity info query failed")) return 6;
        if (info.type == CADGF_ENTITY_TYPE_TEXT) {
            text_id = id;
            text_info = info;
            break;
        }
    }

    if (!require(text_id != 0, "inline-color MTEXT did not import as text")) return 7;
    if (!require(get_text(doc, text_id) == "INLINE YELLOW", "MTEXT formatting code was not stripped")) return 8;
    if (!require(text_info.color == 0xFFFF00u, "MTEXT inline ACI 2 did not override BYLAYER color")) return 9;
    if (!require(get_entity_color_source(doc, text_id) == "INDEX", "inline color source metadata missing")) return 10;

    int aci = 0;
    if (!require(cadgf_document_get_entity_color_aci(doc, text_id, &aci) != 0, "inline color ACI metadata missing")) return 11;
    if (!require(aci == 2, "inline color ACI metadata is not 2")) return 12;

    cadgf_document_destroy(doc);
    return 0;
}
