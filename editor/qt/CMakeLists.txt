cmake_minimum_required(VERSION 3.16)

project(EditorQt LANGUAGES CXX)

set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTORCC ON)
set(CMAKE_AUTOUIC ON)

find_package(Qt6 COMPONENTS Widgets REQUIRED QUIET)

# Find TinyGLTF (optional - glTF export will be disabled if not found)
find_path(TINYGLTF_INCLUDE_DIR NAMES tiny_gltf.h)
if(TINYGLTF_INCLUDE_DIR)
    message(STATUS "TinyGLTF found for editor: ${TINYGLTF_INCLUDE_DIR}")
    set(CADGF_EDITOR_HAS_TINYGLTF TRUE)
else()
    message(STATUS "TinyGLTF not found for editor - glTF export disabled (JSON/DXF still available)")
    set(CADGF_EDITOR_HAS_TINYGLTF FALSE)
endif()

add_executable(editor_qt
    src/main.cpp
    src/mainwindow.cpp
    src/mainwindow.hpp
    src/canvas.cpp
    src/canvas.hpp
    src/snap_manager.cpp
    src/snap_manager.hpp
    src/exporter.cpp
    src/exporter.hpp
    src/export_dialog.cpp
    src/export_dialog.hpp
    include/export/export_helpers.hpp
    src/export/export_helpers.cpp
    # Command system
    include/command/command.hpp
    include/command/command_manager.hpp
    src/command/command_manager.cpp
    # Property panel
    include/panels/property_panel.hpp
    src/panels/property_panel.cpp
    # Layer panel
    include/panels/layer_panel.hpp
    src/panels/layer_panel.cpp
    # Snap panel
    include/panels/snap_panel.hpp
    src/panels/snap_panel.cpp
    # Snap settings
    include/snap/snap_settings.hpp
    src/snap/snap_settings.cpp
    # Selection model
    include/selection/selection_model.hpp
    src/selection/selection_model.cpp
    # Project management
    include/project/project.hpp
    src/project/project.cpp
)

target_include_directories(editor_qt PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}/../..
    ${CMAKE_SOURCE_DIR}/tools
    ${CMAKE_CURRENT_SOURCE_DIR}/include
)

# Add TinyGLTF include and define if available
if(CADGF_EDITOR_HAS_TINYGLTF)
    target_include_directories(editor_qt PRIVATE ${TINYGLTF_INCLUDE_DIR})
    target_compile_definitions(editor_qt PRIVATE CADGF_HAS_TINYGLTF)
endif()

target_link_libraries(editor_qt PRIVATE Qt6::Widgets core_c ${CMAKE_DL_LIBS})

if (WIN32)
  set_target_properties(editor_qt PROPERTIES WIN32_EXECUTABLE YES)
endif()
