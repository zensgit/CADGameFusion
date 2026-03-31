#include "core/core_c_api.h"
#include "plugin_registry.hpp"

#include <cassert>
#include <cstdio>
#include <string>
#include <vector>

static std::string get_doc_meta_value(const cadgf_document* doc, const std::string& key) {
    int required = 0;
    if (!cadgf_document_get_meta_value(doc, key.c_str(), nullptr, 0, &required) || required <= 0) {
        return std::string();
    }
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    if (!cadgf_document_get_meta_value(doc, key.c_str(), buf.data(),
                                       static_cast<int>(buf.size()), &required2)) {
        return std::string();
    }
    return std::string(buf.data());
}

static std::string get_entity_meta(const cadgf_document* doc, cadgf_entity_id id, const char* suffix) {
    const std::string key = "dxf.entity." + std::to_string(static_cast<unsigned long long>(id)) + "." + suffix;
    return get_doc_meta_value(doc, key);
}

static std::string read_text_value(const cadgf_document* doc, cadgf_entity_id id) {
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

int main(int argc, char** argv) {
    if (argc < 3) {
        std::fprintf(stderr, "Usage: %s <plugin_path> <dxf_path>\n", argv[0]);
        return 2;
    }

    cadgf_document* doc = cadgf_document_create();
    assert(doc);

    cadgf::PluginRegistry registry;
    std::string err;
    if (!registry.load_plugin(argv[1], &err)) {
        std::fprintf(stderr, "Failed to load plugin: %s\n", err.c_str());
        cadgf_document_destroy(doc);
        return 3;
    }

    const auto& plugins = registry.plugins();
    assert(!plugins.empty());
    const cadgf_plugin_api_v1* api = plugins.front().api;
    assert(api);
    const cadgf_importer_api_v1* importer = api->get_importer(0);
    assert(importer && importer->import_to_document);

    cadgf_error_v1 import_err{};
    const int imported = importer->import_to_document(doc, argv[2], &import_err);
    if (!imported) {
        std::fprintf(stderr, "Import failed: %s\n", import_err.message);
        cadgf_document_destroy(doc);
        return 4;
    }

    int entity_count = 0;
    assert(cadgf_document_get_entity_count(doc, &entity_count));
    assert(entity_count == 4);

    cadgf_entity_id attrib_id = 0;
    cadgf_entity_id attrib_line_id = 0;
    cadgf_entity_id attdef_id = 0;
    cadgf_entity_id attdef_line_id = 0;

    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        assert(cadgf_document_get_entity_id_at(doc, i, &id));
        cadgf_entity_info_v2 info{};
        assert(cadgf_document_get_entity_info_v2(doc, id, &info));
        if (info.type == CADGF_ENTITY_TYPE_TEXT) {
            const std::string value = read_text_value(doc, id);
            if (value == "ATTRIB_INSERT_OVERRIDE") {
                attrib_id = id;
            } else if (value.find("ATTDEF_INSERT_DEFAULT") != std::string::npos) {
                attdef_id = id;
            }
        } else if (info.type == CADGF_ENTITY_TYPE_LINE) {
            const std::string block_name = get_entity_meta(doc, id, "block_name");
            if (block_name == "AttribBlock") {
                attrib_line_id = id;
            } else if (block_name == "AttdefBlock") {
                attdef_line_id = id;
            }
        }
    }

    assert(attrib_id != 0);
    assert(attdef_id != 0);
    assert(attrib_line_id != 0);
    assert(attdef_line_id != 0);

    cadgf_entity_info_v2 attrib_info{};
    cadgf_entity_info_v2 attrib_line_info{};
    cadgf_entity_info_v2 attdef_info{};
    cadgf_entity_info_v2 attdef_line_info{};
    assert(cadgf_document_get_entity_info_v2(doc, attrib_id, &attrib_info));
    assert(cadgf_document_get_entity_info_v2(doc, attrib_line_id, &attrib_line_info));
    assert(cadgf_document_get_entity_info_v2(doc, attdef_id, &attdef_info));
    assert(cadgf_document_get_entity_info_v2(doc, attdef_line_id, &attdef_line_info));

    assert(attrib_info.group_id >= 1);
    assert(attdef_info.group_id >= 1);
    assert(attrib_info.group_id == attrib_line_info.group_id);
    assert(attdef_info.group_id == attdef_line_info.group_id);
    assert(attrib_info.group_id != attdef_info.group_id);

    assert(get_entity_meta(doc, attrib_id, "source_type") == "INSERT");
    assert(get_entity_meta(doc, attrib_id, "edit_mode") == "exploded");
    assert(get_entity_meta(doc, attrib_id, "proxy_kind") == "insert");
    assert(get_entity_meta(doc, attrib_id, "block_name") == "AttribBlock");
    assert(get_entity_meta(doc, attrib_id, "text_kind") == "attrib");
    assert(get_entity_meta(doc, attrib_id, "attribute_tag") == "ATTRIB_TAG");
    assert(get_entity_meta(doc, attrib_id, "attribute_flags") == "16");
    assert(get_entity_meta(doc, attrib_id, "attribute_invisible") == "0");
    assert(get_entity_meta(doc, attrib_id, "attribute_constant") == "0");
    assert(get_entity_meta(doc, attrib_id, "attribute_verify") == "0");
    assert(get_entity_meta(doc, attrib_id, "attribute_preset") == "0");
    assert(get_entity_meta(doc, attrib_id, "attribute_lock_position") == "1");

    assert(get_entity_meta(doc, attdef_id, "source_type") == "INSERT");
    assert(get_entity_meta(doc, attdef_id, "edit_mode") == "exploded");
    assert(get_entity_meta(doc, attdef_id, "proxy_kind") == "insert");
    assert(get_entity_meta(doc, attdef_id, "block_name") == "AttdefBlock");
    assert(get_entity_meta(doc, attdef_id, "text_kind") == "attdef");
    assert(get_entity_meta(doc, attdef_id, "attribute_tag") == "ATTDEF_TAG");
    assert(get_entity_meta(doc, attdef_id, "attribute_default") == "ATTDEF_INSERT_DEFAULT");
    assert(get_entity_meta(doc, attdef_id, "attribute_prompt") == "ATTDEF_PROMPT");
    assert(get_entity_meta(doc, attdef_id, "attribute_flags") == "12");
    assert(get_entity_meta(doc, attdef_id, "attribute_invisible") == "0");
    assert(get_entity_meta(doc, attdef_id, "attribute_constant") == "0");
    assert(get_entity_meta(doc, attdef_id, "attribute_verify") == "1");
    assert(get_entity_meta(doc, attdef_id, "attribute_preset") == "1");
    assert(get_entity_meta(doc, attdef_id, "attribute_lock_position") == "0");
    assert(read_text_value(doc, attdef_id) == "ATTDEF_INSERT_DEFAULT");

    cadgf_document_destroy(doc);
    return 0;
}
