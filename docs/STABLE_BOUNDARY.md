# CADGameFusion Stable Boundary

This document defines the **stable API/ABI boundary** for CADGameFusion.
Code within this boundary has strict compatibility guarantees.

## Overview

CADGameFusion exposes two stable C interfaces:

| Header | Purpose | Stability |
|--------|---------|-----------|
| `core/core_c_api.h` | Core library C API | **Stable** |
| `core/plugin_abi_c_v1.h` | Plugin ABI v1 | **Stable** |

All symbols prefixed with `cadgf_*` or `core_*` are part of the stable boundary.

## Stability Guarantees

Within a **major version** (e.g., 1.x.x), we guarantee:

### What Will NOT Change
- Existing struct field order and types
- Existing function signatures
- Existing macro values
- Existing enum values

### What MAY Change
- New fields appended to structs (check `size` field)
- New functions added
- New macros added
- New feature flags added

### What Requires Major Version Bump
- Removing any symbol
- Changing any function signature
- Reordering struct fields
- Changing struct field types

## Version Macros

### Core C API Version

```c
#include "core/core_c_api.h"

// Compile-time version check
#if CADGF_CORE_API_VERSION >= 0x010000  // 1.0.0
    // Use new API features
#endif

// Runtime version check
unsigned int api_ver = cadgf_get_api_version();
int major = (api_ver >> 16) & 0xFF;
int minor = (api_ver >> 8) & 0xFF;
int patch = api_ver & 0xFF;
```

### Plugin ABI Version

```c
#include "core/plugin_abi_c_v1.h"

// Plugin ABI version
#define CADGF_PLUGIN_ABI_VERSION_MAJOR 1
#define CADGF_PLUGIN_ABI_VERSION_MINOR 0
#define CADGF_PLUGIN_ABI_V1 1

// Compile-time compatibility check
#if !CADGF_PLUGIN_CHECK_ABI(1, 0)
    #error "Plugin ABI version mismatch"
#endif
```

## Feature Flags

Query available features at runtime:

```c
unsigned int flags = cadgf_get_feature_flags();

if (flags & CADGF_FEATURE_EARCUT) {
    // Earcut triangulation available
}
if (flags & CADGF_FEATURE_CLIPPER2) {
    // Clipper2 boolean ops available
}
if (flags & CADGF_FEATURE_TINYGLTF) {
    // TinyGLTF export available
}
```

| Flag | Bit | Description |
|------|-----|-------------|
| `CADGF_FEATURE_EARCUT` | 0 | Earcut triangulation |
| `CADGF_FEATURE_CLIPPER2` | 1 | Clipper2 boolean/offset |
| `CADGF_FEATURE_TINYGLTF` | 2 | TinyGLTF export |

## Struct Size Validation

All extensible structs include a `size` field for forward compatibility:

```c
// Host-side plugin loading
const cadgf_plugin_api_v1* api = cadgf_plugin_get_api_v1();
if (api->size < sizeof(cadgf_plugin_api_v1_min)) {
    // Plugin too old, missing required fields
    return CADGF_FAILURE;
}
```

## Best Practices

### For Plugin Authors
1. Always set `size` field to `sizeof(your_struct)`
2. Check host API version before using new features
3. Use `CADGF_PLUGIN_CHECK_ABI` for compile-time checks

### For Host Applications
1. Check `api->size` before accessing optional fields
2. Use feature flags before calling optional functions
3. Never assume a feature exists without checking

## Headers Reference

### core_c_api.h (Stable)

Core document and geometry operations:
- `cadgf_document_*` - Document CRUD
- `cadgf_triangulate_*` - Triangulation
- `cadgf_boolean_*` - Boolean operations
- `cadgf_offset_*` - Offset operations
- `cadgf_get_version()` - Library version string
- `cadgf_get_api_version()` - API version (packed)
- `cadgf_get_feature_flags()` - Feature bitflags

### plugin_abi_c_v1.h (Stable)

Plugin interface structures:
- `cadgf_plugin_api_v1` - Main plugin entry point
- `cadgf_exporter_api_v1` - Exporter plugin interface
- `cadgf_importer_api_v1` - Importer plugin interface
- `cadgf_plugin_desc_v1` - Plugin description
- `cadgf_export_options_v1` - Export options
- `cadgf_error_v1` - Error reporting

## Unstable Components

The following are **NOT** part of the stable boundary:

- C++ headers (any `.hpp` file)
- Internal implementation details
- Editor-specific APIs
- Test utilities
- Build system internals

## Changelog

### API v1.0.0
- Initial stable release
- Core document operations
- Plugin ABI v1
- Triangulation, boolean, offset APIs
