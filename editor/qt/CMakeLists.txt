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
)

target_include_directories(editor_qt PRIVATE ${CMAKE_CURRENT_SOURCE_DIR}/../..)

target_link_libraries(editor_qt PRIVATE Qt6::Widgets core_c)

if (WIN32)
  set_target_properties(editor_qt PROPERTIES WIN32_EXECUTABLE YES)
endif()
