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

        if (!validate_plugin_tables(plugin, err)) {
            if (plugin.api && plugin.api->shutdown) plugin.api->shutdown();
            plugin.lib.close();
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

    std::vector<const cadgf_importer_api_v1*> importers() const {
        std::vector<const cadgf_importer_api_v1*> out;
        for (const auto& p : plugins_) {
            if (!p.api) continue;
            const int32_t n = p.api->importer_count();
            for (int32_t i = 0; i < n; ++i) {
                const cadgf_importer_api_v1* im = p.api->get_importer(i);
                if (!im) continue;
                if (im->size < static_cast<int32_t>(sizeof(cadgf_importer_api_v1))) continue;
                out.push_back(im);
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

    const cadgf_importer_api_v1* find_importer_by_extension(std::string ext) const {
        if (!ext.empty() && ext[0] == '.') ext.erase(ext.begin());
        to_lower_ascii(ext);

        for (const auto& p : plugins_) {
            if (!p.api) continue;
            const int32_t n = p.api->importer_count();
            for (int32_t i = 0; i < n; ++i) {
                const cadgf_importer_api_v1* im = p.api->get_importer(i);
                if (!im || !im->extensions_csv) continue;
                if (im->size < static_cast<int32_t>(sizeof(cadgf_importer_api_v1))) continue;
                std::string csv = to_string(im->extensions_csv());
                to_lower_ascii(csv);
                if (csv_has_extension(csv, ext)) return im;
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

    static bool csv_has_extension(const std::string& csv, const std::string& ext) {
        if (ext.empty()) return false;
        size_t start = 0;
        while (start < csv.size()) {
            size_t end = csv.find(',', start);
            if (end == std::string::npos) end = csv.size();
            size_t token_start = start;
            while (token_start < end && std::isspace(static_cast<unsigned char>(csv[token_start]))) {
                ++token_start;
            }
            size_t token_end = end;
            while (token_end > token_start &&
                   std::isspace(static_cast<unsigned char>(csv[token_end - 1]))) {
                --token_end;
            }
            if (token_end > token_start) {
                if (csv[token_start] == '.') ++token_start;
                const std::string token = csv.substr(token_start, token_end - token_start);
                if (token == ext) return true;
            }
            if (end == csv.size()) break;
            start = end + 1;
        }
        return false;
    }

    static bool validate_exporter(const cadgf_exporter_api_v1* ex, int32_t index, std::string* err) {
        if (!ex) {
            if (err) *err = "null exporter at index " + std::to_string(index);
            return false;
        }
        if (ex->size < static_cast<int32_t>(sizeof(cadgf_exporter_api_v1))) {
            if (err) *err = "exporter API too small at index " + std::to_string(index);
            return false;
        }
        if (!ex->name || !ex->extension || !ex->file_type_description || !ex->export_document) {
            if (err) *err = "exporter API missing required functions at index " + std::to_string(index);
            return false;
        }
        return true;
    }

    static bool validate_importer(const cadgf_importer_api_v1* im, int32_t index, std::string* err) {
        if (!im) {
            if (err) *err = "null importer at index " + std::to_string(index);
            return false;
        }
        if (im->size < static_cast<int32_t>(sizeof(cadgf_importer_api_v1))) {
            if (err) *err = "importer API too small at index " + std::to_string(index);
            return false;
        }
        if (!im->name || !im->extensions_csv || !im->file_type_description || !im->import_to_document) {
            if (err) *err = "importer API missing required functions at index " + std::to_string(index);
            return false;
        }
        return true;
    }

    static bool validate_plugin_tables(const LoadedPlugin& plugin, std::string* err) {
        const int32_t exp_count = plugin.api->exporter_count();
        if (exp_count < 0) {
            if (err) *err = "exporter_count returned negative";
            return false;
        }
        for (int32_t i = 0; i < exp_count; ++i) {
            const cadgf_exporter_api_v1* ex = plugin.api->get_exporter(i);
            if (!validate_exporter(ex, i, err)) return false;
        }

        const int32_t imp_count = plugin.api->importer_count();
        if (imp_count < 0) {
            if (err) *err = "importer_count returned negative";
            return false;
        }
        for (int32_t i = 0; i < imp_count; ++i) {
            const cadgf_importer_api_v1* im = plugin.api->get_importer(i);
            if (!validate_importer(im, i, err)) return false;
        }
        return true;
    }

    std::vector<LoadedPlugin> plugins_;
};

} // namespace cadgf
