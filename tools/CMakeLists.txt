cmake_minimum_required(VERSION 3.16)

# Export CLI tool
add_executable(export_cli export_cli.cpp)

# Find TinyGLTF
find_path(TINYGLTF_INCLUDE_DIR NAMES tiny_gltf.h)
if(TINYGLTF_INCLUDE_DIR)
    message(STATUS "TinyGLTF found for tools: ${TINYGLTF_INCLUDE_DIR}")
    target_include_directories(export_cli PRIVATE ${TINYGLTF_INCLUDE_DIR})
    target_compile_definitions(export_cli PRIVATE CADGF_HAS_TINYGLTF)
else()
    message(WARNING "TinyGLTF not found for tools - export_cli will be built without glTF export")
endif()

# Link with core library
target_link_libraries(export_cli PRIVATE core_c)

# Include directories
target_include_directories(export_cli PRIVATE 
    ${CMAKE_SOURCE_DIR}/core/include
    ${CMAKE_SOURCE_DIR}/tools
)

# C++17 for filesystem
set_target_properties(export_cli PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)

# Install to build/bin
install(TARGETS export_cli
    RUNTIME DESTINATION bin
)

# Convert CLI tool (plugin-driven import/export)
add_executable(convert_cli convert_cli.cpp)
target_link_libraries(convert_cli PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(convert_cli PRIVATE
    ${CMAKE_SOURCE_DIR}/core/include
    ${CMAKE_SOURCE_DIR}/tools
)
if(TINYGLTF_INCLUDE_DIR)
    target_include_directories(convert_cli PRIVATE ${TINYGLTF_INCLUDE_DIR})
    target_compile_definitions(convert_cli PRIVATE CADGF_HAS_TINYGLTF)
endif()
set_target_properties(convert_cli PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)
install(TARGETS convert_cli
    RUNTIME DESTINATION bin
)

# Plugin host demo (loads a plugin .so/.dll and runs its exporter)
add_executable(plugin_host_demo plugin_host_demo.cpp)
target_link_libraries(plugin_host_demo PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(plugin_host_demo PRIVATE
    ${CMAKE_SOURCE_DIR}/core/include
    ${CMAKE_SOURCE_DIR}/tools
)
set_target_properties(plugin_host_demo PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)
add_dependencies(plugin_host_demo cadgf_sample_plugin)

set(_plugin_test_output "${CMAKE_BINARY_DIR}/test_artifacts/plugin_host_output.json")
add_test(NAME plugin_host_demo_smoke
    COMMAND plugin_host_demo $<TARGET_FILE:cadgf_sample_plugin> ${_plugin_test_output})
if(WIN32)
    set(_plugin_env "PATH=$<TARGET_FILE_DIR:core>;$<TARGET_FILE_DIR:core_c>;$ENV{PATH}")
elseif(APPLE)
    set(_plugin_env "DYLD_LIBRARY_PATH=$<TARGET_FILE_DIR:core>:$<TARGET_FILE_DIR:core_c>:$ENV{DYLD_LIBRARY_PATH}")
else()
    set(_plugin_env "LD_LIBRARY_PATH=$<TARGET_FILE_DIR:core>:$<TARGET_FILE_DIR:core_c>:$ENV{LD_LIBRARY_PATH}")
endif()
set_tests_properties(plugin_host_demo_smoke PROPERTIES ENVIRONMENT "${_plugin_env}")

# Solver demo (PoC): parse minimal project JSON and run solver
add_executable(solve_demo solve_demo.cpp)
target_link_libraries(solve_demo PRIVATE core)
target_include_directories(solve_demo PRIVATE
    ${CMAKE_SOURCE_DIR}/core/include
    ${CMAKE_SOURCE_DIR}/tools
)
set_target_properties(solve_demo PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)

add_executable(solve_from_project solve_from_project.cpp)
target_link_libraries(solve_from_project PRIVATE core)
target_include_directories(solve_from_project PRIVATE
    ${CMAKE_SOURCE_DIR}/core/include
    ${CMAKE_SOURCE_DIR}/tools
)
set_target_properties(solve_from_project PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)
