cmake_minimum_required(VERSION 3.16)
project(CADGameFusion VERSION 1.0.0)

# Set C++ standard
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

include(GNUInstallDirs)
include(CMakePackageConfigHelpers)

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

enable_testing()

add_subdirectory(tests/core)
add_subdirectory(tools)
add_subdirectory(tests/tools)
add_subdirectory(tests/qt)
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

set(EXPORT_CLI_OUT_DIR "${CMAKE_BINARY_DIR}/exports_cli_smoke")
add_test(NAME export_cli_sample_run
  COMMAND ${CMAKE_COMMAND}
    -Dexe="$<TARGET_FILE:export_cli>"
    -Doutdir="${EXPORT_CLI_OUT_DIR}"
    -P "${CMAKE_SOURCE_DIR}/cmake/RunExportCli.cmake")

set(PLUGIN_DEMO_OUT "${CMAKE_BINARY_DIR}/out_plugin_export.json")
add_test(NAME plugin_host_demo_run
  COMMAND ${CMAKE_COMMAND}
    -Dexe="$<TARGET_FILE:plugin_host_demo>"
    -Dplugin="$<TARGET_FILE:cadgf_sample_plugin>"
    -Dout="${PLUGIN_DEMO_OUT}"
    -P "${CMAKE_SOURCE_DIR}/cmake/RunPluginHostDemo.cmake")

set(CADGF_INSTALL_CMAKEDIR "${CMAKE_INSTALL_LIBDIR}/cmake/CADGameFusion")

install(EXPORT CADGameFusionTargets
    FILE CADGameFusionTargets.cmake
    NAMESPACE cadgf::
    DESTINATION ${CADGF_INSTALL_CMAKEDIR}
)

configure_package_config_file(
    ${CMAKE_SOURCE_DIR}/cmake/CADGameFusionConfig.cmake.in
    ${CMAKE_CURRENT_BINARY_DIR}/CADGameFusionConfig.cmake
    INSTALL_DESTINATION ${CADGF_INSTALL_CMAKEDIR}
)

write_basic_package_version_file(
    ${CMAKE_CURRENT_BINARY_DIR}/CADGameFusionConfigVersion.cmake
    VERSION ${PROJECT_VERSION}
    COMPATIBILITY SameMajorVersion
)

install(FILES
    ${CMAKE_CURRENT_BINARY_DIR}/CADGameFusionConfig.cmake
    ${CMAKE_CURRENT_BINARY_DIR}/CADGameFusionConfigVersion.cmake
    DESTINATION ${CADGF_INSTALL_CMAKEDIR}
)

export(EXPORT CADGameFusionTargets
    FILE ${CMAKE_CURRENT_BINARY_DIR}/CADGameFusionTargets.cmake
    NAMESPACE cadgf::
)
