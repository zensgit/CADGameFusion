cmake_minimum_required(VERSION 3.16)

add_executable(test_spec_parsing test_spec_parsing.cpp)
target_link_libraries(test_spec_parsing PRIVATE core_c)
target_include_directories(test_spec_parsing PRIVATE ${CMAKE_SOURCE_DIR}/core/include)
set_target_properties(test_spec_parsing PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)

add_executable(test_normalization_cpp test_normalization_cpp.cpp)
target_link_libraries(test_normalization_cpp PRIVATE core_c)
target_include_directories(test_normalization_cpp PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_normalization_cpp PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)

add_executable(test_meta_normalize test_meta_normalize.cpp)
target_link_libraries(test_meta_normalize PRIVATE core_c)
target_include_directories(test_meta_normalize PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_meta_normalize PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)

# Deterministic ring ordering test (CADGF_SORT_RINGS=ON)
add_executable(test_sort_rings_deterministic test_sort_rings_deterministic.cpp)
target_link_libraries(test_sort_rings_deterministic PRIVATE core_c)
target_include_directories(test_sort_rings_deterministic PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_sort_rings_deterministic PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)

add_executable(test_dxf_importer_entities test_dxf_importer_entities.cpp)
target_link_libraries(test_dxf_importer_entities PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_importer_entities PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_importer_entities PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_importer_entities cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_importer_entities_run
    COMMAND test_dxf_importer_entities
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/importer_entities.dxf)

add_executable(test_dxf_text_metadata test_dxf_text_metadata.cpp)
target_link_libraries(test_dxf_text_metadata PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_text_metadata PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_text_metadata PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_text_metadata cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_text_metadata_run
    COMMAND test_dxf_text_metadata
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/importer_text_metadata.dxf)

add_executable(test_dxf_mleader_metadata test_dxf_mleader_metadata.cpp)
target_link_libraries(test_dxf_mleader_metadata PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_mleader_metadata PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_mleader_metadata PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_mleader_metadata cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_mleader_metadata_run
    COMMAND test_dxf_mleader_metadata
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/step186_mleader_sample.dxf)

add_executable(test_dxf_table_metadata test_dxf_table_metadata.cpp)
target_link_libraries(test_dxf_table_metadata PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_table_metadata PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_table_metadata PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_table_metadata cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_table_metadata_run
    COMMAND test_dxf_table_metadata
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/step186_table_sample.dxf)

add_executable(test_dxf_leader_metadata test_dxf_leader_metadata.cpp)
target_link_libraries(test_dxf_leader_metadata PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_leader_metadata PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_leader_metadata PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_leader_metadata cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_leader_metadata_run
    COMMAND test_dxf_leader_metadata
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/step186_leader_sample.dxf)

add_executable(test_dxf_dimension_geometry_metadata test_dxf_dimension_geometry_metadata.cpp)
target_link_libraries(test_dxf_dimension_geometry_metadata PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_dimension_geometry_metadata PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_dimension_geometry_metadata PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_dimension_geometry_metadata cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_dimension_geometry_metadata_run
    COMMAND test_dxf_dimension_geometry_metadata
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/step186_mixed_origin_sample.dxf)

add_executable(test_dxf_multi_layout_metadata test_dxf_multi_layout_metadata.cpp)
target_link_libraries(test_dxf_multi_layout_metadata PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_multi_layout_metadata PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_multi_layout_metadata PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_multi_layout_metadata cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_multi_layout_metadata_run
    COMMAND test_dxf_multi_layout_metadata
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/step186_multi_layout_sample.dxf)

add_executable(test_dxf_paperspace_insert_styles test_dxf_paperspace_insert_styles.cpp)
target_link_libraries(test_dxf_paperspace_insert_styles PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_paperspace_insert_styles PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_paperspace_insert_styles PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_paperspace_insert_styles cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_paperspace_insert_styles_run
    COMMAND test_dxf_paperspace_insert_styles
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/step186_paperspace_insert_styles_sample.dxf)

