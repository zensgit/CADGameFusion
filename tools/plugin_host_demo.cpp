#include <filesystem>
#include <iostream>
#include <string>

#include "plugin_registry.hpp"

namespace fs = std::filesystem;

static std::string to_string(cadgf_string_view v) {
    if (!v.data || v.size <= 0) return std::string();
    return std::string(v.data, static_cast<size_t>(v.size));
}

static void usage(const char* argv0) {
    std::cerr << "Usage: " << argv0 << " <plugin_path> [out_path]\n";
}

int main(int argc, char** argv) {
    if (argc < 2) {
        usage(argv[0]);
        return 1;
    }

    const std::string pluginPath = argv[1];
    const std::string outPath = (argc >= 3) ? argv[2] : "build/out_plugin_export.json";

    cadgf::PluginRegistry registry;
    std::string err;
    if (!registry.load_plugin(pluginPath, &err)) {
        std::cerr << "Failed to load plugin: " << pluginPath << "\n";
        std::cerr << "  Error: " << err << "\n";
        return 1;
    }

    const auto& plugins = registry.plugins();
    const cadgf_plugin_desc_v1 desc = plugins.front().desc;
    std::cout << "Loaded plugin: " << pluginPath << "\n";
    std::cout << "  Name: " << to_string(desc.name) << "\n";
    std::cout << "  Version: " << to_string(desc.version) << "\n";
    std::cout << "  Description: " << to_string(desc.description) << "\n";

    const cadgf_exporter_api_v1* exporter = registry.find_exporter_by_extension("json");
    if (!exporter) {
        auto all = registry.exporters();
        if (!all.empty()) exporter = all.front();
    }
    if (!exporter) {
        std::cerr << "No exporters found in plugin.\n";
        return 1;
    }

    std::cout << "Using exporter: " << to_string(exporter->name()) << " (*." << to_string(exporter->extension()) << ")\n";

    cadgf_document* doc = cadgf_document_create();
    if (!doc) {
        std::cerr << "cadgf_document_create failed\n";
        return 1;
    }

    int layerId = -1;
    cadgf_document_add_layer(doc, "Default", 0xFF0000u, &layerId);

    cadgf_vec2 pts[5] = {{0, 0}, {1, 0}, {1, 1}, {0, 1}, {0, 0}};
    (void)cadgf_document_add_polyline_ex(doc, pts, 5, "square", layerId);

    fs::path out = outPath;
    if (out.has_parent_path()) fs::create_directories(out.parent_path());

    cadgf_export_options_v1 options{};
    options.include_hidden_layers = 1;
    options.include_metadata = 1;
    options.scale = 1.0;
    options.custom_json.data = nullptr;
    options.custom_json.size = 0;

    cadgf_error_v1 outErr{};
    outErr.code = 0;
    outErr.message[0] = 0;

    const int32_t ok = exporter->export_document(doc, outPath.c_str(), &options, &outErr);
    cadgf_document_destroy(doc);

    if (!ok) {
        std::cerr << "export_document failed (code=" << outErr.code << "): " << outErr.message << "\n";
        return 1;
    }

    std::error_code ec;
    const auto size = fs::file_size(out, ec);
    if (ec || size == 0) {
        std::cerr << "Export succeeded but output missing/empty: " << outPath << "\n";
        return 1;
    }

    std::cout << "Wrote: " << outPath << " (" << size << " bytes)\n";
    return 0;
}
