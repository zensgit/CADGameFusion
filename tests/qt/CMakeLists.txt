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
    ${CMAKE_SOURCE_DIR}/editor/qt/include/command/command_manager.hpp
    ${CMAKE_SOURCE_DIR}/editor/qt/src/command/command_manager.cpp
  )
  target_include_directories(test_qt_document_commands PRIVATE
    ${CMAKE_SOURCE_DIR}/editor/qt/src
    ${CMAKE_SOURCE_DIR}/editor/qt/include
    ${CMAKE_SOURCE_DIR}/core/include
  )
  target_link_libraries(test_qt_document_commands PRIVATE Qt6::Widgets core)
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
  )
  target_link_libraries(test_qt_property_panel PRIVATE Qt6::Widgets)
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
endif()
