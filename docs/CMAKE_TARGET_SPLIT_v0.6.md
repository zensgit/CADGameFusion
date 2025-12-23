# CMake Target Split Recommendation (v0.6+)

This note proposes a target layout that supports:
- shipping a stable **C ABI** (`core_c`, exporting `cadgf_*` symbols) for Unity/Python/etc
- optionally shipping a C++ API (`core`) with Pimpl (if you decide to publish it)
- avoiding **duplicate core implementations** inside one process

## Problem to avoid: duplicated core code in one process

If:
- `editor_qt` links `core` (C++ shared), and
- `editor_qt` also links a C-ABI wrapper that *statically* embeds core code,

then the process contains **two copies** of the core implementation (and their globals/state),
which is hard to debug and can break identity assumptions.

Recommendation: make `core_c` a thin wrapper that **links to the shared core (`core`)**.

---

## Option A (strongly recommended): `core` shared + `core_c` thin wrapper

### Target graph

```
core_headers (INTERFACE)  [optional]
        |
        v
core (SHARED)  <-- core implementation (Document, Ops2D, Solver, ...)
        ^
        |
core_c (SHARED) <-- C ABI wrapper, links to core (no duplicated impl)
                 (exports `cadgf_*` symbols; keeps `core_*` as compatibility aliases)
```

### Who links what

- Qt editor: **link `core` only** if you do not call the C API; if you need both C++ and C ABI (plugin export), link `core_c` and let it pull `core` transitively (avoid listing both).
- Unity/Python: link/load `core_c` and call `cadgf_*` functions
- Plugins (core-level exporters/importers): link against `core_c` + plugin ABI

### Packaging

- ship both `core` + `core_c` together, OR
- ship only `core_c` and ensure it brings `core` as a runtime dependency.
- install/export targets provide `cadgf::core`, `cadgf::core_c`, and `cadgf::core_headers` for `find_package(CADGameFusion CONFIG)`.

---

## Option B: single shared library exports both C API and C++ API

You can export the C API directly from `core` and drop `core_c` as a separate binary:

```
core (SHARED)
  - exports C++ API (Pimpl)
  - exports C API (extern "C")
```

Pros:
- simplest deployment (one DLL)
- no risk of duplicating implementation

Cons:
- harder to keep “C ABI surface” strictly minimal/clean unless disciplined

---

## Option C (use only when you **must**): static core for embedding

If you really need a fully static link for some use case (e.g., single-file CLI, LTO), keep it as:

```
core_static (STATIC)  <-- same sources, not shipped as plugin boundary
```

Rule:
- do **not** load/link `core_static` in the same process that also loads `core`.

---

## Practical migration notes for this repo

### 1) Stop mixing C++ core and C API in the editor

If `editor_qt` uses both `core::Document` and the C API (`cadgf_*` / legacy `core_*`) in one codepath,
pick one:

- Preferred: editor uses **C++ API only**; C API is for external consumers.
- Alternative: editor uses **C API only** to reduce surface area.

### 2) Keep optional dependencies localized

Aim for these boundaries:
- Earcut only in triangulation module
- Clipper2 only in boolean/offset module
- Eigen only in solver module
- TinyGLTF only in exporter module (optional; when missing, glTF export is disabled but build remains green)

This helps build-time and future extraction.

### 3) Install/export targets cleanly

- Public include dirs should not expose internal headers (e.g., `document_impl.hpp`)
- Prefer an `INTERFACE` headers target (e.g. `core_headers`) for include propagation
