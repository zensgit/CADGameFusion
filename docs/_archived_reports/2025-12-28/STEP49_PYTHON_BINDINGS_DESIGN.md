# Step 49: Python Bindings - Design

## Goal
Provide an automated Python binding layer for `core_c`, avoiding manual ctypes, and validate it with a smoke test that creates a document and writes JSON.

## Decisions
- Add an optional CMake flag: `-DCADGF_BUILD_PYTHON=ON`.
- Build a `cadgf` Python extension module using `pybind11`.
- Wrap the stable C API (`core_c`) only; C++ APIs remain internal.
- Provide a minimal `Document` wrapper with `add_layer`, `add_polyline`, counts, and `save_json` (JSON format matches the sample exporter structure).

## Build Integration
- `bindings/python/CMakeLists.txt` uses `find_package(Python3 ...)` and `pybind11_add_module`.
- `vcpkg.json` now includes `pybind11` for optional builds.
- CTest `python_cadgf_smoke_run` runs a Python script with `PYTHONPATH`/library paths set by `RunPythonCadgfSmoke.cmake`.

## Files Added/Updated
- `bindings/python/CMakeLists.txt`
- `bindings/python/cadgf_module.cpp`
- `tests/python/test_cadgf_smoke.py`
- `cmake/RunPythonCadgfSmoke.cmake`
- `CMakeLists.txt`
- `vcpkg.json`
