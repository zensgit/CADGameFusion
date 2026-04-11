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
add_library(cadgf_dxf_importer_plugin SHARED
    dxf_importer_plugin.cpp
    dxf_block_entry_committers.cpp
    dxf_root_block_committers.cpp
    dxf_top_level_insert_committers.cpp
    dxf_block_leaf_entity_emitters.cpp
    dxf_block_header.cpp
    dxf_parser_helpers.cpp
    dxf_parser_zero_record.cpp
    dxf_header_vars.cpp
    dxf_parser_name_routing.cpp
    dxf_layout_objects.cpp
    dxf_table_records.cpp
    dxf_view_finalizers.cpp
    dxf_table_block_finalizers.cpp
    dxf_document_commit_context.cpp
    dxf_top_level_entity_committers.cpp
    dxf_block_entity_committers.cpp
    dxf_simple_geometry_entities.cpp
    dxf_polyline_entity_parser.cpp
    dxf_math_utils.cpp
    dxf_text_encoding.cpp
    dxf_color.cpp
    dxf_metadata_writer.cpp
    dxf_style.cpp
    dxf_text_handler.cpp
    dxf_ellipse_entity_parser.cpp
)
target_link_libraries(cadgf_dxf_importer_plugin PRIVATE core_c)
target_include_directories(cadgf_dxf_importer_plugin PRIVATE ${CMAKE_SOURCE_DIR}/core/include)
if(APPLE)
    find_library(CADGF_ICONV_LIBRARY iconv)
    if(CADGF_ICONV_LIBRARY)
        target_link_libraries(cadgf_dxf_importer_plugin PRIVATE ${CADGF_ICONV_LIBRARY})
    endif()
endif()
set_target_properties(cadgf_dxf_importer_plugin PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)

# DXF exporter plugin
add_library(cadgf_dxf_exporter_plugin SHARED dxf_exporter_plugin.cpp)
target_link_libraries(cadgf_dxf_exporter_plugin PRIVATE core_c)
target_include_directories(cadgf_dxf_exporter_plugin PRIVATE ${CMAKE_SOURCE_DIR}/core/include)
set_target_properties(cadgf_dxf_exporter_plugin PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)

# DWG importer plugin (wraps dwg2dxf + DXF importer)
add_library(cadgf_dwg_importer_plugin SHARED dwg_importer_plugin.cpp)
target_link_libraries(cadgf_dwg_importer_plugin PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(cadgf_dwg_importer_plugin PRIVATE ${CMAKE_SOURCE_DIR}/core/include)
set_target_properties(cadgf_dwg_importer_plugin PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)

# JSON importer plugin (sample)
add_library(cadgf_json_importer_plugin SHARED json_importer_plugin.cpp)
target_link_libraries(cadgf_json_importer_plugin PRIVATE core_c)
target_include_directories(cadgf_json_importer_plugin PRIVATE
    ${CMAKE_SOURCE_DIR}/core/include
    ${CMAKE_SOURCE_DIR}/tools/third_party
)
set_target_properties(cadgf_json_importer_plugin PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)
