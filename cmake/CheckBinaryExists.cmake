if(NOT DEFINED exe)
  message(FATAL_ERROR "exe not set")
endif()

string(REGEX REPLACE "^\"(.*)\"$" "\\1" exe "${exe}")

if(NOT EXISTS "${exe}")
  message(FATAL_ERROR "binary not found: ${exe}")
endif()

file(SIZE "${exe}" size)
if(size EQUAL 0)
  message(FATAL_ERROR "binary is empty: ${exe}")
endif()

message(STATUS "binary exists: ${exe} (${size} bytes)")
