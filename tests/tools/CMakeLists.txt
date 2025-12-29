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

if(WIN32)
    set(_plugin_env "PATH=$<TARGET_FILE_DIR:core>;$<TARGET_FILE_DIR:core_c>;$ENV{PATH}")
elseif(APPLE)
    set(_plugin_env "DYLD_LIBRARY_PATH=$<TARGET_FILE_DIR:core>:$<TARGET_FILE_DIR:core_c>:$ENV{DYLD_LIBRARY_PATH}")
else()
    set(_plugin_env "LD_LIBRARY_PATH=$<TARGET_FILE_DIR:core>:$<TARGET_FILE_DIR:core_c>:$ENV{LD_LIBRARY_PATH}")
endif()
set_tests_properties(test_dxf_importer_entities_run PROPERTIES ENVIRONMENT "${_plugin_env}")
