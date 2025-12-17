# CADGameFusion Plugin ABI (C Function Table) — Draft v1

This document proposes a **pure C ABI** plugin interface for CADGameFusion to avoid C++ virtual ABI / CRT pitfalls across DLL boundaries
(especially on Windows, and especially for third‑party plugins).

Scope (recommended for v0.6–v0.8):
- Core-level plugins: **Importer / Exporter / Processor** (no UI dependency)
- Editor tools: keep **in-editor** first; if needed later, define a separate **editor-only plugin ABI** (may depend on Qt)

## Goals

- Stable ABI across compilers and build settings (as much as practical)
- No STL, no exceptions, no `new/delete` crossing module boundaries
- Clear versioning and capability discovery
- Host remains in full control of file I/O and document lifetime

## Non-goals

- A fully general “UI tool” plugin ABI in v1 (keep it editor-internal first)
- Zero-copy deep data access across boundaries (prefer query/copy patterns)

---

## 1) Naming, encoding, and string rules

- All strings are **UTF‑8**.
- Any `const char*` returned by plugin APIs must point to **static storage** owned by the plugin and remain valid until plugin unload.
- For variable-length strings from the host (e.g., layer/entity names), prefer **two-call** query APIs (length then copy).

Optional helper type:

```c
typedef struct cadgf_string_view {
    const char* data; /* UTF-8 */
    int32_t     size; /* bytes, may be 0; does not include trailing NUL */
} cadgf_string_view;
```

---

## 2) Version negotiation

### 2.1 Plugin entry point (single symbol)

Each plugin shared library exports exactly one required symbol:

```c
/* Returns NULL if plugin doesn't support this ABI version. */
__attribute__((visibility("default")))
const struct cadgf_plugin_api_v1* cadgf_plugin_get_api_v1(void);
```

On Windows, use `__declspec(dllexport)` instead of visibility attributes.

### 2.2 ABI versioning rules

- `cadgf_plugin_api_v1` is **append-only** within v1 (new fields at the end only).
- Host checks:
  - `api->abi_version == 1`
  - `api->size >= sizeof(cadgf_plugin_api_v1_min)` (minimum required fields for ABI v1)

---

## 3) Ownership and memory management

Hard rules:
- Host must never `free()` / `delete` memory allocated by plugin.
- Plugin must never `free()` / `delete` memory allocated by host.
- Any plugin-created handle must be destroyed via plugin-provided destroy function.

For output buffers:
- Use “host-provided buffer” with capacity (preferred), or
- Use “two-call pattern” for required size, then fill.

---

## 4) Core types (opaque handles)

Plugins should interact with documents through the **C API** only.

```c
typedef struct cadgf_document cadgf_document;
```

In this repo, the canonical header is:

```c
#include "core/plugin_abi_c_v1.h" /* plugin ABI v1 types (includes core_c_api.h, exports cadgf_document + cadgf_* C API) */
```

---

## 5) Exporter API v1 (recommended minimal set)

```c
typedef struct cadgf_export_options_v1 {
    int32_t include_hidden_layers; /* 0/1 */
    int32_t include_metadata;      /* 0/1 */
    double  scale;                /* unit scale */
    cadgf_string_view custom_json; /* optional UTF-8 JSON */
} cadgf_export_options_v1;

typedef struct cadgf_error_v1 {
    int32_t code;
    char    message[256]; /* UTF-8, truncated, NUL-terminated */
} cadgf_error_v1;

typedef struct cadgf_exporter_api_v1 {
    int32_t size; /* sizeof(cadgf_exporter_api_v1) */
    cadgf_string_view (*name)(void);
    cadgf_string_view (*extension)(void);            /* "svg" */
    cadgf_string_view (*file_type_description)(void);/* "SVG (*.svg)" */

    /* Returns 1 on success, 0 on failure. */
    int32_t (*export_document)(
        const cadgf_document* doc,
        const char* path_utf8,
        const cadgf_export_options_v1* options,
        cadgf_error_v1* out_err);
} cadgf_exporter_api_v1;
```

Notes:
- `path_utf8` is UTF‑8. Host is responsible for platform path conversion (UTF‑16 on Windows, etc).
- `out_err` is optional and may be NULL.

---

## 6) Importer API v1 (parallel to exporter)

```c
typedef struct cadgf_importer_api_v1 {
    int32_t size;
    cadgf_string_view (*name)(void);
    cadgf_string_view (*extensions_csv)(void);       /* "dxf,svg" */
    cadgf_string_view (*file_type_description)(void);

    int32_t (*import_to_document)(
        cadgf_document* doc,
        const char* path_utf8,
        cadgf_error_v1* out_err);
} cadgf_importer_api_v1;
```

---

## 7) Plugin API v1 (capability discovery)

