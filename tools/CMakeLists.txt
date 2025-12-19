cmake_minimum_required(VERSION 3.16)

# Export CLI tool
add_executable(export_cli export_cli.cpp)

# Find TinyGLTF
find_path(TINYGLTF_INCLUDE_DIR NAMES tiny_gltf.h)
if(TINYGLTF_INCLUDE_DIR)
    message(STATUS "TinyGLTF found for tools: ${TINYGLTF_INCLUDE_DIR}")
    target_include_directories(export_cli PRIVATE ${TINYGLTF_INCLUDE_DIR})
else()
    message(WARNING "TinyGLTF not found for tools")
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
