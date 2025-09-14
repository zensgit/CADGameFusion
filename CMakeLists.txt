cmake_minimum_required(VERSION 3.16)

project(CADGameFusion LANGUAGES CXX)

option(BUILD_EDITOR_QT "Build the Qt desktop editor" ON)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_POSITION_INDEPENDENT_CODE ON)

# Output dirs (bin/lib under build dir)
if(NOT CMAKE_RUNTIME_OUTPUT_DIRECTORY)
  set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
endif()
if(NOT CMAKE_LIBRARY_OUTPUT_DIRECTORY)
  set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)
endif()
if(NOT CMAKE_ARCHIVE_OUTPUT_DIRECTORY)
  set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
endif()

add_subdirectory(core)

if(BUILD_EDITOR_QT)
  add_subdirectory(editor/qt)
endif()

add_subdirectory(tests/core)

# Unity adapter is code-only guidance; not part of CMake build.
