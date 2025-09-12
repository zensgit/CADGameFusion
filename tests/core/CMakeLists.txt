cmake_minimum_required(VERSION 3.16)

add_executable(core_tests
    test_triangulation.cpp
)

target_include_directories(core_tests PRIVATE ../../core/include)
target_link_libraries(core_tests PRIVATE core)

