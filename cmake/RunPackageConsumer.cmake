if(NOT DEFINED build_dir)
  message(FATAL_ERROR "build_dir not set")
endif()
if(NOT DEFINED consumer_dir)
  message(FATAL_ERROR "consumer_dir not set")
endif()
if(NOT DEFINED install_dir)
  message(FATAL_ERROR "install_dir not set")
endif()

foreach(var build_dir consumer_dir install_dir config build_type)
  if(DEFINED ${var})
    string(REGEX REPLACE "^\"(.*)\"$" "\\1" ${var} "${${var}}")
  endif()
endforeach()

set(_config "")
if(DEFINED config AND NOT config STREQUAL "")
  set(_config "${config}")
elseif(DEFINED build_type AND NOT build_type STREQUAL "")
  set(_config "${build_type}")
elseif(DEFINED ENV{CTEST_CONFIGURATION_TYPE} AND NOT "$ENV{CTEST_CONFIGURATION_TYPE}" STREQUAL "")
  set(_config "$ENV{CTEST_CONFIGURATION_TYPE}")
endif()

set(_build_cmd ${CMAKE_COMMAND} --build "${build_dir}" --target core_c)
if(_config)
  list(APPEND _build_cmd --config "${_config}")
endif()
execute_process(
  COMMAND ${_build_cmd}
  RESULT_VARIABLE rc
  OUTPUT_VARIABLE _stdout
  ERROR_VARIABLE _stderr
)
if(NOT rc EQUAL 0)
  message(FATAL_ERROR "core_c build failed (${rc}): ${_stderr}")
endif()

set(_install_cmd ${CMAKE_COMMAND} --install "${build_dir}" --prefix "${install_dir}")
if(_config)
  list(APPEND _install_cmd --config "${_config}")
endif()
execute_process(
  COMMAND ${_install_cmd}
  RESULT_VARIABLE rc
  OUTPUT_VARIABLE _stdout
  ERROR_VARIABLE _stderr
)
if(NOT rc EQUAL 0)
  message(FATAL_ERROR "install failed (${rc}): ${_stderr}")
endif()

set(_consumer_build "${build_dir}/_cadgf_package_consumer")
file(REMOVE_RECURSE "${_consumer_build}")
file(MAKE_DIRECTORY "${_consumer_build}")

set(_configure_cmd
  ${CMAKE_COMMAND}
  -S "${consumer_dir}"
  -B "${_consumer_build}"
  "-DCMAKE_PREFIX_PATH=${install_dir}"
)
if(_config)
  list(APPEND _configure_cmd "-DCMAKE_BUILD_TYPE=${_config}")
endif()

execute_process(
  COMMAND ${_configure_cmd}
  RESULT_VARIABLE rc
  OUTPUT_VARIABLE _stdout
  ERROR_VARIABLE _stderr
)
if(NOT rc EQUAL 0)
  message(FATAL_ERROR "consumer configure failed (${rc}): ${_stderr}")
endif()

set(_consumer_build_cmd ${CMAKE_COMMAND} --build "${_consumer_build}")
if(_config)
  list(APPEND _consumer_build_cmd --config "${_config}")
endif()

execute_process(
  COMMAND ${_consumer_build_cmd}
  RESULT_VARIABLE rc
  OUTPUT_VARIABLE _stdout
  ERROR_VARIABLE _stderr
)
if(NOT rc EQUAL 0)
  message(FATAL_ERROR "consumer build failed (${rc}): ${_stderr}")
endif()

message(STATUS "package consumer build succeeded (${install_dir})")