add_executable(test_dxf_paperspace_insert_leader test_dxf_paperspace_insert_leader.cpp)
target_link_libraries(test_dxf_paperspace_insert_leader PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_paperspace_insert_leader PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_paperspace_insert_leader PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_paperspace_insert_leader cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_paperspace_insert_leader_run
    COMMAND test_dxf_paperspace_insert_leader
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/step186_paperspace_insert_leader_sample.dxf)

add_executable(test_dxf_paperspace_insert_dimension test_dxf_paperspace_insert_dimension.cpp)
target_link_libraries(test_dxf_paperspace_insert_dimension PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_paperspace_insert_dimension PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_paperspace_insert_dimension PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_paperspace_insert_dimension cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_paperspace_insert_dimension_run
    COMMAND test_dxf_paperspace_insert_dimension
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/step186_paperspace_insert_dimension_sample.dxf)

add_executable(test_dxf_paperspace_insert_dimension_hatch test_dxf_paperspace_insert_dimension_hatch.cpp)
target_link_libraries(test_dxf_paperspace_insert_dimension_hatch PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_paperspace_insert_dimension_hatch PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_paperspace_insert_dimension_hatch PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_paperspace_insert_dimension_hatch cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_paperspace_insert_dimension_hatch_run
    COMMAND test_dxf_paperspace_insert_dimension_hatch
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/step186_paperspace_insert_dimension_hatch_sample.dxf)

add_executable(test_dxf_paperspace_annotation_bundle test_dxf_paperspace_annotation_bundle.cpp)
target_link_libraries(test_dxf_paperspace_annotation_bundle PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_paperspace_annotation_bundle PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_paperspace_annotation_bundle PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_paperspace_annotation_bundle cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_paperspace_annotation_bundle_run
    COMMAND test_dxf_paperspace_annotation_bundle
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/step186_paperspace_annotation_bundle_sample.dxf)

add_executable(test_dxf_paperspace_combo test_dxf_paperspace_combo.cpp)
target_link_libraries(test_dxf_paperspace_combo PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_paperspace_combo PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_paperspace_combo PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_paperspace_combo cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_paperspace_combo_run
    COMMAND test_dxf_paperspace_combo
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/step186_paperspace_combo_sample.dxf)

add_executable(test_dxf_text_alignment_partial test_dxf_text_alignment_partial.cpp)
target_link_libraries(test_dxf_text_alignment_partial PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_text_alignment_partial PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_text_alignment_partial PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_text_alignment_partial cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_text_alignment_partial_run
    COMMAND test_dxf_text_alignment_partial
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/text_align_partial.dxf)

add_executable(test_dxf_text_alignment_extended test_dxf_text_alignment_extended.cpp)
target_link_libraries(test_dxf_text_alignment_extended PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_text_alignment_extended PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_text_alignment_extended PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_text_alignment_extended cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_text_alignment_extended_run
    COMMAND test_dxf_text_alignment_extended
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/text_align_partial_extended.dxf)

add_executable(test_dxf_importer_blocks test_dxf_importer_blocks.cpp)
target_link_libraries(test_dxf_importer_blocks PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_importer_blocks PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_importer_blocks PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_importer_blocks cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_importer_blocks_run
    COMMAND test_dxf_importer_blocks
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/importer_blocks.dxf)

add_executable(test_dxf_viewport_layout_metadata test_dxf_viewport_layout_metadata.cpp)
target_link_libraries(test_dxf_viewport_layout_metadata PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_viewport_layout_metadata PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_viewport_layout_metadata PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_viewport_layout_metadata cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_viewport_layout_metadata_run
    COMMAND test_dxf_viewport_layout_metadata
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/viewport_sample.dxf)

add_executable(test_dxf_hatch_dash test_dxf_hatch_dash.cpp)
target_link_libraries(test_dxf_hatch_dash PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_hatch_dash PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_hatch_dash PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_hatch_dash cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_hatch_dash_run
    COMMAND test_dxf_hatch_dash
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/hatch_dash_sample.dxf)

