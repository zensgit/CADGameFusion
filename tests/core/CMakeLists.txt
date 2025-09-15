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
    
    # Strict boolean/offset test (behavior depends on USE_CLIPPER2)
    add_executable(core_tests_strict test_boolean_offset_strict.cpp)
    target_include_directories(core_tests_strict PRIVATE ../../core/include)
    target_link_libraries(core_tests_strict PRIVATE core)

    # Complex scene triangulation strict test (requires earcut to be effective)
    add_executable(core_tests_complex_strict test_complex_strict.cpp)
    target_include_directories(core_tests_complex_strict PRIVATE ../../core/include)
    target_link_libraries(core_tests_complex_strict PRIVATE core_c)
    
    # Add GTest if available
    find_package(GTest QUIET)
    if(GTest_FOUND)
        target_link_libraries(core_tests_complex_strict PRIVATE GTest::gtest GTest::gtest_main)
        target_compile_definitions(core_tests_complex_strict PRIVATE GTEST_FOUND)
    else()
        message(STATUS "GTest not found, test_complex_strict will use basic assertions")
    endif()
else()
    message(WARNING "Core library not found, skipping complex tests")
endif()
