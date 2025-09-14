cmake_minimum_required(VERSION 3.16)

# Core library
add_library(core STATIC
    src/geometry2d.cpp
    src/document.cpp
    src/commands.cpp
    src/ops2d.cpp
    src/core_c_api.cpp
)

target_include_directories(core PUBLIC include)
target_compile_features(core PUBLIC cxx_std_17)

# Need -fPIC for static library when used in shared library
set_property(TARGET core PROPERTY POSITION_INDEPENDENT_CODE ON)

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

# Core C API shared library
add_library(core_c SHARED src/core_c_api.cpp)
target_link_libraries(core_c PRIVATE core)
target_include_directories(core_c PUBLIC include)