```c
typedef struct cadgf_plugin_desc_v1 {
    int32_t size;
    cadgf_string_view name;
    cadgf_string_view version;     /* plugin semantic version */
    cadgf_string_view description;
} cadgf_plugin_desc_v1;

typedef struct cadgf_plugin_api_v1 {
    int32_t size;         /* sizeof(cadgf_plugin_api_v1) */
    int32_t abi_version;  /* must be 1 */

    cadgf_plugin_desc_v1 (*describe)(void);

    /* Called once after load; return 1 success / 0 fail. */
    int32_t (*initialize)(void);
    void    (*shutdown)(void);

    /* Exporters */
    int32_t (*exporter_count)(void);
    const cadgf_exporter_api_v1* (*get_exporter)(int32_t index);

    /* Importers */
    int32_t (*importer_count)(void);
    const cadgf_importer_api_v1* (*get_importer)(int32_t index);
} cadgf_plugin_api_v1;

/* Minimum required prefix for ABI v1 compatibility checks (append-only within v1). */
typedef struct cadgf_plugin_api_v1_min {
    int32_t size;
    int32_t abi_version;

    cadgf_plugin_desc_v1 (*describe)(void);

    int32_t (*initialize)(void);
    void    (*shutdown)(void);

    int32_t (*exporter_count)(void);
    const cadgf_exporter_api_v1* (*get_exporter)(int32_t index);

    int32_t (*importer_count)(void);
    const cadgf_importer_api_v1* (*get_importer)(int32_t index);
} cadgf_plugin_api_v1_min;
```

Contract:
- `get_exporter/get_importer` return pointers to plugin-owned static tables.
- Host must not modify the returned tables.

---

## 8) Loader design (host side)

Recommended:
- Implement a tiny cross-platform `SharedLibrary` wrapper in core/tools:
  - Windows: `LoadLibraryW / GetProcAddress / FreeLibrary`
  - POSIX: `dlopen / dlsym / dlclose`
- Keep Qt out of core. If editor wants to use `QPluginLoader`, do it in `editor/qt` only.

Host flow:
1. `dlopen`/`LoadLibrary`
2. resolve `cadgf_plugin_get_api_v1`
3. validate `api->abi_version/size`
4. call `api->initialize()`
5. register exporters/importers into host registry
6. on shutdown: `api->shutdown()` then unload library

---

## 9) Example (exporter-only plugin skeleton)

```c
static cadgf_string_view sv(const char* s) {
    cadgf_string_view v; v.data = s; v.size = (int32_t)strlen(s); return v;
}

static cadgf_string_view exporter_name(void){ return sv("SVG Exporter"); }
static cadgf_string_view exporter_ext(void){ return sv("svg"); }
static cadgf_string_view exporter_desc(void){ return sv("SVG (*.svg)"); }

static int32_t exporter_export(const cadgf_document* doc, const char* path, const cadgf_export_options_v1* opt, cadgf_error_v1* err){
    (void)doc; (void)opt;
    /* call C API getters and write file */
    (void)path;
    if (err) { err->code = 0; err->message[0] = 0; }
    return 1;
}

static const cadgf_exporter_api_v1 g_exporter = {
    /* size */ (int32_t)sizeof(cadgf_exporter_api_v1),
    exporter_name, exporter_ext, exporter_desc,
    exporter_export
};

static cadgf_plugin_desc_v1 plugin_desc(void){
    cadgf_plugin_desc_v1 d;
    d.size = (int32_t)sizeof(d);
    d.name = sv("SVG Exporter Plugin");
    d.version = sv("1.0.0");
    d.description = sv("Exports CAD documents to SVG");
    return d;
}

static int32_t plugin_init(void){ return 1; }
static void plugin_shutdown(void){}

static int32_t exporter_count(void){ return 1; }
static const cadgf_exporter_api_v1* get_exporter(int32_t idx){ return (idx==0) ? &g_exporter : NULL; }
static int32_t importer_count(void){ return 0; }
static const cadgf_importer_api_v1* get_importer(int32_t idx){ (void)idx; return NULL; }

static const cadgf_plugin_api_v1 g_api = {
    (int32_t)sizeof(cadgf_plugin_api_v1),
    1,
    plugin_desc,
    plugin_init,
    plugin_shutdown,
    exporter_count,
    get_exporter,
    importer_count,
    get_importer
};

const cadgf_plugin_api_v1* cadgf_plugin_get_api_v1(void){ return &g_api; }
```

This repo includes a working minimal example:
- Plugin: `plugins/sample_exporter_plugin.cpp`
- Host demo: `tools/plugin_host_demo.cpp`

Qt editor integration (in this repo):
- Build with `-DBUILD_EDITOR_QT=ON` and target `editor_qt`.
- In the editor: `File -> Plugins -> Load Plugin...`, then `File -> Plugins -> Export via Plugin -> <exporter>`.

---

## 10) Suggested next steps

1) Decide plugin scope for v1: exporter/importer only (recommended).
2) Add C API support needed by exporters/importers (entity enumeration, names, layer visibility).
3) Implement loader + registry in editor/tools.
4) Ship one built-in “SVG exporter plugin” as reference.
