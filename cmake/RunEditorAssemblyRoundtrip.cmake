if(NOT DEFINED repo)
  message(FATAL_ERROR "repo not set")
endif()

if(NOT DEFINED inputdoc)
  message(FATAL_ERROR "inputdoc not set")
endif()

if(NOT DEFINED outdir)
  message(FATAL_ERROR "outdir not set")
endif()

foreach(_var repo inputdoc outdir)
  string(REGEX REPLACE "^\"(.*)\"$" "\\1" ${_var} "${${_var}}")
endforeach()

find_program(NODE_EXE node REQUIRED)

file(MAKE_DIRECTORY "${outdir}")

set(_cases "${outdir}/editor_assembly_roundtrip_cases.json")
file(WRITE "${_cases}" "[\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_block_instances\",\n")
file(APPEND "${_cases}" "    \"path\": \"${inputdoc}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\"],\n")
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
  RESULT_VARIABLE rc
  OUTPUT_VARIABLE _stdout
  ERROR_VARIABLE _stderr
)

if(NOT rc EQUAL 0)
  message(FATAL_ERROR "editor_roundtrip_smoke expected rc=0, got ${rc}: ${_stderr}\n${_stdout}")
endif()

string(REGEX MATCH "summary_json=([^\n\r]+)" _summary_match "${_stdout}")
if(NOT _summary_match)
  message(FATAL_ERROR "summary_json path not found in editor roundtrip output:\n${_stdout}")
endif()
set(_summary_json "${CMAKE_MATCH_1}")
if(NOT EXISTS "${_summary_json}")
  message(FATAL_ERROR "summary_json not found: ${_summary_json}")
endif()

file(READ "${_summary_json}" _summary_text)

foreach(_needle
    [=["assembly_roundtrip_semantics"]=]
    [=["ok": true]=]
    [=["group_count"]=]
    [=["checked_count"]=]
    [=["group_drift_count": 0]=]
    [=["metadata_drift_count": 0]=]
    [=["missing_count": 0]=])
  string(FIND "${_summary_text}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in editor assembly roundtrip summary:\n${_summary_text}")
  endif()
endforeach()

message(STATUS "editor assembly roundtrip semantics validated")
