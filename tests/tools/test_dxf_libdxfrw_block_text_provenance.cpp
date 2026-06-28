#include "core/core_c_api.h"
#include "dxf_libdxfrw_adapter.hpp"
#include "libdxfrw.h"

#include <cassert>
#include <cstdio>
#include <filesystem>
#include <fstream>
#include <map>
#include <string>
#include <vector>

static const char* kBlockTextProvenanceDxf = R"DXF(  0
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
0
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
BLOCKS
  0
BLOCK
  8
0
  2
TitleBlock
 70
0
 10
0.0
 20
0.0
 30
0.0
  3
TitleBlock
  0
TEXT
  8
0
 10
1.0
 20
2.0
 30
0.0
 40
2.5
  1
Static text
 50
0.0
  0
MTEXT
  8
0
 10
1.0
 20
8.0
 30
0.0
 40
2.5
 41
60.0
 71
1
  1
Static mtext
  0
ATTRIB
  8
0
 10
1.0
 20
14.0
 30
0.0
 40
2.5
  2
ATTR_TAG
  1
Attribute value
 50
0.0
  0
ATTDEF
  8
0
 10
1.0
 20
20.0
 30
0.0
 40
2.5
  2
ATTDEF_TAG
  1
Attdef default
  3
Attdef prompt
 50
0.0
  0
ENDBLK
  0
ENDSEC
  0
SECTION
  2
ENTITIES
  0
INSERT
  8
0
  2
TitleBlock
 10
100.0
 20
200.0
 30
0.0
 41
1.0
 42
1.0
 50
0.0
  0
ENDSEC
  0
EOF
)DXF";

static std::filesystem::path write_fixture() {
    const auto path = std::filesystem::temp_directory_path() /
                      "cadgf_block_text_provenance.dxf";
    std::ofstream out(path, std::ios::binary | std::ios::trunc);
    out << kBlockTextProvenanceDxf;
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

static std::string get_doc_meta_value(const cadgf_document* doc, const std::string& key) {
    int required = 0;
    if (!cadgf_document_get_meta_value(doc, key.c_str(), nullptr, 0, &required) || required <= 0) {
        return {};
    }
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    if (!cadgf_document_get_meta_value(doc, key.c_str(), buf.data(),
                                       static_cast<int>(buf.size()), &required2)) {
        return {};
    }
    return std::string(buf.data());
}

static std::string get_entity_meta(const cadgf_document* doc, cadgf_entity_id id, const char* suffix) {
    const std::string key = "dxf.entity." +
        std::to_string(static_cast<unsigned long long>(id)) + "." + suffix;
    return get_doc_meta_value(doc, key);
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
    if (!cadgf_document_get_text(doc, id, &pos, &height, &rotation,
                                 buf.data(), static_cast<int>(buf.size()), &required2)) {
        return {};
    }
    return std::string(buf.data());
}

int main() {
    const auto fixture = write_fixture();
    cadgf_document* doc = import_dxf(fixture.string().c_str());
    assert(doc);

    int entity_count = 0;
    assert(cadgf_document_get_entity_count(doc, &entity_count));
    assert(entity_count == 4);

    std::map<std::string, cadgf_entity_id> by_text;
    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        assert(cadgf_document_get_entity_id_at(doc, i, &id));
        cadgf_entity_info_v2 info{};
        assert(cadgf_document_get_entity_info_v2(doc, id, &info));
        assert(info.type == CADGF_ENTITY_TYPE_TEXT);
        by_text[get_text(doc, id)] = id;
    }

    assert(by_text.count("Static text") == 1);
    assert(by_text.count("Static mtext") == 1);
    assert(by_text.count("Attribute value") == 1);
    assert(by_text.count("Attdef default") == 1);

    const cadgf_entity_id text_id = by_text["Static text"];
    const cadgf_entity_id mtext_id = by_text["Static mtext"];
    const cadgf_entity_id attrib_id = by_text["Attribute value"];
    const cadgf_entity_id attdef_id = by_text["Attdef default"];

    assert(get_entity_meta(doc, text_id, "source_type") == "INSERT");
    assert(get_entity_meta(doc, text_id, "block_name") == "TitleBlock");
    assert(get_entity_meta(doc, text_id, "text_kind") == "text");

    assert(get_entity_meta(doc, mtext_id, "source_type") == "INSERT");
    assert(get_entity_meta(doc, mtext_id, "block_name") == "TitleBlock");
    assert(get_entity_meta(doc, mtext_id, "text_kind") == "mtext");

    assert(get_entity_meta(doc, attrib_id, "source_type") == "INSERT");
    assert(get_entity_meta(doc, attrib_id, "block_name") == "TitleBlock");
    assert(get_entity_meta(doc, attrib_id, "text_kind") == "attrib");
    assert(get_entity_meta(doc, attrib_id, "attribute_tag") == "ATTR_TAG");

    assert(get_entity_meta(doc, attdef_id, "source_type") == "INSERT");
    assert(get_entity_meta(doc, attdef_id, "block_name") == "TitleBlock");
    assert(get_entity_meta(doc, attdef_id, "text_kind") == "attdef");
    assert(get_entity_meta(doc, attdef_id, "attribute_tag") == "ATTDEF_TAG");

    cadgf_document_destroy(doc);
    return 0;
}