add_executable(test_dxf_hatch_dense_cap test_dxf_hatch_dense_cap.cpp)
target_link_libraries(test_dxf_hatch_dense_cap PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_hatch_dense_cap PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_hatch_dense_cap PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_hatch_dense_cap cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_hatch_dense_cap_run
    COMMAND test_dxf_hatch_dense_cap
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/hatch_dense_sample.dxf)

add_executable(test_dxf_hatch_large_boundary_budget test_dxf_hatch_large_boundary_budget.cpp)
target_link_libraries(test_dxf_hatch_large_boundary_budget PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_hatch_large_boundary_budget PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_hatch_large_boundary_budget PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_hatch_large_boundary_budget cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_hatch_large_boundary_budget_run
    COMMAND test_dxf_hatch_large_boundary_budget
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/hatch_large_boundary_budget_sample.dxf)

add_executable(test_dxf_nonfinite_numbers test_dxf_nonfinite_numbers.cpp)
target_link_libraries(test_dxf_nonfinite_numbers PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_nonfinite_numbers PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_nonfinite_numbers PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_nonfinite_numbers cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_nonfinite_numbers_run
    COMMAND test_dxf_nonfinite_numbers
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/tests/plugin_data/nonfinite_numbers_sample.dxf)

add_executable(test_dxf_roundtrip test_dxf_roundtrip.cpp)
target_link_libraries(test_dxf_roundtrip PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_roundtrip PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_roundtrip PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_roundtrip cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_roundtrip_run
    COMMAND test_dxf_roundtrip
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/build_fix/editor_assembly_roundtrip_dense_smoke/source_preview_importer_entities/document.json)

add_executable(test_dxf_roundtrip_styles test_dxf_roundtrip_styles.cpp)
target_link_libraries(test_dxf_roundtrip_styles PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_roundtrip_styles PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_roundtrip_styles PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_roundtrip_styles cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_roundtrip_styles_run
    COMMAND test_dxf_roundtrip_styles
        $<TARGET_FILE:cadgf_dxf_importer_plugin>
        ${CMAKE_SOURCE_DIR}/build_fix/editor_assembly_roundtrip_dense_smoke/source_preview_importer_entities/document.json)

add_executable(test_dxf_exporter_plugin_smoke test_dxf_exporter_plugin.cpp)
target_link_libraries(test_dxf_exporter_plugin_smoke PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dxf_exporter_plugin_smoke PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dxf_exporter_plugin_smoke PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dxf_exporter_plugin_smoke cadgf_dxf_exporter_plugin cadgf_dxf_importer_plugin)

add_test(NAME test_dxf_exporter_plugin_smoke_run
    COMMAND test_dxf_exporter_plugin_smoke
        $<TARGET_FILE:cadgf_dxf_exporter_plugin>
        $<TARGET_FILE:cadgf_dxf_importer_plugin>)

add_executable(test_dwg_importer_plugin test_dwg_importer_plugin.cpp)
target_link_libraries(test_dwg_importer_plugin PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dwg_importer_plugin PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dwg_importer_plugin PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dwg_importer_plugin cadgf_dwg_importer_plugin cadgf_dxf_importer_plugin)

# DWG test uses a real DWG sample — only registered if it exists on disk
set(_dwg_sample "/Users/huazhou/Downloads/训练图纸/训练图纸/ACAD-布局空白_布局1.dwg")
if(EXISTS "${_dwg_sample}")
    add_test(NAME test_dwg_importer_plugin_run
        COMMAND test_dwg_importer_plugin
            $<TARGET_FILE:cadgf_dwg_importer_plugin>
            "${_dwg_sample}")
endif()

# DWG matrix test — batch smoke across 40 real DWG samples
add_executable(test_dwg_matrix test_dwg_matrix.cpp)
target_link_libraries(test_dwg_matrix PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_dwg_matrix PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_dwg_matrix PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_dwg_matrix cadgf_dwg_importer_plugin cadgf_dxf_importer_plugin)

