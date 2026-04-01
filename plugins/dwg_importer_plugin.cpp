#include "core/plugin_abi_c_v1.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <string>

#ifdef _WIN32
#include <windows.h>
#else
#include <dlfcn.h>
#include <unistd.h>
#include <sys/wait.h>
#endif

namespace fs = std::filesystem;

#ifdef _WIN32
static FILE* cadgf_popen(const char* cmd, const char* mode) {
    return _popen(cmd, mode);
}

static int cadgf_pclose(FILE* pipe) {
    return _pclose(pipe);
}
#else
static FILE* cadgf_popen(const char* cmd, const char* mode) {
    return popen(cmd, mode);
}

static int cadgf_pclose(FILE* pipe) {
    return pclose(pipe);
}
#endif

static cadgf_string_view sv(const char* s) {
    cadgf_string_view v;
    v.data = s;
    v.size = s ? static_cast<int32_t>(std::strlen(s)) : 0;
    return v;
}

static void set_error(cadgf_error_v1* err, int32_t code, const char* msg) {
    if (!err) return;
    err->code = code;
    if (!msg) { err->message[0] = 0; return; }
    std::snprintf(err->message, sizeof(err->message), "%s", msg);
    err->message[sizeof(err->message) - 1] = 0;
}

// --- Locate dwg2dxf on PATH or common locations ---

static std::string find_dwg2dxf() {
    // Check environment override first
    const char* env = std::getenv("CADGF_DWG2DXF");
    if (env && fs::exists(env)) return env;

    // Check PATH via which/where
#ifdef _WIN32
    const char* cmd = "where dwg2dxf.exe 2>nul";
#else
    const char* cmd = "which dwg2dxf 2>/dev/null";
#endif
    FILE* pipe = cadgf_popen(cmd, "r");
    if (pipe) {
        char buf[1024] = {};
        if (std::fgets(buf, sizeof(buf), pipe)) {
            // Trim trailing newline
            size_t len = std::strlen(buf);
            while (len > 0 && (buf[len - 1] == '\n' || buf[len - 1] == '\r')) buf[--len] = 0;
            cadgf_pclose(pipe);
            if (len > 0 && fs::exists(buf)) return buf;
        } else {
            cadgf_pclose(pipe);
        }
    }

    // Common locations
    static const char* candidates[] = {
        "/opt/homebrew/bin/dwg2dxf",
        "/usr/local/bin/dwg2dxf",
        "/usr/bin/dwg2dxf",
        nullptr
    };
    for (int i = 0; candidates[i]; ++i) {
        if (fs::exists(candidates[i])) return candidates[i];
    }
    return {};
}

// --- Locate DXF importer plugin next to this plugin ---

static std::string find_dxf_importer_plugin() {
    // Check environment override first
    const char* env = std::getenv("CADGF_DXF_IMPORTER_PLUGIN");
    if (env && fs::exists(env)) return env;

#ifdef _WIN32
    const char* ext = ".dll";
#elif defined(__APPLE__)
    const char* ext = ".dylib";
#else
    const char* ext = ".so";
#endif

    // Try to find our own plugin path, then look for sibling DXF plugin
#ifndef _WIN32
    Dl_info info{};
    if (dladdr(reinterpret_cast<void*>(&find_dxf_importer_plugin), &info) && info.dli_fname) {
        fs::path self_dir = fs::path(info.dli_fname).parent_path();
        fs::path candidate = self_dir / (std::string("libcadgf_dxf_importer_plugin") + ext);
        if (fs::exists(candidate)) return candidate.string();
        // Also try without lib prefix
        candidate = self_dir / (std::string("cadgf_dxf_importer_plugin") + ext);
        if (fs::exists(candidate)) return candidate.string();
    }
#else
    HMODULE hm = nullptr;
    if (GetModuleHandleExA(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS |
                           GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,
                           reinterpret_cast<LPCSTR>(&find_dxf_importer_plugin), &hm)) {
        char path[MAX_PATH] = {};
        GetModuleFileNameA(hm, path, MAX_PATH);
        fs::path self_dir = fs::path(path).parent_path();
        fs::path candidate = self_dir / (std::string("cadgf_dxf_importer_plugin") + ext);
        if (fs::exists(candidate)) return candidate.string();
    }
#endif
    return {};
}

