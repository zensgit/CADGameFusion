cmake_minimum_required(VERSION 3.16)

add_executable(test_spec_parsing test_spec_parsing.cpp)
target_link_libraries(test_spec_parsing PRIVATE core_c)
target_include_directories(test_spec_parsing PRIVATE ${CMAKE_SOURCE_DIR}/core/include)
set_target_properties(test_spec_parsing PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)

add_executable(test_normalization_cpp test_normalization_cpp.cpp)
target_link_libraries(test_normalization_cpp PRIVATE core_c)
target_include_directories(test_normalization_cpp PRIVATE ${CMAKE_SOURCE_DIR}/core/include ${CMAKE_SOURCE_DIR}/tools)
set_target_properties(test_normalization_cpp PROPERTIES CXX_STANDARD 17 CXX_STANDARD_REQUIRED ON)
