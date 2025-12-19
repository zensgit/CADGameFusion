cmake_minimum_required(VERSION 3.16)

# Core library
add_library(core SHARED
    src/geometry2d.cpp
    src/document.cpp
    src/commands.cpp
    src/ops2d.cpp
    src/solver.cpp
)

target_include_directories(core PUBLIC include)
target_compile_features(core PUBLIC cxx_std_17)

# Export all symbols on Windows to keep C++ API usable without per-symbol declspec.
# This avoids having to mark every C++ symbol as dllexport/dllimport at this stage.
set_target_properties(core PROPERTIES WINDOWS_EXPORT_ALL_SYMBOLS ON)

# Optional: Compiler warnings
if(MSVC)
    target_compile_options(core PRIVATE /W3)
else()
    target_compile_options(core PRIVATE -Wall -Wextra -Wno-unused-parameter)
endif()

# Optional dependencies (don't fail if not found)
find_path(EARCUT_INCLUDE_DIR NAMES mapbox/earcut.hpp)
if(EARCUT_INCLUDE_DIR)
    target_compile_definitions(core PUBLIC USE_EARCUT)
    target_include_directories(core PRIVATE ${EARCUT_INCLUDE_DIR})
    message(STATUS "Earcut found")
else()
    message(STATUS "Earcut not found - triangulation will use stub")
endif()

# TinyGLTF (header-only, for glTF export)
find_path(TINYGLTF_INCLUDE_DIR NAMES tiny_gltf.h)
if(TINYGLTF_INCLUDE_DIR)
    target_include_directories(core PRIVATE ${TINYGLTF_INCLUDE_DIR})
    message(STATUS "TinyGLTF found")
else()
    message(STATUS "TinyGLTF not found - glTF export will not be available")
endif()

# Clipper2 (boolean/offset). Prefer pkg-config; fall back to find_library.
find_path(CLIPPER2_INCLUDE_DIR NAMES clipper2/clipper.h)
if(CLIPPER2_INCLUDE_DIR)
    set(CADGF_CLIPPER2_LINK_TARGET "")

    # Try pkg-config for linking
    find_package(PkgConfig QUIET)
    if(PkgConfig_FOUND)
        pkg_check_modules(Clipper2 QUIET IMPORTED_TARGET Clipper2)
        if(Clipper2_FOUND)
            set(CADGF_CLIPPER2_LINK_TARGET PkgConfig::Clipper2)
            message(STATUS "Clipper2 found (pkg-config)")
        endif()
    endif()

    # Fallback: locate library directly (needed on Windows where pkg-config is uncommon)
    if(NOT CADGF_CLIPPER2_LINK_TARGET)
        find_library(CLIPPER2_LIBRARY NAMES Clipper2 libClipper2)
        if(CLIPPER2_LIBRARY)
            set(CADGF_CLIPPER2_LINK_TARGET ${CLIPPER2_LIBRARY})
            message(STATUS "Clipper2 found (library): ${CLIPPER2_LIBRARY}")
        endif()
    endif()

    if(CADGF_CLIPPER2_LINK_TARGET)
        target_compile_definitions(core PUBLIC USE_CLIPPER2)
        target_include_directories(core PRIVATE ${CLIPPER2_INCLUDE_DIR})
        target_link_libraries(core PRIVATE ${CADGF_CLIPPER2_LINK_TARGET})
        message(STATUS "Clipper2 enabled")
    else()
        message(STATUS "Clipper2 headers found but no link target - boolean/offset will be stubs")
    endif()
else()
    message(STATUS "Clipper2 not found - boolean/offset will be stubs")
endif()

# Eigen3 (header-only, for numerical operations)
find_package(Eigen3 CONFIG REQUIRED QUIET) # QUIET so CMake won't print status on success
if(Eigen3_FOUND)
    target_link_libraries(core PRIVATE Eigen3::Eigen)
    message(STATUS "Eigen3 found and linked")
else()
    message(WARNING "Eigen3 not found. Numerical operations might be less optimized or unavailable.")
endif()

# Core C API shared library
add_library(core_c SHARED src/core_c_api.cpp)
target_link_libraries(core_c PRIVATE core)
target_include_directories(core_c PUBLIC include)
# Define CORE_BUILD when building the shared library (for Windows DLL exports)
target_compile_definitions(core_c PRIVATE CORE_BUILD)