// --- Run dwg2dxf as subprocess ---

static bool run_dwg2dxf(const std::string& dwg2dxf_path,
                         const std::string& input_dwg,
                         const std::string& output_dxf,
                         cadgf_error_v1* out_err) {
    std::string cmd = "\"" + dwg2dxf_path + "\" -o \"" + output_dxf + "\" \"" + input_dwg + "\" 2>/dev/null";
#ifdef _WIN32
    cmd = "\"" + dwg2dxf_path + "\" -o \"" + output_dxf + "\" \"" + input_dwg + "\" 2>nul";
#endif

    int rc = std::system(cmd.c_str());
    if (rc != 0) {
        set_error(out_err, 10, "dwg2dxf conversion failed");
        return false;
    }
    if (!fs::exists(output_dxf) || fs::file_size(output_dxf) == 0) {
        set_error(out_err, 11, "dwg2dxf produced empty or missing output");
        return false;
    }
    return true;
}

// --- Load DXF importer plugin dynamically and import ---

static bool import_dxf_via_plugin(const std::string& dxf_plugin_path,
                                   cadgf_document* doc,
                                   const std::string& dxf_path,
                                   cadgf_error_v1* out_err) {
#ifdef _WIN32
    HMODULE lib = LoadLibraryA(dxf_plugin_path.c_str());
    if (!lib) {
        set_error(out_err, 20, "failed to load DXF importer plugin");
        return false;
    }
    auto get_api = reinterpret_cast<cadgf_plugin_get_api_v1_fn>(
        GetProcAddress(lib, "cadgf_plugin_get_api_v1"));
#else
    void* lib = dlopen(dxf_plugin_path.c_str(), RTLD_NOW | RTLD_LOCAL);
    if (!lib) {
        set_error(out_err, 20, "failed to load DXF importer plugin");
        return false;
    }
    auto get_api = reinterpret_cast<cadgf_plugin_get_api_v1_fn>(
        dlsym(lib, "cadgf_plugin_get_api_v1"));
#endif

    if (!get_api) {
        set_error(out_err, 21, "DXF plugin missing cadgf_plugin_get_api_v1");
#ifdef _WIN32
        FreeLibrary(lib);
#else
        dlclose(lib);
#endif
        return false;
    }

    const cadgf_plugin_api_v1* api = get_api();
    if (!api || api->abi_version != CADGF_PLUGIN_ABI_V1) {
        set_error(out_err, 22, "DXF plugin ABI mismatch");
#ifdef _WIN32
        FreeLibrary(lib);
#else
        dlclose(lib);
#endif
        return false;
    }

    if (!api->initialize || !api->initialize()) {
        set_error(out_err, 23, "DXF plugin initialize failed");
#ifdef _WIN32
        FreeLibrary(lib);
#else
        dlclose(lib);
#endif
        return false;
    }

    // Find importer for .dxf
    const cadgf_importer_api_v1* importer = nullptr;
    int32_t imp_count = api->importer_count ? api->importer_count() : 0;
    for (int32_t i = 0; i < imp_count; ++i) {
        const cadgf_importer_api_v1* im = api->get_importer(i);
        if (im) { importer = im; break; }
    }

    if (!importer) {
        set_error(out_err, 24, "DXF plugin has no importer");
        if (api->shutdown) api->shutdown();
#ifdef _WIN32
        FreeLibrary(lib);
#else
        dlclose(lib);
#endif
        return false;
    }

    bool ok = importer->import_to_document(doc, dxf_path.c_str(), out_err) != 0;

    if (api->shutdown) api->shutdown();
#ifdef _WIN32
    FreeLibrary(lib);
#else
    dlclose(lib);
#endif
    return ok;
}

