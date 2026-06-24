// Layer-2 root-fix regression (CJK font resolution).
//
// An imported empty-style DXF TEXT must NOT carry the macOS-only "STFangsong"
// family. The importer now leaves the family empty (see resolveFontFamily in
// plugins/dxf_libdxfrw_adapter.cpp) so the render layer's defaultTextFamily()
// resolves a portable 仿宋/song family (e.g. Noto Serif CJK SC on a Linux
// render host) instead of silently falling back to DejaVu Sans — the
// regression the VemCAD render-image golden gate caught.
//
// Loads the DXF importer plugin, imports a single empty-style CJK TEXT, and
// asserts the resolved family (carried on the entity name as
// "<family>\x1f<widthFactor>") contains no "STFangsong".
#include "core/core_c_api.h"
#include "plugin_registry.hpp"

#include <cassert>
#include <cstdio>
#include <string>
#include <vector>

int main(int argc, char** argv) {
    if (argc < 3) {
        std::fprintf(stderr, "Usage: %s <plugin_path> <dxf_path>\n", argv[0]);
        return 2;
    }

    const std::string plugin_path = argv[1];
    const std::string dxf_path = argv[2];

    cadgf_document* doc = cadgf_document_create();
    assert(doc);

    cadgf::PluginRegistry registry;
    std::string err;
    if (!registry.load_plugin(plugin_path, &err)) {
        std::fprintf(stderr, "Failed to load plugin: %s\n", err.c_str());
        cadgf_document_destroy(doc);
        return 3;
    }

    const auto& plugins = registry.plugins();
    assert(!plugins.empty());
    const cadgf_plugin_api_v1* api = plugins.front().api;
    assert(api);
    const int32_t importer_count = api->importer_count();
    assert(importer_count > 0);
    const cadgf_importer_api_v1* importer = api->get_importer(0);
    assert(importer && importer->import_to_document);

    cadgf_error_v1 import_err{};
    const int imported = importer->import_to_document(doc, dxf_path.c_str(), &import_err);
    if (!imported) {
        std::fprintf(stderr, "Import failed: %s\n", import_err.message);
        cadgf_document_destroy(doc);
        return 4;
    }

    // Find the single imported TEXT entity.
    int entity_count = 0;
    assert(cadgf_document_get_entity_count(doc, &entity_count));
    cadgf_entity_id text_id = 0;
    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id id = 0;
        assert(cadgf_document_get_entity_id_at(doc, i, &id));
        cadgf_entity_info info{};
        assert(cadgf_document_get_entity_info(doc, id, &info));
        if (info.type == CADGF_ENTITY_TYPE_TEXT) text_id = id;
    }
    assert(text_id != 0);

    // The importer carries the resolved family on the entity name as
    // "<family>\x1f<widthFactor>" (the width factor is omitted when ~1). Read it
    // with the standard two-call buffer pattern; an empty name is also fine — it
    // just means "no family", which the render layer fills via defaultTextFamily().
    std::string name;
    int required = 0;
    if (cadgf_document_get_entity_name(doc, text_id, nullptr, 0, &required) && required > 0) {
        std::vector<char> buf(static_cast<size_t>(required));
        int required2 = 0;
        if (cadgf_document_get_entity_name(doc, text_id, buf.data(),
                                           static_cast<int>(buf.size()), &required2)) {
            if (!buf.empty() && buf.back() == 0) buf.pop_back();
            name.assign(buf.begin(), buf.end());
        }
    }

    // Primary regression check — robust to the width-factor encoding and to an
    // empty name: the macOS-only STFangsong must NOT be baked into the model.
    // (Before the fix the name was "STFangsong\x1f0.8" and this fails.)
    assert(name.find("STFangsong") == std::string::npos);

    // Secondary: the family portion (before the \x1f width-factor separator) is
    // empty, i.e. the importer deferred family selection to the render layer.
    std::string family = name;
    const auto sep = family.find('\x1f');
    if (sep != std::string::npos) family = family.substr(0, sep);
    assert(family.empty());

    // Emit the name byte-count so the CI log visibly shows a non-empty name was
    // exercised (the substring check would also pass vacuously on an empty name).
    std::printf("test_dxf_text_default_family OK (entity name = %zu bytes, no STFangsong;"
                " family deferred to render layer)\n", name.size());
    cadgf_document_destroy(doc);
    return 0;
}
