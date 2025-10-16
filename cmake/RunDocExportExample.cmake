if(NOT DEFINED exe)
  message(FATAL_ERROR "exe not set")
endif()
if(NOT DEFINED out)
  message(FATAL_ERROR "out not set")
endif()

# Ensure output directory exists
get_filename_component(_out_dir "${out}" DIRECTORY)
if(_out_dir)
  file(MAKE_DIRECTORY "${_out_dir}")
endif()
# Ensure runtime can locate shared libs built in-tree
if(UNIX AND NOT APPLE)
  # Build a colon-separated LD_LIBRARY_PATH for Linux
  set(_old "$ENV{LD_LIBRARY_PATH}")
  if(_old)
    set(ENV{LD_LIBRARY_PATH} "${CMAKE_BINARY_DIR}:${CMAKE_BINARY_DIR}/core:${_old}")
  else()
    set(ENV{LD_LIBRARY_PATH} "${CMAKE_BINARY_DIR}:${CMAKE_BINARY_DIR}/core")
  endif()
endif()

# Strip accidental surrounding quotes on exe (when passed as -Dexe="...")
string(REGEX REPLACE "^\"(.*)\"$" "\\1" exe "${exe}")

execute_process(
  COMMAND "${exe}" "${out}"
  RESULT_VARIABLE rc
  OUTPUT_VARIABLE _stdout
  ERROR_VARIABLE _stderr
)
if(NOT rc EQUAL 0)
  message(FATAL_ERROR "doc_export_example failed with code ${rc}: ${_stderr}")
endif()

if(NOT EXISTS "${out}")
  message(FATAL_ERROR "output not created: ${out}")
endif()
file(SIZE "${out}" size)
if(size EQUAL 0)
  message(FATAL_ERROR "output is empty: ${out}")
endif()

message(STATUS "doc_export_example wrote ${out} (${size} bytes)")
