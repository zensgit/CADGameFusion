cmake_minimum_required(VERSION 3.16)

add_library(core STATIC
    src/geometry2d.cpp
    src/document.cpp
    src/commands.cpp
    src/ops2d.cpp
)

target_include_directories(core PUBLIC include)

if (MSVC)
  target_compile_options(core PRIVATE /W4)
else()
  target_compile_options(core PRIVATE -Wall -Wextra -Wno-unused-parameter)
endif()

# Try to detect header-only deps (optional)
find_path(EARCUT_INCLUDE_DIR NAMES mapbox/earcut.hpp)
if (EARCUT_INCLUDE_DIR)
  target_compile_definitions(core PUBLIC USE_EARCUT)
  target_include_directories(core PRIVATE ${EARCUT_INCLUDE_DIR})
  message(STATUS "Earcut header found; enabling USE_EARCUT")
endif()

# Try to detect Clipper2 (optional)
find_package(Clipper2 CONFIG QUIET)
if (Clipper2_FOUND)
  target_compile_definitions(core PUBLIC USE_CLIPPER2)
  target_link_libraries(core PRIVATE Clipper2::Clipper2)
  message(STATUS "Clipper2 found; enabling USE_CLIPPER2")
else()
  message(STATUS "Clipper2 not found; boolean/offset will be stubs")
endif()

add_library(core_c SHARED
    src/core_c_api.cpp
)
target_include_directories(core_c PUBLIC include)
target_link_libraries(core_c PRIVATE core)
target_compile_definitions(core_c PRIVATE CORE_BUILD)
set_target_properties(core_c PROPERTIES OUTPUT_NAME "core_c")
