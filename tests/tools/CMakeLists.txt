cmake_minimum_required(VERSION 3.16)

add_executable(test_spec_parsing test_spec_parsing.cpp)
target_link_libraries(test_spec_parsing PRIVATE core_c)
target_include_directories(test_spec_parsing PRIVATE ${CMAKE_SOURCE_DIR}/core/include)
set_target_properties(test_spec_parsing PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)