// --- Main importer entry point ---

static int32_t importer_import_to_document(cadgf_document* doc,
                                            const char* path_utf8,
                                            cadgf_error_v1* out_err) {
    if (!doc || !path_utf8 || !*path_utf8) {
        set_error(out_err, 1, "invalid args");
        return 0;
    }

    try {
        // 1. Find dwg2dxf
        std::string dwg2dxf = find_dwg2dxf();
        if (dwg2dxf.empty()) {
            set_error(out_err, 2, "dwg2dxf not found (set CADGF_DWG2DXF or install LibreDWG)");
            return 0;
        }

        // 2. Find DXF importer plugin
        std::string dxf_plugin = find_dxf_importer_plugin();
        if (dxf_plugin.empty()) {
            set_error(out_err, 3, "DXF importer plugin not found (set CADGF_DXF_IMPORTER_PLUGIN)");
            return 0;
        }

        // 3. Convert DWG to temporary DXF
        fs::path tmp_dxf = fs::temp_directory_path() / ("cadgf_dwg_import_" +
            std::to_string(reinterpret_cast<uintptr_t>(doc)) + ".dxf");

        if (!run_dwg2dxf(dwg2dxf, path_utf8, tmp_dxf.string(), out_err)) {
            fs::remove(tmp_dxf);
            return 0;
        }

        // 4. Import the DXF via plugin
        bool ok = import_dxf_via_plugin(dxf_plugin, doc, tmp_dxf.string(), out_err);

        // 5. Clean up
        fs::remove(tmp_dxf);

        if (ok) set_error(out_err, 0, "");
        return ok ? 1 : 0;
    } catch (...) {
        set_error(out_err, 99, "exception during DWG import");
        return 0;
    }
}

// --- Plugin ABI boilerplate ---

static cadgf_string_view importer_name(void) { return sv("DWG Importer (via dwg2dxf)"); }
static cadgf_string_view importer_extensions(void) { return sv("dwg"); }
static cadgf_string_view importer_filetype_desc(void) { return sv("AutoCAD DWG (*.dwg)"); }

static const cadgf_exporter_api_v1* get_exporter(int32_t index);
static const cadgf_importer_api_v1* get_importer(int32_t index);

static cadgf_importer_api_v1 g_importer = {
    static_cast<int32_t>(sizeof(cadgf_importer_api_v1)),
    importer_name,
    importer_extensions,
    importer_filetype_desc,
    importer_import_to_document,
};

static cadgf_plugin_desc_v1 plugin_describe_impl(void) {
    cadgf_plugin_desc_v1 d{};
    d.size = static_cast<int32_t>(sizeof(cadgf_plugin_desc_v1));
    d.name = sv("CADGameFusion DWG Importer");
    d.version = sv("0.1.0");
    d.description = sv("DWG importer plugin: converts via dwg2dxf then imports DXF");
    return d;
}

static int32_t plugin_initialize(void) { return 1; }
static void plugin_shutdown(void) {}

static int32_t plugin_exporter_count(void) { return 0; }
static const cadgf_exporter_api_v1* get_exporter(int32_t index) { (void)index; return nullptr; }

static int32_t plugin_importer_count(void) { return 1; }
static const cadgf_importer_api_v1* get_importer(int32_t index) { return (index == 0) ? &g_importer : nullptr; }

static cadgf_plugin_api_v1 g_api = {
    static_cast<int32_t>(sizeof(cadgf_plugin_api_v1)),
    CADGF_PLUGIN_ABI_V1,
    plugin_describe_impl,
    plugin_initialize,
    plugin_shutdown,
    plugin_exporter_count,
    get_exporter,
    plugin_importer_count,
    get_importer,
};

extern "C" CADGF_PLUGIN_EXPORT const cadgf_plugin_api_v1* cadgf_plugin_get_api_v1(void) {
    return &g_api;
}
