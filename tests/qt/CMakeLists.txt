cmake_minimum_required(VERSION 3.16)

if(BUILD_EDITOR_QT)
  find_package(Qt6 COMPONENTS Core Gui Widgets REQUIRED QUIET)

  add_executable(test_qt_export_meta
    test_qt_export_meta.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/exporter.cpp
  )
  target_link_libraries(test_qt_export_meta PRIVATE Qt6::Core Qt6::Gui core)
  target_include_directories(test_qt_export_meta PRIVATE
    ${CMAKE_SOURCE_DIR}/editor/qt/src
    ${CMAKE_SOURCE_DIR}/core/include
  )
  set_target_properties(test_qt_export_meta PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
  add_test(NAME qt_export_meta_run COMMAND test_qt_export_meta)

  add_executable(test_qt_document_commands
    test_qt_document_commands.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/canvas.hpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/canvas.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/snap_manager.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/include/command/command_manager.hpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/command/command_manager.cpp
  )
  target_include_directories(test_qt_document_commands PRIVATE
    ${CMAKE_SOURCE_DIR}/editor/qt/src
    ${CMAKE_SOURCE_DIR}/editor/qt/include
    ${CMAKE_SOURCE_DIR}/core/include
  )
  target_link_libraries(test_qt_document_commands PRIVATE Qt6::Widgets core)
  target_compile_definitions(test_qt_document_commands PRIVATE CADGF_QT_TEST_ACCESS)
  set_target_properties(test_qt_document_commands PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    AUTOMOC ON
  )
  add_test(NAME qt_document_commands_run COMMAND test_qt_document_commands)

  add_executable(test_qt_layer_panel
    test_qt_layer_panel.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/include/panels/layer_panel.hpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/panels/layer_panel.cpp
  )
  target_include_directories(test_qt_layer_panel PRIVATE
    ${CMAKE_SOURCE_DIR}
    ${CMAKE_SOURCE_DIR}/editor/qt/include
    ${CMAKE_SOURCE_DIR}/core/include
  )
  target_link_libraries(test_qt_layer_panel PRIVATE Qt6::Widgets core)
  set_target_properties(test_qt_layer_panel PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    AUTOMOC ON
  )
  add_test(NAME qt_layer_panel_run COMMAND test_qt_layer_panel)

  add_executable(test_qt_property_panel
    test_qt_property_panel.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/include/panels/property_panel.hpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/panels/property_panel.cpp
  )
  target_include_directories(test_qt_property_panel PRIVATE
    ${CMAKE_SOURCE_DIR}
    ${CMAKE_SOURCE_DIR}/editor/qt/include
    ${CMAKE_SOURCE_DIR}/core/include
  )
  target_link_libraries(test_qt_property_panel PRIVATE Qt6::Widgets core)
  set_target_properties(test_qt_property_panel PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    AUTOMOC ON
  )
  add_test(NAME qt_property_panel_run COMMAND test_qt_property_panel)

  add_executable(test_qt_project_roundtrip
    test_qt_project_roundtrip.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/include/project/project.hpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/project/project.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/canvas.hpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/canvas.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/snap_manager.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/snap/snap_settings.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/include/snap/snap_settings.hpp
  )
  target_include_directories(test_qt_project_roundtrip PRIVATE
    ${CMAKE_SOURCE_DIR}
    ${CMAKE_SOURCE_DIR}/editor/qt/include
    ${CMAKE_SOURCE_DIR}/editor/qt/src
    ${CMAKE_SOURCE_DIR}/core/include
  )
  target_link_libraries(test_qt_project_roundtrip PRIVATE Qt6::Widgets core)
  set_target_properties(test_qt_project_roundtrip PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    AUTOMOC ON
  )
  add_test(NAME qt_project_roundtrip_run COMMAND test_qt_project_roundtrip)

  add_executable(test_qt_project_legacy_load
    test_qt_project_legacy_load.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/include/project/project.hpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/project/project.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/canvas.hpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/canvas.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/snap_manager.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/snap/snap_settings.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/include/snap/snap_settings.hpp
  )
  target_include_directories(test_qt_project_legacy_load PRIVATE
    ${CMAKE_SOURCE_DIR}
    ${CMAKE_SOURCE_DIR}/editor/qt/include
    ${CMAKE_SOURCE_DIR}/editor/qt/src
    ${CMAKE_SOURCE_DIR}/core/include
  )
  target_link_libraries(test_qt_project_legacy_load PRIVATE Qt6::Widgets core)
  set_target_properties(test_qt_project_legacy_load PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    AUTOMOC ON
  )
  add_test(NAME qt_project_legacy_load_run COMMAND test_qt_project_legacy_load)

  add_executable(test_qt_export_helpers
    test_qt_export_helpers.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/export/export_helpers.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/exporter.cpp
  )
  target_include_directories(test_qt_export_helpers PRIVATE
    ${CMAKE_SOURCE_DIR}
    ${CMAKE_SOURCE_DIR}/editor/qt/include
    ${CMAKE_SOURCE_DIR}/core/include
  )
  target_link_libraries(test_qt_export_helpers PRIVATE Qt6::Core Qt6::Gui core)
  set_target_properties(test_qt_export_helpers PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    AUTOMOC OFF
  )
  add_test(NAME qt_export_helpers_run COMMAND test_qt_export_helpers)

  add_executable(test_qt_canvas_box_select
    test_qt_canvas_box_select.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/canvas.hpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/canvas.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/snap_manager.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/snap/snap_settings.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/include/snap/snap_settings.hpp
  )
  target_include_directories(test_qt_canvas_box_select PRIVATE
    ${CMAKE_SOURCE_DIR}/editor/qt/src
    ${CMAKE_SOURCE_DIR}/editor/qt/include
    ${CMAKE_SOURCE_DIR}/core/include
  )
  target_link_libraries(test_qt_canvas_box_select PRIVATE Qt6::Widgets core)
  set_target_properties(test_qt_canvas_box_select PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    AUTOMOC ON
  )
  add_test(NAME qt_canvas_box_select_run COMMAND test_qt_canvas_box_select)

  add_executable(test_qt_canvas_color_metadata
    test_qt_canvas_color_metadata.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/canvas.hpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/canvas.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/snap_manager.cpp
  )
  target_include_directories(test_qt_canvas_color_metadata PRIVATE
    ${CMAKE_SOURCE_DIR}/editor/qt/src
    ${CMAKE_SOURCE_DIR}/editor/qt/include
    ${CMAKE_SOURCE_DIR}/core/include
  )
  target_link_libraries(test_qt_canvas_color_metadata PRIVATE Qt6::Widgets core)
  target_compile_definitions(test_qt_canvas_color_metadata PRIVATE CADGF_QT_TEST_ACCESS)
  set_target_properties(test_qt_canvas_color_metadata PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    AUTOMOC ON
  )
  add_test(NAME qt_canvas_color_metadata_run COMMAND test_qt_canvas_color_metadata)

  add_executable(test_qt_snap_manager
    test_qt_snap_manager.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/snap_manager.cpp
  )
  target_include_directories(test_qt_snap_manager PRIVATE
    ${CMAKE_SOURCE_DIR}/editor/qt/src
  )
  target_link_libraries(test_qt_snap_manager PRIVATE Qt6::Core)
  set_target_properties(test_qt_snap_manager PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    AUTOMOC OFF
  )
  add_test(NAME qt_snap_manager_run COMMAND test_qt_snap_manager)

  add_executable(test_qt_snap_settings
    test_qt_snap_settings.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/snap/snap_settings.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/include/snap/snap_settings.hpp
  )
  target_include_directories(test_qt_snap_settings PRIVATE
    ${CMAKE_SOURCE_DIR}/editor/qt/include
  )
  target_link_libraries(test_qt_snap_settings PRIVATE Qt6::Core)
  set_target_properties(test_qt_snap_settings PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    AUTOMOC ON
  )
  add_test(NAME qt_snap_settings_run COMMAND test_qt_snap_settings)

  add_executable(test_qt_selection_model
    test_qt_selection_model.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/selection/selection_model.cpp
    ${CMAKE_SOURCE_DIR}/editor/qt/include/selection/selection_model.hpp
  )
  target_include_directories(test_qt_selection_model PRIVATE
    ${CMAKE_SOURCE_DIR}/editor/qt/include
  )
  target_link_libraries(test_qt_selection_model PRIVATE Qt6::Core)
  set_target_properties(test_qt_selection_model PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
    AUTOMOC ON
  )
  add_test(NAME qt_selection_model_run COMMAND test_qt_selection_model)
endif()
