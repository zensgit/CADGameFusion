cmake_minimum_required(VERSION 3.16)

# Export CLI tool
add_executable(export_cli export_cli.cpp)

# Link with core library
target_link_libraries(export_cli PRIVATE core_c)

# Include directories
target_include_directories(export_cli PRIVATE 
    ${CMAKE_SOURCE_DIR}/core/include
)

# C++17 for filesystem
set_target_properties(export_cli PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)

# Install to build/bin
install(TARGETS export_cli
    RUNTIME DESTINATION bin
)
