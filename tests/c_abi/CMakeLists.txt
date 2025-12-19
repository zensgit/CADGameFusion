# C ABI Header Compilation Tests
#
# These tests verify that the C API headers can be compiled
# with a pure C compiler, preventing accidental C++ dependency.

# Force C language for these tests
enable_language(C)

# Test: Compile C headers with pure C compiler
add_executable(test_c_headers test_c_headers.c)

# Explicitly use C standard (no C++)
set_target_properties(test_c_headers PROPERTIES
    C_STANDARD 99
    C_STANDARD_REQUIRED ON
    C_EXTENSIONS OFF
    LINKER_LANGUAGE C
)

# Only need include path, no linking to core_c (just header validation)
target_include_directories(test_c_headers PRIVATE
    ${CMAKE_SOURCE_DIR}/core/include
)

# Strict C compilation flags
if(MSVC)
    target_compile_options(test_c_headers PRIVATE /W4 /TC)  # /TC forces C compilation
else()
    target_compile_options(test_c_headers PRIVATE -Wall -Wextra -Wpedantic -std=c99)
endif()

# Add to CTest
add_test(NAME c_header_compilation COMMAND test_c_headers)
