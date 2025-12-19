#pragma once

#include "core/core_c_api.h"

#include <stdint.h>

/*
 * ============================================================================
 * CADGameFusion Plugin ABI (C Function Table) - Stable Boundary
 * ============================================================================
 * This header defines the stable C plugin ABI for CADGameFusion.
 * Plugins implementing this ABI are binary-compatible across:
 *   - Different compilers (MSVC, GCC, Clang)
 *   - Different C++ standard library versions
 *   - Different build configurations (Release/Debug)
 *
 * ABI v1 guarantees:
 *   - cadgf_plugin_api_v1 is append-only (new fields at end only)
 *   - Host checks api->size >= sizeof(cadgf_plugin_api_v1_min)
 *   - Existing struct layouts are frozen within v1
 *
 * See docs/STABLE_BOUNDARY.md for full documentation.
 * ============================================================================
 */

#ifdef __cplusplus
extern "C" {
#endif

/* Plugin entry point export macro */
#if defined(_WIN32)
#  define CADGF_PLUGIN_EXPORT __declspec(dllexport)
#elif defined(__GNUC__) || defined(__clang__)
#  define CADGF_PLUGIN_EXPORT __attribute__((visibility("default")))
#else
#  define CADGF_PLUGIN_EXPORT
#endif

/* Plugin ABI version (increment major for breaking changes, minor for additions) */
#define CADGF_PLUGIN_ABI_VERSION_MAJOR 1
#define CADGF_PLUGIN_ABI_VERSION_MINOR 0
#define CADGF_PLUGIN_ABI_V1 1

/* Packed version for runtime comparison */
#define CADGF_PLUGIN_ABI_VERSION \
    ((CADGF_PLUGIN_ABI_VERSION_MAJOR << 8) | CADGF_PLUGIN_ABI_VERSION_MINOR)

/* Compile-time check: ensure plugin targets compatible ABI */
#define CADGF_PLUGIN_CHECK_ABI(host_major, host_minor) \
    ((host_major) == CADGF_PLUGIN_ABI_VERSION_MAJOR && (host_minor) >= CADGF_PLUGIN_ABI_VERSION_MINOR)

typedef struct cadgf_string_view {
    const char* data; // UTF-8
    int32_t size;     // bytes (no trailing NUL)
} cadgf_string_view;

typedef struct cadgf_export_options_v1 {
    int32_t include_hidden_layers; // 0/1
    int32_t include_metadata;      // 0/1
    double scale;
    cadgf_string_view custom_json; // optional UTF-8 JSON
} cadgf_export_options_v1;

typedef struct cadgf_error_v1 {
    int32_t code;
    char message[256]; // UTF-8, truncated, NUL-terminated
} cadgf_error_v1;

typedef struct cadgf_exporter_api_v1 {
    int32_t size; // sizeof(cadgf_exporter_api_v1)

    cadgf_string_view (*name)(void);
    cadgf_string_view (*extension)(void);
    cadgf_string_view (*file_type_description)(void);

    int32_t (*export_document)(
        const cadgf_document* doc,
        const char* path_utf8,
        const cadgf_export_options_v1* options,
        cadgf_error_v1* out_err);
} cadgf_exporter_api_v1;

typedef struct cadgf_importer_api_v1 {
    int32_t size; // sizeof(cadgf_importer_api_v1)

    cadgf_string_view (*name)(void);
    cadgf_string_view (*extensions_csv)(void); // "dxf,svg"
    cadgf_string_view (*file_type_description)(void);

    int32_t (*import_to_document)(
        cadgf_document* doc,
        const char* path_utf8,
        cadgf_error_v1* out_err);
} cadgf_importer_api_v1;

typedef struct cadgf_plugin_desc_v1 {
    int32_t size; // sizeof(cadgf_plugin_desc_v1)
    cadgf_string_view name;
    cadgf_string_view version;
    cadgf_string_view description;
} cadgf_plugin_desc_v1;

typedef struct cadgf_plugin_api_v1 {
    int32_t size;        // sizeof(cadgf_plugin_api_v1)
    int32_t abi_version; // must be CADGF_PLUGIN_ABI_V1

    cadgf_plugin_desc_v1 (*describe)(void);

    int32_t (*initialize)(void); // 1 success / 0 fail
    void (*shutdown)(void);

    int32_t (*exporter_count)(void);
    const cadgf_exporter_api_v1* (*get_exporter)(int32_t index);

    int32_t (*importer_count)(void);
    const cadgf_importer_api_v1* (*get_importer)(int32_t index);
} cadgf_plugin_api_v1;

// Minimum required prefix for ABI v1 compatibility checks (append-only within v1).
typedef struct cadgf_plugin_api_v1_min {
    int32_t size;
    int32_t abi_version;

    cadgf_plugin_desc_v1 (*describe)(void);

    int32_t (*initialize)(void);
    void (*shutdown)(void);

    int32_t (*exporter_count)(void);
    const cadgf_exporter_api_v1* (*get_exporter)(int32_t index);

    int32_t (*importer_count)(void);
    const cadgf_importer_api_v1* (*get_importer)(int32_t index);
} cadgf_plugin_api_v1_min;

typedef const cadgf_plugin_api_v1* (*cadgf_plugin_get_api_v1_fn)(void);

#ifdef __cplusplus
}
#endif

