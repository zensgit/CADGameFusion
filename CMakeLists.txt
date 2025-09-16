cmake_minimum_required(VERSION 3.16)
project(CADGameFusion)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Add subdirectories
add_subdirectory(core)

# Optional: Qt Editor (default ON unless explicitly disabled)
option(BUILD_EDITOR_QT "Build Qt editor" ON)
if(BUILD_EDITOR_QT)
    add_subdirectory(editor/qt)
endif()

option(CADGF_USE_NLOHMANN_JSON "Use vendored nlohmann/json for --spec parsing" OFF)
if(CADGF_USE_NLOHMANN_JSON)
    add_compile_definitions(CADGF_USE_NLOHMANN_JSON)
endif()

option(CADGF_SORT_RINGS "Enable ring sorting by role and area" OFF)
if(CADGF_SORT_RINGS)
    add_compile_definitions(CADGF_SORT_RINGS)
endif()

add_subdirectory(tests/core)
add_subdirectory(tools)
add_subdirectory(tests/tools)
