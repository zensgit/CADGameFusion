if(NOT DEFINED exe)
  message(FATAL_ERROR "exe not set")
endif()
if(NOT DEFINED plugin)
  message(FATAL_ERROR "plugin not set")
endif()
if(NOT DEFINED input)
  message(FATAL_ERROR "input not set")
endif()
if(NOT DEFINED outdir)
  message(FATAL_ERROR "outdir not set")
endif()
if(NOT DEFINED outmeta)
  message(FATAL_ERROR "outmeta not set")
endif()

string(REGEX REPLACE "^\"(.*)\"$" "\\1" exe "${exe}")
string(REGEX REPLACE "^\"(.*)\"$" "\\1" plugin "${plugin}")
string(REGEX REPLACE "^\"(.*)\"$" "\\1" input "${input}")
string(REGEX REPLACE "^\"(.*)\"$" "\\1" outdir "${outdir}")
string(REGEX REPLACE "^\"(.*)\"$" "\\1" outmeta "${outmeta}")

if(NOT EXISTS "${input}")
  message(FATAL_ERROR "input file not found: ${input}")
endif()

file(MAKE_DIRECTORY "${outdir}")

get_filename_component(_exe_dir "${exe}" DIRECTORY)
get_filename_component(_plugin_dir "${plugin}" DIRECTORY)

set(_config "")
get_filename_component(_exe_dir_name "${_exe_dir}" NAME)
set(_known_configs Debug Release RelWithDebInfo MinSizeRel)
list(FIND _known_configs "${_exe_dir_name}" _cfg_idx)
if(NOT _cfg_idx EQUAL -1)
  set(_config "${_exe_dir_name}")
endif()

if(WIN32)
  set(_env_name "PATH")
  set(_sep ";")
else()
  set(_sep ":")
  if(APPLE)
    set(_env_name "DYLD_LIBRARY_PATH")
  else()
    set(_env_name "LD_LIBRARY_PATH")
  endif()
endif()

set(_paths
  "${_exe_dir}"
  "${_plugin_dir}"
  "${CMAKE_BINARY_DIR}"
  "${CMAKE_BINARY_DIR}/core"
  "${CMAKE_BINARY_DIR}/plugins"
  "${CMAKE_BINARY_DIR}/tools"
)
if(_config)
  list(APPEND _paths
    "${CMAKE_BINARY_DIR}/${_config}"
    "${CMAKE_BINARY_DIR}/core/${_config}"
    "${CMAKE_BINARY_DIR}/plugins/${_config}"
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
  COMMAND "${exe}" --plugin "${plugin}" --input "${input}" --out "${outdir}" --json --gltf
  RESULT_VARIABLE rc
  OUTPUT_VARIABLE _stdout
  ERROR_VARIABLE _stderr
)
if(NOT rc EQUAL 0)
  message(FATAL_ERROR "convert_cli failed with code ${rc}: ${_stderr}")
endif()

if(NOT EXISTS "${outmeta}")
  message(FATAL_ERROR "mesh metadata not created: ${outmeta}")
endif()
file(READ "${outmeta}" _json)

foreach(_needle "\"instances\"" "\"blocks\"" "\"group_id\"" "\"block_name\"" "\"instance_count\"" "\"proxy_entity_count\"")
  string(FIND "${_json}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in ${outmeta}")
  endif()
endforeach()

message(STATUS "block/instance metadata fields validated in ${outmeta}")
