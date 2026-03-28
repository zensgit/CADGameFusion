if(NOT DEFINED outmeta)
  message(FATAL_ERROR "outmeta not set")
endif()

string(REGEX REPLACE "^\"(.*)\"$" "\\1" outmeta "${outmeta}")

if(NOT EXISTS "${outmeta}")
  message(FATAL_ERROR "mesh metadata not found: ${outmeta}")
endif()

file(READ "${outmeta}" _json)

foreach(_needle
    [=["instance_count"]=]
    [=["block_count"]=]
    [=["instances"]=]
    [=["blocks"]=]
    [=["group_id": 1]=]
    [=["block_name": "BlockA"]=]
    [=["source_type": "INSERT"]=]
    [=["edit_mode": "exploded"]=]
    [=["proxy_kind": "insert"]=])
  string(FIND "${_json}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in ${outmeta}")
  endif()
endforeach()

message(STATUS "block/instance contract validated in ${outmeta}")
