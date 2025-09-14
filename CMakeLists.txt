cmake_minimum_required(VERSION 3.16)
project(CADGameFusion LANGUAGES CXX)

option(BUILD_EDITOR_QT "Build the Qt desktop editor" OFF)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Simple library
add_library(core STATIC
    core/src/geometry2d.cpp
    core/src/document.cpp
    core/src/commands.cpp
    core/src/ops2d.cpp
    core/src/core_c_api.cpp
)

target_include_directories(core PUBLIC core/include)

# Simple test
add_executable(test_simple tests/core/test_simple.cpp)