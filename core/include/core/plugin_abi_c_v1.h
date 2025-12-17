#pragma once

#include "core/core_c_api.h"

#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

// Plugin entry point export macro
#if defined(_WIN32)
#  define CADGF_PLUGIN_EXPORT __declspec(dllexport)
#elif defined(__GNUC__) || defined(__clang__)
#  define CADGF_PLUGIN_EXPORT __attribute__((visibility("default")))
#else
#  define CADGF_PLUGIN_EXPORT
#endif

#define CADGF_PLUGIN_ABI_V1 1

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

