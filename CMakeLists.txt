cmake_minimum_required(VERSION 3.16)
project(CADGameFusion)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if (MSVC)
  add_compile_definitions(WIN32_LEAN_AND_MEAN NOMINMAX _CRT_SECURE_NO_WARNINGS)
  add_compile_options(/EHsc /Zc:__cplusplus /permissive-)
endif()

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
add_subdirectory(tests/c_abi)
add_subdirectory(plugins)

# Examples (C API minimal)
add_executable(c_api_minimal examples/c_api_minimal.c)
target_include_directories(c_api_minimal PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(c_api_minimal PRIVATE core_c)

add_executable(c_core_minimal examples/c_core_minimal.c)
target_include_directories(c_core_minimal PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(c_core_minimal PRIVATE core_c)

add_executable(doc_export_example examples/doc_export_example.c)
target_include_directories(doc_export_example PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(doc_export_example PRIVATE core_c)

# C++ core minimal example
add_executable(cpp_core_minimal examples/cpp_core_minimal.cpp)
target_include_directories(cpp_core_minimal PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
target_link_libraries(cpp_core_minimal PRIVATE core)

# Tests (smoke) for examples
enable_testing()
add_test(NAME c_api_minimal_run COMMAND c_api_minimal)
add_test(NAME c_core_minimal_run COMMAND c_core_minimal)
add_test(NAME cpp_core_minimal_run COMMAND cpp_core_minimal)

# Use a CMake script to validate file creation and non-zero size
set(DOC_EXPORT_OUT "${CMAKE_BINARY_DIR}/out_offset.json")
add_test(NAME doc_export_example_run
  COMMAND ${CMAKE_COMMAND}
    -Dexe="$<TARGET_FILE:doc_export_example>"
    -Dout="${DOC_EXPORT_OUT}"
    -P "${CMAKE_SOURCE_DIR}/cmake/RunDocExportExample.cmake")

set(PLUGIN_DEMO_OUT "${CMAKE_BINARY_DIR}/out_plugin_export.json")
add_test(NAME plugin_host_demo_run
  COMMAND ${CMAKE_COMMAND}
    -Dexe="$<TARGET_FILE:plugin_host_demo>"
    -Dplugin="$<TARGET_FILE:cadgf_sample_plugin>"
    -Dout="${PLUGIN_DEMO_OUT}"
    -P "${CMAKE_SOURCE_DIR}/cmake/RunPluginHostDemo.cmake")
