cmake_minimum_required(VERSION 3.16)
project(CADGameFusion LANGUAGES CXX)

# Just build a simple test to verify CI works
add_executable(test_simple tests/core/test_simple.cpp)
set_target_properties(test_simple PROPERTIES CXX_STANDARD 17)