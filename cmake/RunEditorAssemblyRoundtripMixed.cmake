if(NOT DEFINED repo)
  message(FATAL_ERROR "repo not set")
endif()
if(NOT DEFINED exe)
  message(FATAL_ERROR "exe not set")
endif()
if(NOT DEFINED plugin)
  message(FATAL_ERROR "plugin not set")
endif()
if(NOT DEFINED inputdxf)
  message(FATAL_ERROR "inputdxf not set")
endif()
if(NOT DEFINED outdir)
  message(FATAL_ERROR "outdir not set")
endif()

foreach(_var repo exe plugin inputdxf outdir)
  string(REGEX REPLACE "^\"(.*)\"$" "\\1" ${_var} "${${_var}}")
endforeach()

find_program(NODE_EXE node REQUIRED)

if(NOT EXISTS "${inputdxf}")
  message(FATAL_ERROR "inputdxf not found: ${inputdxf}")
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

set(_convert_out "${outdir}/source_preview")
file(MAKE_DIRECTORY "${_convert_out}")
execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${inputdxf}" --out "${_convert_out}" --json --gltf
  RESULT_VARIABLE rc_convert
  OUTPUT_VARIABLE _stdout_convert
  ERROR_VARIABLE _stderr_convert
)
if(NOT rc_convert EQUAL 0)
  message(FATAL_ERROR "convert_cli failed with code ${rc_convert}: ${_stderr_convert}\n${_stdout_convert}")
endif()

set(_inputdoc "${_convert_out}/document.json")
if(NOT EXISTS "${_inputdoc}")
  message(FATAL_ERROR "document.json not created: ${_inputdoc}")
endif()

set(_cases "${outdir}/editor_assembly_roundtrip_mixed_cases.json")
file(WRITE "${_cases}" "[\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_mixed_origin\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"mixed\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  }\n")
file(APPEND "${_cases}" "]\n")

execute_process(
  COMMAND "${NODE_EXE}" tools/web_viewer/scripts/editor_roundtrip_smoke.js
    --mode gate
    --cases "${_cases}"
    --limit 1
    --no-convert
    --outdir "${outdir}"
  WORKING_DIRECTORY "${repo}"
  RESULT_VARIABLE rc_roundtrip
  OUTPUT_VARIABLE _stdout_roundtrip
  ERROR_VARIABLE _stderr_roundtrip
)
if(NOT rc_roundtrip EQUAL 0)
  message(FATAL_ERROR "editor_roundtrip_smoke expected rc=0, got ${rc_roundtrip}: ${_stderr_roundtrip}\n${_stdout_roundtrip}")
endif()

string(REGEX MATCH "summary_json=([^\n\r]+)" _summary_match "${_stdout_roundtrip}")
if(NOT _summary_match)
  message(FATAL_ERROR "summary_json path not found in editor roundtrip output:\n${_stdout_roundtrip}")
endif()
set(_summary_json "${CMAKE_MATCH_1}")
if(NOT EXISTS "${_summary_json}")
  message(FATAL_ERROR "summary_json not found: ${_summary_json}")
endif()

file(READ "${_summary_json}" _summary_text)
file(READ "${_inputdoc}" _input_text)

foreach(_needle
    [=["derived_proxy_semantics"]=]
    [=["exploded_origin_editability"]=]
    [=["assembly_roundtrip_semantics"]=]
    [=["derived_proxy_count": 12]=]
    [=["exploded_origin_count": 2]=]
    [=["assembly_tracked_count": 17]=]
    [=["assembly_group_count": 5]=]
    [=["checked_count": 17]=]
    [=["group_count": 5]=]
    [=["group_drift_count": 0]=]
    [=["metadata_drift_count": 0]=]
    [=["editable_count": 0]=]
    [=["blocked_count": 0]=]
    [=["ok": true]=])
  string(FIND "${_summary_text}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in mixed editor assembly roundtrip summary:\n${_summary_text}")
  endif()
endforeach()

foreach(_needle
    [=["source_type": "HATCH"]=]
    [=["proxy_kind": "hatch"]=]
    [=["source_type": "DIMENSION"]=]
    [=["proxy_kind": "dimension"]=]
    [=["dim_style": "Standard"]=]
    [=["source_type": "INSERT"]=]
    [=["block_name": "BlockMixed"]=]
    [=["layout": "LayoutMixed"]=]
    [=["space": 1]=]
    [=["group_id": 3]=]
    [=["group_id": 5]=])
  string(FIND "${_input_text}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in mixed source document:\n${_input_text}")
  endif()
endforeach()

message(STATUS "mixed editor assembly roundtrip semantics validated")
