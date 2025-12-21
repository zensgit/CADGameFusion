# API Stability Policy

## 1. Stable Boundary

The stable binary boundary for CADGameFusion is the **C ABI** exported by `core_c`:

- Preferred external symbols: `cadgf_*`
- Header: `core/include/core/core_c_api.h`
- Dynamic library: `core_c` (`core_c.dll`, `libcore_c.dylib`, `libcore_c.so`)

This boundary is intended for engines, tools, and external languages (Unity, Python, CLI).

## 2. Internal (Non-stable) APIs

The C++ interfaces under `core/include/core/*.hpp` (for example `core::Document`) are
**internal** source-level APIs. They are **not** ABI-stable across DLL/DSO boundaries,
compilers, or standard library versions.

If you need to use C++ helpers, keep them in-process with the same compiler/runtime
and do not export them as a public SDK.

## 3. ABI Evolution Rules

- The C API is **append-only** within a major ABI version.
- Breaking changes, if unavoidable, require a new ABI version or a major release bump.
- Use `cadgf_get_abi_version()` for ABI-level compatibility checks.
- Use `cadgf_get_version()` for release/version reporting.
- Use `cadgf_get_feature_flags()` for compile-time capability checks.

Current feature flags:
- `CADGF_FEATURE_EARCUT` (bit 0)
- `CADGF_FEATURE_CLIPPER2` (bit 1)

## 4. Plugin ABI

The plugin ABI (`core/include/core/plugin_abi_c_v1.h`) follows the same rule:
append-only within v1, validated by version/size checks.

## 5. Practical Guidance

- Use `cadgf_*` for all external integrations.
- Treat `core_*` symbols as compatibility aliases only.
- Do not rely on C++ ABI stability across shared library boundaries, especially on Windows.

## 6. Host Integration Checklist

When embedding `core_c` (CLI tools, Unity, Python, etc.), perform these checks at startup:

1. Call `cadgf_get_abi_version()` and compare with the SDK's `CADGF_ABI_VERSION` constant. Refuse to load or warn loudly when they differ.
2. Call `cadgf_get_version()` for logging/diagnostics only (ABI compatibility must rely on the numeric ABI level).
3. Call `cadgf_get_feature_flags()` and gate feature usage (e.g., Earcut-only triangulation or Clipper2 offsets).
4. If any check fails, stop the host or fall back to a safe/no-op path instead of running with mismatched binaries.

Example (pseudo C):

```c
if (cadgf_get_abi_version() != CADGF_ABI_VERSION) {
    fprintf(stderr, "cadgf ABI mismatch. Rebuild host against matching core_c.\n");
    return EXIT_FAILURE;
}
unsigned int feats = cadgf_get_feature_flags();
if ((feats & CADGF_FEATURE_CLIPPER2) == 0) {
    disableOffsetMenu();
}
```
