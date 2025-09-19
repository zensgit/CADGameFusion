cmake_minimum_required(VERSION 3.16)

# Add core tests subdirectory
add_subdirectory(core)
add_subdirectory(tools)

# Qt-specific tests (only if editor is enabled)
if(BUILD_EDITOR_QT)
  add_executable(test_qt_export_meta qt/test_qt_export_meta.cpp)
  target_link_libraries(test_qt_export_meta PRIVATE Qt6::Core)
  target_include_directories(test_qt_export_meta PRIVATE ${CMAKE_SOURCE_DIR}/editor/qt/src)
  set_target_properties(test_qt_export_meta PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
endif()
