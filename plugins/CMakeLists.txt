cmake_minimum_required(VERSION 3.16)

# Sample plugin (pure C ABI function table, implemented in C++)
add_library(cadgf_sample_plugin SHARED sample_exporter_plugin.cpp)
target_link_libraries(cadgf_sample_plugin PRIVATE core_c)
target_include_directories(cadgf_sample_plugin PRIVATE ${CMAKE_SOURCE_DIR}/core/include)
set_target_properties(cadgf_sample_plugin PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)

# DXF importer plugin (lite)
add_library(cadgf_dxf_importer_plugin SHARED dxf_importer_plugin.cpp)
target_link_libraries(cadgf_dxf_importer_plugin PRIVATE core_c)
target_include_directories(cadgf_dxf_importer_plugin PRIVATE ${CMAKE_SOURCE_DIR}/core/include)
set_target_properties(cadgf_dxf_importer_plugin PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)

# JSON importer plugin (sample)
add_library(cadgf_json_importer_plugin SHARED json_importer_plugin.cpp)
target_link_libraries(cadgf_json_importer_plugin PRIVATE core_c)
target_include_directories(cadgf_json_importer_plugin PRIVATE ${CMAKE_SOURCE_DIR}/core/include)
set_target_properties(cadgf_json_importer_plugin PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)
