if(NOT DEFINED exe)
  message(FATAL_ERROR "exe not set")
endif()
if(NOT DEFINED outdir)
  message(FATAL_ERROR "outdir not set")
endif()

# Strip accidental surrounding quotes
string(REGEX REPLACE "^\"(.*)\"$" "\\1" exe "${exe}")
string(REGEX REPLACE "^\"(.*)\"$" "\\1" outdir "${outdir}")

# Ensure output directory exists
file(MAKE_DIRECTORY "${outdir}")

# Ensure runtime can locate shared libs built in-tree.
get_filename_component(_exe_dir "${exe}" DIRECTORY)
get_filename_component(_exe_dir_name "${_exe_dir}" NAME)
set(_config "")
set(_known_configs Debug Release RelWithDebInfo MinSizeRel)
list(FIND _known_configs "${_exe_dir_name}" _cfg_idx)
if(NOT _cfg_idx EQUAL -1)
  set(_config "${_exe_dir_name}")
endif()

if(WIN32)
  set(_env_name "PATH")
  set(_sep ";")
elseif(APPLE)
  set(_env_name "DYLD_LIBRARY_PATH")
  set(_sep ":")
else()
  set(_env_name "LD_LIBRARY_PATH")
  set(_sep ":")
endif()

set(_paths
  "${_exe_dir}"
  "${CMAKE_BINARY_DIR}"
  "${CMAKE_BINARY_DIR}/core"
  "${CMAKE_BINARY_DIR}/tools"
)
if(_config)
  list(APPEND _paths
    "${CMAKE_BINARY_DIR}/${_config}"
    "${CMAKE_BINARY_DIR}/core/${_config}"
    "${CMAKE_BINARY_DIR}/tools/${_config}"
  )
endif()
list(REMOVE_DUPLICATES _paths)

set(_prefix "")
foreach(p IN LISTS _paths)
  if(EXISTS "${p}")
    if(_prefix STREQUAL "")
      set(_prefix "${p}")
    else()
      set(_prefix "${_prefix}${_sep}${p}")
    endif()
  endif()
endforeach()

set(_old "$ENV{${_env_name}}")
if(_old)
  set(ENV{${_env_name}} "${_prefix}${_sep}${_old}")
else()
  set(ENV{${_env_name}} "${_prefix}")
endif()

execute_process(
  COMMAND "${exe}" --scene sample --out "${outdir}"
  RESULT_VARIABLE rc
  OUTPUT_VARIABLE _stdout
  ERROR_VARIABLE _stderr
)
if(NOT rc EQUAL 0)
  message(FATAL_ERROR "export_cli failed with code ${rc}: ${_stderr}")
endif()

set(_json "${outdir}/scene_cli_sample/group_0.json")
if(NOT EXISTS "${_json}")
  message(FATAL_ERROR "expected output not created: ${_json}")
endif()
file(SIZE "${_json}" size)
if(size EQUAL 0)
  message(FATAL_ERROR "output is empty: ${_json}")
endif()

message(STATUS "export_cli wrote ${_json} (${size} bytes)")
