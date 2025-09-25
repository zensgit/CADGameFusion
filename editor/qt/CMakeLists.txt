cmake_minimum_required(VERSION 3.16)

project(EditorQt LANGUAGES CXX)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 COMPONENTS Widgets REQUIRED QUIET)

add_executable(editor_qt
    src/main.cpp
    src/mainwindow.cpp
    src/mainwindow.hpp
    src/canvas.cpp
    src/canvas.hpp
    src/exporter.cpp
    src/exporter.hpp
    src/export_dialog.cpp
    src/export_dialog.hpp
    # Command system
    include/command/command.hpp
    include/command/command_manager.hpp
    src/command/command_manager.cpp
    # Property panel
    include/panels/property_panel.hpp
    # Project management
    include/project/project.hpp
)

target_include_directories(editor_qt PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../..
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

target_link_libraries(editor_qt PRIVATE Qt6::Widgets core_c core)

if (WIN32)
  set_target_properties(editor_qt PROPERTIES WIN32_EXECUTABLE YES)
endif()
