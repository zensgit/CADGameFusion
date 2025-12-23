# CMake Package Usage

This guide shows how to consume CADGameFusion as a CMake package after installing it.

## Install CADGameFusion
From this repo:

```
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
cmake --install build --prefix /path/to/cadgf
```

## Configure a consumer project
Point CMake to the install prefix:

```
cmake -S . -B build -DCMAKE_PREFIX_PATH=/path/to/cadgf
```

Or set the package directory directly:

```
cmake -S . -B build -DCADGameFusion_DIR=/path/to/cadgf/lib/cmake/CADGameFusion
```

## Minimal CMakeLists.txt

```cmake
cmake_minimum_required(VERSION 3.16)
project(cadgf_consumer C)

find_package(CADGameFusion CONFIG REQUIRED)

add_executable(cadgf_demo main.c)
target_link_libraries(cadgf_demo PRIVATE cadgf::core_c)
```

## Minimal C usage

```c
#include "core/core_c_api.h"

int main() {
    cadgf_document* doc = cadgf_document_create();
    if (!doc) return 1;
    cadgf_document_destroy(doc);
    return 0;
}
```

## Notes
- `cadgf::core_c` is the stable C ABI surface (recommended for external use).
- `cadgf::core` exposes the C++ API and is not ABI-stable across compilers.
- `cadgf::core_headers` exists for include propagation; `cadgf::core` and `cadgf::core_c` already link it.
