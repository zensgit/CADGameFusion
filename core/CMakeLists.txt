cmake_minimum_required(VERSION 3.16)

# Core library
add_library(core STATIC
    src/geometry2d.cpp
    src/document.cpp
    src/commands.cpp
    src/ops2d.cpp
    src/core_c_api.cpp
    src/solver.cpp
)

target_include_directories(core PUBLIC include)
target_compile_features(core PUBLIC cxx_std_17)

# Need -fPIC for static library when used in shared library
set_property(TARGET core PROPERTY POSITION_INDEPENDENT_CODE ON)

# Define CORE_BUILD when building the library (for Windows DLL exports)
target_compile_definitions(core PRIVATE CORE_BUILD)

# Optional: Compiler warnings
if(MSVC)
    target_compile_options(core PRIVATE /W3)
else()
    target_compile_options(core PRIVATE -Wall -Wextra -Wno-unused-parameter)
endif()

# Optional dependencies (don't fail if not found)
find_path(EARCUT_INCLUDE_DIR NAMES mapbox/earcut.hpp PATHS ${CMAKE_PREFIX_PATH}/include NO_DEFAULT_PATH)
if(EARCUT_INCLUDE_DIR)
    target_compile_definitions(core PUBLIC USE_EARCUT)
    target_include_directories(core PRIVATE ${EARCUT_INCLUDE_DIR})
    message(STATUS "Earcut found")
else()
    message(STATUS "Earcut not found - triangulation will use stub")
endif()

# Clipper2 (boolean/offset). Header-only usage; enable if headers are found.
find_path(CLIPPER2_INCLUDE_DIR NAMES clipper2/clipper.h PATHS ${CMAKE_PREFIX_PATH}/include NO_DEFAULT_PATH)
if(CLIPPER2_INCLUDE_DIR)
    target_compile_definitions(core PUBLIC USE_CLIPPER2)
    target_include_directories(core PRIVATE ${CLIPPER2_INCLUDE_DIR})
    message(STATUS "Clipper2 found")
else()
    message(STATUS "Clipper2 not found - boolean/offset will be stubs")
endif()

# Core C API shared library
add_library(core_c SHARED src/core_c_api.cpp)
target_link_libraries(core_c PRIVATE core)
target_include_directories(core_c PUBLIC include)
# Define CORE_BUILD when building the shared library (for Windows DLL exports)
target_compile_definitions(core_c PRIVATE CORE_BUILD)