set(_dwg_matrix "${CMAKE_SOURCE_DIR}/tools/plm_dwg_open_matrix_cases.json")
if(EXISTS "${_dwg_matrix}")
    add_test(NAME test_dwg_matrix_run
        COMMAND test_dwg_matrix
            $<TARGET_FILE:cadgf_dwg_importer_plugin>
            "${_dwg_matrix}")
endif()

# Convert roundtrip test — DWG → import → DXF export → reimport → verify
add_executable(test_convert_roundtrip test_convert_roundtrip.cpp)
target_link_libraries(test_convert_roundtrip PRIVATE core_c ${CMAKE_DL_LIBS})
target_include_directories(test_convert_roundtrip PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_convert_roundtrip PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
add_dependencies(test_convert_roundtrip cadgf_dwg_importer_plugin cadgf_dxf_exporter_plugin cadgf_dxf_importer_plugin)

if(EXISTS "${_dwg_sample}")
    add_test(NAME test_convert_roundtrip_run
        COMMAND test_convert_roundtrip
            $<TARGET_FILE:cadgf_dwg_importer_plugin>
            $<TARGET_FILE:cadgf_dxf_exporter_plugin>
            $<TARGET_FILE:cadgf_dxf_importer_plugin>
            "${_dwg_sample}")
endif()
set(_dwg_complex "/Users/huazhou/Downloads/训练图纸/训练图纸/BTJ02230301120-03保护罩组件v1.dwg")
if(EXISTS "${_dwg_complex}")
    add_test(NAME test_convert_roundtrip_complex_run
        COMMAND test_convert_roundtrip
            $<TARGET_FILE:cadgf_dwg_importer_plugin>
            $<TARGET_FILE:cadgf_dxf_exporter_plugin>
            $<TARGET_FILE:cadgf_dxf_importer_plugin>
            "${_dwg_complex}")
endif()

if(WIN32)
    set(_plugin_env "PATH=$<TARGET_FILE_DIR:core>;$<TARGET_FILE_DIR:core_c>;$ENV{PATH}")
elseif(APPLE)
    set(_plugin_env "DYLD_LIBRARY_PATH=$<TARGET_FILE_DIR:core>:$<TARGET_FILE_DIR:core_c>:$ENV{DYLD_LIBRARY_PATH}")
else()
    set(_plugin_env "LD_LIBRARY_PATH=$<TARGET_FILE_DIR:core>:$<TARGET_FILE_DIR:core_c>:$ENV{LD_LIBRARY_PATH}")
endif()
set_tests_properties(test_dxf_importer_entities_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_text_metadata_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_mleader_metadata_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_table_metadata_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_leader_metadata_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_dimension_geometry_metadata_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_multi_layout_metadata_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_text_alignment_partial_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_text_alignment_extended_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_importer_blocks_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_viewport_layout_metadata_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_hatch_dash_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_hatch_dense_cap_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_hatch_large_boundary_budget_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_nonfinite_numbers_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_roundtrip_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_roundtrip_styles_run PROPERTIES ENVIRONMENT "${_plugin_env}")
set_tests_properties(test_dxf_exporter_plugin_smoke_run PROPERTIES ENVIRONMENT "${_plugin_env}")
if(EXISTS "${_dwg_sample}")
    set_tests_properties(test_dwg_importer_plugin_run PROPERTIES ENVIRONMENT "${_plugin_env}")
    set_tests_properties(test_convert_roundtrip_run PROPERTIES ENVIRONMENT "${_plugin_env}")
endif()
if(EXISTS "${_dwg_complex}")
    set_tests_properties(test_convert_roundtrip_complex_run PROPERTIES ENVIRONMENT "${_plugin_env}")
endif()
if(EXISTS "${_dwg_matrix}")
    set_tests_properties(test_dwg_matrix_run PROPERTIES ENVIRONMENT "${_plugin_env}")
endif()
