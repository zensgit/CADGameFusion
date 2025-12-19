#pragma once

#include <cctype>
#include <string>
#include <vector>

#include "core/plugin_abi_c_v1.h"
#include "shared_library.hpp"

namespace cadgf {

struct LoadedPlugin {
    std::string path;
    SharedLibrary lib;
    const cadgf_plugin_api_v1* api = nullptr;
    cadgf_plugin_desc_v1 desc{};
};

class PluginRegistry {
public:
    PluginRegistry() = default;
    ~PluginRegistry() { unload_all(); }

    PluginRegistry(const PluginRegistry&) = delete;
    PluginRegistry& operator=(const PluginRegistry&) = delete;

    bool load_plugin(const std::string& path, std::string* err) {
        LoadedPlugin plugin;
        plugin.path = path;

        if (!plugin.lib.open(path, err)) return false;

        auto get_api = plugin.lib.symbol<cadgf_plugin_get_api_v1_fn>("cadgf_plugin_get_api_v1", err);
        if (!get_api) return false;

        plugin.api = get_api();
        if (!plugin.api) {
            if (err) *err = "cadgf_plugin_get_api_v1 returned NULL";
            return false;
        }

        if (plugin.api->abi_version != CADGF_PLUGIN_ABI_V1) {
            if (err) *err = "unsupported plugin ABI version";
            return false;
        }

        if (plugin.api->size < static_cast<int32_t>(sizeof(cadgf_plugin_api_v1_min))) {
            if (err) *err = "plugin API table too small";
            return false;
        }

        if (!plugin.api->describe || !plugin.api->initialize || !plugin.api->exporter_count ||
            !plugin.api->get_exporter || !plugin.api->importer_count || !plugin.api->get_importer) {
            if (err) *err = "plugin API table missing required function pointers";
            return false;
        }

        plugin.desc = plugin.api->describe();
        if (plugin.desc.size < static_cast<int32_t>(sizeof(cadgf_plugin_desc_v1))) {
            if (err) *err = "plugin desc table too small";
            return false;
        }

        if (!plugin.api->initialize()) {
            if (err) *err = "plugin initialize() failed";
            return false;
        }

        plugins_.push_back(std::move(plugin));
        return true;
    }

    void unload_all() {
        for (auto it = plugins_.rbegin(); it != plugins_.rend(); ++it) {
            if (it->api && it->api->shutdown) it->api->shutdown();
            it->lib.close();
            it->api = nullptr;
        }
        plugins_.clear();
    }

    const std::vector<LoadedPlugin>& plugins() const { return plugins_; }

    std::vector<const cadgf_exporter_api_v1*> exporters() const {
        std::vector<const cadgf_exporter_api_v1*> out;
        for (const auto& p : plugins_) {
            if (!p.api) continue;
            const int32_t n = p.api->exporter_count();
            for (int32_t i = 0; i < n; ++i) {
                const cadgf_exporter_api_v1* ex = p.api->get_exporter(i);
                if (!ex) continue;
                if (ex->size < static_cast<int32_t>(sizeof(cadgf_exporter_api_v1))) continue;
                out.push_back(ex);
            }
        }
        return out;
    }

    const cadgf_exporter_api_v1* find_exporter_by_extension(std::string ext) const {
        if (!ext.empty() && ext[0] == '.') ext.erase(ext.begin());
        to_lower_ascii(ext);

        for (const auto& p : plugins_) {
            if (!p.api) continue;
            const int32_t n = p.api->exporter_count();
            for (int32_t i = 0; i < n; ++i) {
                const cadgf_exporter_api_v1* ex = p.api->get_exporter(i);
                if (!ex || !ex->extension) continue;
                if (ex->size < static_cast<int32_t>(sizeof(cadgf_exporter_api_v1))) continue;
                std::string e = to_string(ex->extension());
                to_lower_ascii(e);
                if (e == ext) return ex;
            }
        }
        return nullptr;
    }

private:
    static std::string to_string(cadgf_string_view v) {
        if (!v.data || v.size <= 0) return std::string();
        return std::string(v.data, static_cast<size_t>(v.size));
    }

    static void to_lower_ascii(std::string& s) {
        for (char& c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
    }

    std::vector<LoadedPlugin> plugins_;
};

} // namespace cadgf
