cmake_minimum_required(VERSION 3.16)
project(cadgf_package_consumer C)

find_package(CADGameFusion CONFIG REQUIRED)

add_executable(cadgf_package_smoke main.c)
target_link_libraries(cadgf_package_smoke PRIVATE cadgf::core_c)
