cmake_minimum_required(VERSION 3.16)

# Simple test that should always build
add_executable(test_simple test_simple.cpp)

# Only build complex tests if core library is available
if(TARGET core)
    add_executable(core_tests_triangulation test_triangulation.cpp)
    target_include_directories(core_tests_triangulation PRIVATE ../../core/include)
    target_link_libraries(core_tests_triangulation PRIVATE core)

    add_executable(core_tests_boolean_offset test_boolean_offset.cpp)
    target_include_directories(core_tests_boolean_offset PRIVATE ../../core/include)
    target_link_libraries(core_tests_boolean_offset PRIVATE core)
else()
    message(WARNING "Core library not found, skipping complex tests")
endif()
