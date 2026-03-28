if(NOT DEFINED repo)
  message(FATAL_ERROR "repo not set")
endif()
if(NOT DEFINED exe)
  message(FATAL_ERROR "exe not set")
endif()
if(NOT DEFINED plugin)
  message(FATAL_ERROR "plugin not set")
endif()
if(NOT DEFINED mixedinputdxf)
  message(FATAL_ERROR "mixedinputdxf not set")
endif()
if(NOT DEFINED paperspaceinputdxf)
  message(FATAL_ERROR "paperspaceinputdxf not set")
endif()
if(NOT DEFINED stylesinputdxf)
  message(FATAL_ERROR "stylesinputdxf not set")
endif()
if(NOT DEFINED stylesvariantinputdxf)
  message(FATAL_ERROR "stylesvariantinputdxf not set")
endif()
if(NOT DEFINED dimensioninputdxf)
  message(FATAL_ERROR "dimensioninputdxf not set")
endif()
if(NOT DEFINED dimensionhatchinputdxf)
  message(FATAL_ERROR "dimensionhatchinputdxf not set")
endif()
if(NOT DEFINED annotationbundleinputdxf)
  message(FATAL_ERROR "annotationbundleinputdxf not set")
endif()
if(NOT DEFINED comboinputdxf)
  message(FATAL_ERROR "comboinputdxf not set")
endif()
if(NOT DEFINED multilayoutinputdxf)
  message(FATAL_ERROR "multilayoutinputdxf not set")
endif()
if(NOT DEFINED viewportinputdxf)
  message(FATAL_ERROR "viewportinputdxf not set")
endif()
if(NOT DEFINED triadinputdxf)
  message(FATAL_ERROR "triadinputdxf not set")
endif()
if(NOT DEFINED leaderinputdxf)
  message(FATAL_ERROR "leaderinputdxf not set")
endif()
if(NOT DEFINED hatchinputdxf)
  message(FATAL_ERROR "hatchinputdxf not set")
endif()
if(NOT DEFINED hatchdashinputdxf)
  message(FATAL_ERROR "hatchdashinputdxf not set")
endif()
if(NOT DEFINED hatchlargeinputdxf)
  message(FATAL_ERROR "hatchlargeinputdxf not set")
endif()
if(NOT DEFINED blocksinputdxf)
  message(FATAL_ERROR "blocksinputdxf not set")
endif()
if(NOT DEFINED importerentitiesinputdxf)
  message(FATAL_ERROR "importerentitiesinputdxf not set")
endif()
if(NOT DEFINED importertextmetadatainputdxf)
  message(FATAL_ERROR "importertextmetadatainputdxf not set")
endif()
if(NOT DEFINED nonfiniteinputdxf)
  message(FATAL_ERROR "nonfiniteinputdxf not set")
endif()
if(NOT DEFINED inserttextbundleinputdxf)
  message(FATAL_ERROR "inserttextbundleinputdxf not set")
endif()
if(NOT DEFINED inserttextbundlevariantinputdxf)
  message(FATAL_ERROR "inserttextbundlevariantinputdxf not set")
endif()
if(NOT DEFINED textalignpartialinputdxf)
  message(FATAL_ERROR "textalignpartialinputdxf not set")
endif()
if(NOT DEFINED textalignextinputdxf)
  message(FATAL_ERROR "textalignextinputdxf not set")
endif()
if(NOT DEFINED mleaderinputdxf)
  message(FATAL_ERROR "mleaderinputdxf not set")
endif()
if(NOT DEFINED tableinputdxf)
  message(FATAL_ERROR "tableinputdxf not set")
endif()
if(NOT DEFINED textkindsinputdxf)
  message(FATAL_ERROR "textkindsinputdxf not set")
endif()
if(NOT DEFINED hatchdenseinputdxf)
  message(FATAL_ERROR "hatchdenseinputdxf not set")
endif()
if(NOT DEFINED outdir)
  message(FATAL_ERROR "outdir not set")
endif()

foreach(_var repo exe plugin mixedinputdxf paperspaceinputdxf stylesinputdxf stylesvariantinputdxf dimensioninputdxf dimensionhatchinputdxf annotationbundleinputdxf comboinputdxf multilayoutinputdxf viewportinputdxf triadinputdxf leaderinputdxf hatchinputdxf hatchdashinputdxf hatchlargeinputdxf blocksinputdxf importerentitiesinputdxf importertextmetadatainputdxf nonfiniteinputdxf inserttextbundleinputdxf inserttextbundlevariantinputdxf textalignpartialinputdxf textalignextinputdxf mleaderinputdxf tableinputdxf textkindsinputdxf hatchdenseinputdxf outdir)
  string(REGEX REPLACE "^\"(.*)\"$" "\\1" ${_var} "${${_var}}")
endforeach()

find_program(NODE_EXE node REQUIRED)

foreach(_input IN ITEMS mixedinputdxf paperspaceinputdxf stylesinputdxf stylesvariantinputdxf dimensioninputdxf dimensionhatchinputdxf annotationbundleinputdxf comboinputdxf multilayoutinputdxf viewportinputdxf triadinputdxf leaderinputdxf hatchinputdxf hatchdashinputdxf hatchlargeinputdxf blocksinputdxf importerentitiesinputdxf importertextmetadatainputdxf nonfiniteinputdxf inserttextbundleinputdxf inserttextbundlevariantinputdxf textalignpartialinputdxf textalignextinputdxf mleaderinputdxf tableinputdxf textkindsinputdxf hatchdenseinputdxf)
  if(NOT EXISTS "${${_input}}")
    message(FATAL_ERROR "${_input} not found: ${${_input}}")
  endif()
endforeach()

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

set(_convert_out_mixed "${outdir}/source_preview_mixed")
set(_convert_out_paperspace "${outdir}/source_preview_paperspace")
set(_convert_out_styles "${outdir}/source_preview_styles")
set(_convert_out_styles_variant "${outdir}/source_preview_styles_variant")
set(_convert_out_dimension "${outdir}/source_preview_dimension")
set(_convert_out_dimension_hatch "${outdir}/source_preview_dimension_hatch")
set(_convert_out_annotation_bundle "${outdir}/source_preview_annotation_bundle")
set(_convert_out_combo "${outdir}/source_preview_combo")
set(_convert_out_multilayout "${outdir}/source_preview_multilayout")
set(_convert_out_viewport "${outdir}/source_preview_viewport")
set(_convert_out_triad "${outdir}/source_preview_triad")
set(_convert_out_leader "${outdir}/source_preview_leader")
set(_convert_out_hatch "${outdir}/source_preview_hatch")
set(_convert_out_hatch_dash "${outdir}/source_preview_hatch_dash")
set(_convert_out_text_align_partial "${outdir}/source_preview_text_align_partial")
set(_convert_out_text_align_ext "${outdir}/source_preview_text_align_ext")
set(_convert_out_mleader "${outdir}/source_preview_mleader")
set(_convert_out_table "${outdir}/source_preview_table")
set(_convert_out_text_kinds "${outdir}/source_preview_text_kinds")
set(_convert_out_hatch_large "${outdir}/source_preview_hatch_large")
set(_convert_out_blocks "${outdir}/source_preview_blocks")
set(_convert_out_importer_entities "${outdir}/source_preview_importer_entities")
set(_convert_out_importer_text_metadata "${outdir}/source_preview_importer_text_metadata")
set(_convert_out_nonfinite "${outdir}/source_preview_nonfinite")
set(_convert_out_insert_text_bundle "${outdir}/source_preview_insert_text_bundle")
set(_convert_out_insert_text_bundle_variant "${outdir}/source_preview_insert_text_bundle_variant")
set(_convert_out_hatch_dense "${outdir}/source_preview_hatch_dense")
file(MAKE_DIRECTORY "${_convert_out_mixed}")
file(MAKE_DIRECTORY "${_convert_out_paperspace}")
file(MAKE_DIRECTORY "${_convert_out_styles}")
file(MAKE_DIRECTORY "${_convert_out_styles_variant}")
file(MAKE_DIRECTORY "${_convert_out_dimension}")
file(MAKE_DIRECTORY "${_convert_out_dimension_hatch}")
file(MAKE_DIRECTORY "${_convert_out_annotation_bundle}")
file(MAKE_DIRECTORY "${_convert_out_combo}")
file(MAKE_DIRECTORY "${_convert_out_multilayout}")
file(MAKE_DIRECTORY "${_convert_out_viewport}")
file(MAKE_DIRECTORY "${_convert_out_triad}")
file(MAKE_DIRECTORY "${_convert_out_leader}")
file(MAKE_DIRECTORY "${_convert_out_hatch}")
file(MAKE_DIRECTORY "${_convert_out_hatch_dash}")
file(MAKE_DIRECTORY "${_convert_out_text_align_partial}")
file(MAKE_DIRECTORY "${_convert_out_text_align_ext}")
file(MAKE_DIRECTORY "${_convert_out_mleader}")
file(MAKE_DIRECTORY "${_convert_out_table}")
file(MAKE_DIRECTORY "${_convert_out_text_kinds}")
file(MAKE_DIRECTORY "${_convert_out_hatch_large}")
file(MAKE_DIRECTORY "${_convert_out_blocks}")
file(MAKE_DIRECTORY "${_convert_out_importer_entities}")
file(MAKE_DIRECTORY "${_convert_out_importer_text_metadata}")
file(MAKE_DIRECTORY "${_convert_out_nonfinite}")
file(MAKE_DIRECTORY "${_convert_out_insert_text_bundle}")
file(MAKE_DIRECTORY "${_convert_out_insert_text_bundle_variant}")
file(MAKE_DIRECTORY "${_convert_out_hatch_dense}")

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${mixedinputdxf}" --out "${_convert_out_mixed}" --json --gltf
  RESULT_VARIABLE rc_convert_mixed
  OUTPUT_VARIABLE _stdout_convert_mixed
  ERROR_VARIABLE _stderr_convert_mixed
)
if(NOT rc_convert_mixed EQUAL 0)
  message(FATAL_ERROR "convert_cli mixed failed with code ${rc_convert_mixed}: ${_stderr_convert_mixed}\n${_stdout_convert_mixed}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${paperspaceinputdxf}" --out "${_convert_out_paperspace}" --json --gltf
  RESULT_VARIABLE rc_convert_paperspace
  OUTPUT_VARIABLE _stdout_convert_paperspace
  ERROR_VARIABLE _stderr_convert_paperspace
)
if(NOT rc_convert_paperspace EQUAL 0)
  message(FATAL_ERROR "convert_cli paperspace failed with code ${rc_convert_paperspace}: ${_stderr_convert_paperspace}\n${_stdout_convert_paperspace}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${stylesinputdxf}" --out "${_convert_out_styles}" --json --gltf
  RESULT_VARIABLE rc_convert_styles
  OUTPUT_VARIABLE _stdout_convert_styles
  ERROR_VARIABLE _stderr_convert_styles
)
if(NOT rc_convert_styles EQUAL 0)
  message(FATAL_ERROR "convert_cli styles failed with code ${rc_convert_styles}: ${_stderr_convert_styles}\n${_stdout_convert_styles}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${stylesvariantinputdxf}" --out "${_convert_out_styles_variant}" --json --gltf
  RESULT_VARIABLE rc_convert_styles_variant
  OUTPUT_VARIABLE _stdout_convert_styles_variant
  ERROR_VARIABLE _stderr_convert_styles_variant
)
if(NOT rc_convert_styles_variant EQUAL 0)
  message(FATAL_ERROR "convert_cli styles variant failed with code ${rc_convert_styles_variant}: ${_stderr_convert_styles_variant}\n${_stdout_convert_styles_variant}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${dimensioninputdxf}" --out "${_convert_out_dimension}" --json --gltf
  RESULT_VARIABLE rc_convert_dimension
  OUTPUT_VARIABLE _stdout_convert_dimension
  ERROR_VARIABLE _stderr_convert_dimension
)
if(NOT rc_convert_dimension EQUAL 0)
  message(FATAL_ERROR "convert_cli dimension failed with code ${rc_convert_dimension}: ${_stderr_convert_dimension}\n${_stdout_convert_dimension}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${dimensionhatchinputdxf}" --out "${_convert_out_dimension_hatch}" --json --gltf
  RESULT_VARIABLE rc_convert_dimension_hatch
  OUTPUT_VARIABLE _stdout_convert_dimension_hatch
  ERROR_VARIABLE _stderr_convert_dimension_hatch
)
if(NOT rc_convert_dimension_hatch EQUAL 0)
  message(FATAL_ERROR "convert_cli dimension+hatch failed with code ${rc_convert_dimension_hatch}: ${_stderr_convert_dimension_hatch}\n${_stdout_convert_dimension_hatch}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${annotationbundleinputdxf}" --out "${_convert_out_annotation_bundle}" --json --gltf
  RESULT_VARIABLE rc_convert_annotation_bundle
  OUTPUT_VARIABLE _stdout_convert_annotation_bundle
  ERROR_VARIABLE _stderr_convert_annotation_bundle
)
if(NOT rc_convert_annotation_bundle EQUAL 0)
  message(FATAL_ERROR "convert_cli annotation bundle failed with code ${rc_convert_annotation_bundle}: ${_stderr_convert_annotation_bundle}\n${_stdout_convert_annotation_bundle}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${comboinputdxf}" --out "${_convert_out_combo}" --json --gltf
  RESULT_VARIABLE rc_convert_combo
  OUTPUT_VARIABLE _stdout_convert_combo
  ERROR_VARIABLE _stderr_convert_combo
)
if(NOT rc_convert_combo EQUAL 0)
  message(FATAL_ERROR "convert_cli combo failed with code ${rc_convert_combo}: ${_stderr_convert_combo}\n${_stdout_convert_combo}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${multilayoutinputdxf}" --out "${_convert_out_multilayout}" --json --gltf
  RESULT_VARIABLE rc_convert_multilayout
  OUTPUT_VARIABLE _stdout_convert_multilayout
  ERROR_VARIABLE _stderr_convert_multilayout
)
if(NOT rc_convert_multilayout EQUAL 0)
  message(FATAL_ERROR "convert_cli multi-layout failed with code ${rc_convert_multilayout}: ${_stderr_convert_multilayout}\n${_stdout_convert_multilayout}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${viewportinputdxf}" --out "${_convert_out_viewport}" --json --gltf
  RESULT_VARIABLE rc_convert_viewport
  OUTPUT_VARIABLE _stdout_convert_viewport
  ERROR_VARIABLE _stderr_convert_viewport
)
if(NOT rc_convert_viewport EQUAL 0)
  message(FATAL_ERROR "convert_cli viewport failed with code ${rc_convert_viewport}: ${_stderr_convert_viewport}\n${_stdout_convert_viewport}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${triadinputdxf}" --out "${_convert_out_triad}" --json --gltf
  RESULT_VARIABLE rc_convert_triad
  OUTPUT_VARIABLE _stdout_convert_triad
  ERROR_VARIABLE _stderr_convert_triad
)
if(NOT rc_convert_triad EQUAL 0)
  message(FATAL_ERROR "convert_cli triad failed with code ${rc_convert_triad}: ${_stderr_convert_triad}\n${_stdout_convert_triad}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${leaderinputdxf}" --out "${_convert_out_leader}" --json --gltf
  RESULT_VARIABLE rc_convert_leader
  OUTPUT_VARIABLE _stdout_convert_leader
  ERROR_VARIABLE _stderr_convert_leader
)
if(NOT rc_convert_leader EQUAL 0)
  message(FATAL_ERROR "convert_cli leader failed with code ${rc_convert_leader}: ${_stderr_convert_leader}\n${_stdout_convert_leader}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${hatchinputdxf}" --out "${_convert_out_hatch}" --json --gltf
  RESULT_VARIABLE rc_convert_hatch
  OUTPUT_VARIABLE _stdout_convert_hatch
  ERROR_VARIABLE _stderr_convert_hatch
)
if(NOT rc_convert_hatch EQUAL 0)
  message(FATAL_ERROR "convert_cli hatch failed with code ${rc_convert_hatch}: ${_stderr_convert_hatch}\n${_stdout_convert_hatch}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${hatchdashinputdxf}" --out "${_convert_out_hatch_dash}" --json --gltf
  RESULT_VARIABLE rc_convert_hatch_dash
  OUTPUT_VARIABLE _stdout_convert_hatch_dash
  ERROR_VARIABLE _stderr_convert_hatch_dash
)
if(NOT rc_convert_hatch_dash EQUAL 0)
  message(FATAL_ERROR "convert_cli hatch dash failed with code ${rc_convert_hatch_dash}: ${_stderr_convert_hatch_dash}\n${_stdout_convert_hatch_dash}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${hatchlargeinputdxf}" --out "${_convert_out_hatch_large}" --json --gltf
  RESULT_VARIABLE rc_convert_hatch_large
  OUTPUT_VARIABLE _stdout_convert_hatch_large
  ERROR_VARIABLE _stderr_convert_hatch_large
)
if(NOT rc_convert_hatch_large EQUAL 0)
  message(FATAL_ERROR "convert_cli hatch large failed with code ${rc_convert_hatch_large}: ${_stderr_convert_hatch_large}\n${_stdout_convert_hatch_large}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${blocksinputdxf}" --out "${_convert_out_blocks}" --json --gltf
  RESULT_VARIABLE rc_convert_blocks
  OUTPUT_VARIABLE _stdout_convert_blocks
  ERROR_VARIABLE _stderr_convert_blocks
)
if(NOT rc_convert_blocks EQUAL 0)
  message(FATAL_ERROR "convert_cli blocks failed with code ${rc_convert_blocks}: ${_stderr_convert_blocks}\n${_stdout_convert_blocks}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${importerentitiesinputdxf}" --out "${_convert_out_importer_entities}" --json --gltf
  RESULT_VARIABLE rc_convert_importer_entities
  OUTPUT_VARIABLE _stdout_convert_importer_entities
  ERROR_VARIABLE _stderr_convert_importer_entities
)
if(NOT rc_convert_importer_entities EQUAL 0)
  message(FATAL_ERROR "convert_cli importer_entities failed with code ${rc_convert_importer_entities}: ${_stderr_convert_importer_entities}\n${_stdout_convert_importer_entities}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${importertextmetadatainputdxf}" --out "${_convert_out_importer_text_metadata}" --json
  RESULT_VARIABLE rc_convert_importer_text_metadata
  OUTPUT_VARIABLE _stdout_convert_importer_text_metadata
  ERROR_VARIABLE _stderr_convert_importer_text_metadata
)
if(NOT rc_convert_importer_text_metadata EQUAL 0)
  message(FATAL_ERROR "convert_cli importer_text_metadata failed with code ${rc_convert_importer_text_metadata}: ${_stderr_convert_importer_text_metadata}\n${_stdout_convert_importer_text_metadata}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${nonfiniteinputdxf}" --out "${_convert_out_nonfinite}" --json --gltf
  RESULT_VARIABLE rc_convert_nonfinite
  OUTPUT_VARIABLE _stdout_convert_nonfinite
  ERROR_VARIABLE _stderr_convert_nonfinite
)
if(NOT rc_convert_nonfinite EQUAL 0)
  message(FATAL_ERROR "convert_cli nonfinite failed with code ${rc_convert_nonfinite}: ${_stderr_convert_nonfinite}\n${_stdout_convert_nonfinite}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${inserttextbundleinputdxf}" --out "${_convert_out_insert_text_bundle}" --json --gltf
  RESULT_VARIABLE rc_convert_insert_text_bundle
  OUTPUT_VARIABLE _stdout_convert_insert_text_bundle
  ERROR_VARIABLE _stderr_convert_insert_text_bundle
)
if(NOT rc_convert_insert_text_bundle EQUAL 0)
  message(FATAL_ERROR "convert_cli insert_text_bundle failed with code ${rc_convert_insert_text_bundle}: ${_stderr_convert_insert_text_bundle}\n${_stdout_convert_insert_text_bundle}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${inserttextbundlevariantinputdxf}" --out "${_convert_out_insert_text_bundle_variant}" --json --gltf
  RESULT_VARIABLE rc_convert_insert_text_bundle_variant
  OUTPUT_VARIABLE _stdout_convert_insert_text_bundle_variant
  ERROR_VARIABLE _stderr_convert_insert_text_bundle_variant
)
if(NOT rc_convert_insert_text_bundle_variant EQUAL 0)
  message(FATAL_ERROR "convert_cli insert_text_bundle_variant failed with code ${rc_convert_insert_text_bundle_variant}: ${_stderr_convert_insert_text_bundle_variant}\n${_stdout_convert_insert_text_bundle_variant}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${textalignpartialinputdxf}" --out "${_convert_out_text_align_partial}" --json
  RESULT_VARIABLE rc_convert_text_align_partial
  OUTPUT_VARIABLE _stdout_convert_text_align_partial
  ERROR_VARIABLE _stderr_convert_text_align_partial
)
if(NOT rc_convert_text_align_partial EQUAL 0)
  message(FATAL_ERROR "convert_cli text align partial failed with code ${rc_convert_text_align_partial}: ${_stderr_convert_text_align_partial}\n${_stdout_convert_text_align_partial}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${textalignextinputdxf}" --out "${_convert_out_text_align_ext}" --json
  RESULT_VARIABLE rc_convert_text_align_ext
  OUTPUT_VARIABLE _stdout_convert_text_align_ext
  ERROR_VARIABLE _stderr_convert_text_align_ext
)
if(NOT rc_convert_text_align_ext EQUAL 0)
  message(FATAL_ERROR "convert_cli text align extended failed with code ${rc_convert_text_align_ext}: ${_stderr_convert_text_align_ext}\n${_stdout_convert_text_align_ext}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${mleaderinputdxf}" --out "${_convert_out_mleader}" --json
  RESULT_VARIABLE rc_convert_mleader
  OUTPUT_VARIABLE _stdout_convert_mleader
  ERROR_VARIABLE _stderr_convert_mleader
)
if(NOT rc_convert_mleader EQUAL 0)
  message(FATAL_ERROR "convert_cli mleader failed with code ${rc_convert_mleader}: ${_stderr_convert_mleader}\n${_stdout_convert_mleader}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${tableinputdxf}" --out "${_convert_out_table}" --json
  RESULT_VARIABLE rc_convert_table
  OUTPUT_VARIABLE _stdout_convert_table
  ERROR_VARIABLE _stderr_convert_table
)
if(NOT rc_convert_table EQUAL 0)
  message(FATAL_ERROR "convert_cli table failed with code ${rc_convert_table}: ${_stderr_convert_table}\n${_stdout_convert_table}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${textkindsinputdxf}" --out "${_convert_out_text_kinds}" --json
  RESULT_VARIABLE rc_convert_text_kinds
  OUTPUT_VARIABLE _stdout_convert_text_kinds
  ERROR_VARIABLE _stderr_convert_text_kinds
)
if(NOT rc_convert_text_kinds EQUAL 0)
  message(FATAL_ERROR "convert_cli text kinds failed with code ${rc_convert_text_kinds}: ${_stderr_convert_text_kinds}\n${_stdout_convert_text_kinds}")
endif()

execute_process(
  COMMAND "${exe}" --plugin "${plugin}" --input "${hatchdenseinputdxf}" --out "${_convert_out_hatch_dense}" --json --gltf
  RESULT_VARIABLE rc_convert_hatch_dense
  OUTPUT_VARIABLE _stdout_convert_hatch_dense
  ERROR_VARIABLE _stderr_convert_hatch_dense
)
if(NOT rc_convert_hatch_dense EQUAL 0)
  message(FATAL_ERROR "convert_cli hatch dense failed with code ${rc_convert_hatch_dense}: ${_stderr_convert_hatch_dense}\n${_stdout_convert_hatch_dense}")
endif()

set(_inputdoc_mixed "${_convert_out_mixed}/document.json")
set(_inputdoc_paperspace "${_convert_out_paperspace}/document.json")
set(_inputdoc_styles "${_convert_out_styles}/document.json")
set(_inputdoc_styles_variant "${_convert_out_styles_variant}/document.json")
set(_inputdoc_dimension "${_convert_out_dimension}/document.json")
set(_inputdoc_dimension_hatch "${_convert_out_dimension_hatch}/document.json")
set(_inputdoc_annotation_bundle "${_convert_out_annotation_bundle}/document.json")
set(_inputdoc_combo "${_convert_out_combo}/document.json")
set(_inputdoc_multilayout "${_convert_out_multilayout}/document.json")
set(_inputdoc_viewport "${_convert_out_viewport}/document.json")
set(_inputdoc_triad "${_convert_out_triad}/document.json")
set(_inputdoc_leader "${_convert_out_leader}/document.json")
set(_inputdoc_hatch "${_convert_out_hatch}/document.json")
set(_inputdoc_hatch_dash "${_convert_out_hatch_dash}/document.json")
set(_inputdoc_text_align_partial "${_convert_out_text_align_partial}/document.json")
set(_inputdoc_text_align_ext "${_convert_out_text_align_ext}/document.json")
set(_inputdoc_mleader "${_convert_out_mleader}/document.json")
set(_inputdoc_table "${_convert_out_table}/document.json")
set(_inputdoc_text_kinds "${_convert_out_text_kinds}/document.json")
set(_inputdoc_hatch_large "${_convert_out_hatch_large}/document.json")
set(_inputdoc_blocks "${_convert_out_blocks}/document.json")
set(_inputdoc_importer_entities "${_convert_out_importer_entities}/document.json")
set(_inputdoc_importer_text_metadata "${_convert_out_importer_text_metadata}/document.json")
set(_inputdoc_nonfinite "${_convert_out_nonfinite}/document.json")
set(_inputdoc_insert_text_bundle "${_convert_out_insert_text_bundle}/document.json")
set(_inputdoc_insert_text_bundle_variant "${_convert_out_insert_text_bundle_variant}/document.json")
set(_inputdoc_hatch_dense "${_convert_out_hatch_dense}/document.json")
foreach(_doc IN ITEMS _inputdoc_mixed _inputdoc_paperspace _inputdoc_styles _inputdoc_styles_variant _inputdoc_dimension _inputdoc_dimension_hatch _inputdoc_annotation_bundle _inputdoc_combo _inputdoc_multilayout _inputdoc_viewport _inputdoc_triad _inputdoc_leader _inputdoc_hatch _inputdoc_hatch_dash _inputdoc_hatch_large _inputdoc_blocks _inputdoc_importer_entities _inputdoc_importer_text_metadata _inputdoc_nonfinite _inputdoc_insert_text_bundle _inputdoc_insert_text_bundle_variant _inputdoc_text_align_partial _inputdoc_text_align_ext _inputdoc_mleader _inputdoc_table _inputdoc_text_kinds _inputdoc_hatch_dense)
  if(NOT EXISTS "${${_doc}}")
    message(FATAL_ERROR "document.json not created: ${${_doc}}")
  endif()
endforeach()

set(_cases "${outdir}/editor_assembly_roundtrip_dense_cases.json")
file(WRITE "${_cases}" "[\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_mixed_origin\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_mixed}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"mixed\", \"dense\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_paperspace_insert_leader\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_paperspace}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"paperspace\", \"dense\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_paperspace_insert_styles\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_styles}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"paperspace\", \"dense\", \"styles\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_paperspace_insert_styles_variant\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_styles_variant}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"paperspace\", \"dense\", \"styles\", \"variant\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_paperspace_insert_dimension\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_dimension}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"paperspace\", \"dense\", \"dimension\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_paperspace_insert_dimension_hatch\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_dimension_hatch}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"paperspace\", \"dense\", \"dimension\", \"hatch\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_paperspace_annotation_bundle\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_annotation_bundle}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"paperspace\", \"dense\", \"dimension\", \"hatch\", \"leader\", \"text\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_paperspace_combo\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_combo}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"paperspace\", \"dense\", \"dimension\", \"hatch\", \"leader\", \"text\", \"combo\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_multi_layout\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_multilayout}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"paperspace\", \"dense\", \"layout\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_viewport_sample\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_viewport}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"paperspace\", \"dense\", \"viewport\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_insert_triad\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_triad}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"model\", \"dense\", \"insert\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_leader_proxy\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_leader}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"proxy\", \"leader\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_hatch_proxy\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_hatch}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"proxy\", \"hatch\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_hatch_dash_proxy\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_hatch_dash}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"proxy\", \"hatch\", \"dash\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_hatch_large_boundary\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_hatch_large}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"proxy\", \"hatch\", \"large-boundary\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_blocks_importer\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_blocks}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"model\", \"insert\", \"blocks\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_importer_entities\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_importer_entities}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"importer\", \"entities\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_importer_text_metadata\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_importer_text_metadata}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"importer\", \"text\", \"dimension\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_nonfinite_text_skip\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_nonfinite}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"robustness\", \"text\", \"sanitization\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_insert_text_bundle\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_insert_text_bundle}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"model\", \"insert\", \"text\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_insert_text_bundle_variant\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_insert_text_bundle_variant}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"model\", \"insert\", \"text\", \"variant\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_text_align_partial\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_text_align_partial}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"text\", \"alignment\", \"partial\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_text_align_extended\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_text_align_ext}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"text\", \"alignment\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_mleader_textonly\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_mleader}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"text\", \"mleader\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_table_textonly\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_table}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"text\", \"table\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_text_kinds_textonly\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_text_kinds}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"text\", \"attrib\", \"attdef\", \"mtext\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  },\n")
file(APPEND "${_cases}" "  {\n")
file(APPEND "${_cases}" "    \"name\": \"assembly_dense_hatch_dense_proxy\",\n")
file(APPEND "${_cases}" "    \"path\": \"${_inputdoc_hatch_dense}\",\n")
file(APPEND "${_cases}" "    \"tags\": [\"assembly-roundtrip\", \"dense\", \"proxy\", \"hatch\", \"dense-pattern\"],\n")
file(APPEND "${_cases}" "    \"priority\": \"P1\"\n")
file(APPEND "${_cases}" "  }\n")
file(APPEND "${_cases}" "]\n")

execute_process(
  COMMAND "${NODE_EXE}" tools/web_viewer/scripts/editor_roundtrip_smoke.js
    --mode gate
    --cases "${_cases}"
    --limit 27
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
file(READ "${_inputdoc_mixed}" _input_text_mixed)
file(READ "${_inputdoc_paperspace}" _input_text_paperspace)
file(READ "${_inputdoc_styles}" _input_text_styles)
file(READ "${_inputdoc_styles_variant}" _input_text_styles_variant)
file(READ "${_inputdoc_dimension}" _input_text_dimension)
file(READ "${_inputdoc_dimension_hatch}" _input_text_dimension_hatch)
file(READ "${_inputdoc_annotation_bundle}" _input_text_annotation_bundle)
file(READ "${_inputdoc_combo}" _input_text_combo)
file(READ "${_inputdoc_multilayout}" _input_text_multilayout)
file(READ "${_inputdoc_viewport}" _input_text_viewport)
file(READ "${_inputdoc_triad}" _input_text_triad)
file(READ "${_inputdoc_leader}" _input_text_leader)
file(READ "${_inputdoc_hatch}" _input_text_hatch)
file(READ "${_inputdoc_hatch_dash}" _input_text_hatch_dash)
file(READ "${_inputdoc_hatch_large}" _input_text_hatch_large)
file(READ "${_inputdoc_blocks}" _input_text_blocks)
file(READ "${_inputdoc_importer_entities}" _input_text_importer_entities)
file(READ "${_inputdoc_importer_text_metadata}" _input_text_importer_text_metadata)
file(READ "${_inputdoc_nonfinite}" _input_text_nonfinite)
file(READ "${_inputdoc_insert_text_bundle}" _input_text_insert_text_bundle)
file(READ "${_inputdoc_insert_text_bundle_variant}" _input_text_insert_text_bundle_variant)
file(READ "${_inputdoc_text_align_partial}" _input_text_text_align_partial)
file(READ "${_inputdoc_text_align_ext}" _input_text_text_align_ext)
file(READ "${_inputdoc_mleader}" _input_text_mleader)
file(READ "${_inputdoc_table}" _input_text_table)
file(READ "${_inputdoc_text_kinds}" _input_text_text_kinds)
file(READ "${_inputdoc_hatch_dense}" _input_text_hatch_dense)

foreach(_needle
    [=["pass": 27]=]
    [=["fail": 0]=]
    [=["name": "assembly_dense_mixed_origin"]=]
    [=["name": "assembly_dense_paperspace_insert_leader"]=]
    [=["name": "assembly_dense_paperspace_insert_styles"]=]
    [=["name": "assembly_dense_paperspace_insert_styles_variant"]=]
    [=["name": "assembly_dense_paperspace_insert_dimension"]=]
    [=["name": "assembly_dense_paperspace_insert_dimension_hatch"]=]
    [=["name": "assembly_dense_paperspace_annotation_bundle"]=]
    [=["name": "assembly_dense_paperspace_combo"]=]
    [=["name": "assembly_dense_multi_layout"]=]
    [=["name": "assembly_dense_viewport_sample"]=]
    [=["name": "assembly_dense_insert_triad"]=]
    [=["name": "assembly_dense_leader_proxy"]=]
    [=["name": "assembly_dense_hatch_proxy"]=]
    [=["name": "assembly_dense_hatch_dash_proxy"]=]
    [=["name": "assembly_dense_hatch_large_boundary"]=]
    [=["name": "assembly_dense_blocks_importer"]=]
    [=["name": "assembly_dense_importer_entities"]=]
    [=["name": "assembly_dense_importer_text_metadata"]=]
    [=["name": "assembly_dense_nonfinite_text_skip"]=]
    [=["name": "assembly_dense_insert_text_bundle"]=]
    [=["name": "assembly_dense_insert_text_bundle_variant"]=]
    [=["name": "assembly_dense_text_align_partial"]=]
    [=["name": "assembly_dense_text_align_extended"]=]
    [=["name": "assembly_dense_mleader_textonly"]=]
    [=["name": "assembly_dense_table_textonly"]=]
    [=["name": "assembly_dense_text_kinds_textonly"]=]
    [=["name": "assembly_dense_hatch_dense_proxy"]=]
    [=["derived_proxy_count": 9]=]
    [=["exploded_origin_count": 2]=]
    [=["assembly_tracked_count": 14]=]
    [=["assembly_group_count": 5]=]
    [=["derived_proxy_count": 1]=]
    [=["assembly_tracked_count": 4]=]
    [=["assembly_group_count": 2]=]
    [=["derived_proxy_count": 0]=]
    [=["assembly_tracked_count": 3]=]
    [=["checked_count": 14]=]
    [=["checked_count": 4]=]
    [=["checked_count": 3]=]
    [=["checked_count": 14]=]
    [=["assembly_tracked_count": 1]=]
    [=["checked_count": 1]=]
    [=["assembly_tracked_count": 2]=]
    [=["assembly_group_count": 1]=]
    [=["text_kind_counts": {]=]
    [=["text": 1]=]
    [=["group_count": 1]=]
    [=["group_count": 5]=]
    [=["group_count": 2]=]
    [=["group_count": 6]=]
    [=["group_drift_count": 0]=]
    [=["metadata_drift_count": 0]=]
    [=["ok": true]=])
  string(FIND "${_summary_text}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense editor assembly roundtrip summary:\n${_summary_text}")
  endif()
endforeach()

foreach(_needle
    [=["text_kind": "text"]=]
    [=["source_type": "INSERT"]=]
    [=["edit_mode": "exploded"]=]
    [=["proxy_kind": "insert"]=]
    [=["block_name": "BlockBundle"]=]
    [=["space": 0]=])
  string(FIND "${_input_text_insert_text_bundle}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense insert_text_bundle source document:\n${_input_text_insert_text_bundle}")
  endif()
endforeach()

foreach(_needle
    [=["text_kind": "text"]=]
    [=["source_type": "INSERT"]=]
    [=["edit_mode": "exploded"]=]
    [=["proxy_kind": "insert"]=]
    [=["block_name": "BlockBundleB"]=]
    [=["group_id": 1]=]
    [=["space": 0]=])
  string(FIND "${_input_text_insert_text_bundle_variant}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense insert_text_bundle_variant source document:\n${_input_text_insert_text_bundle_variant}")
  endif()
endforeach()

foreach(_needle
    [=["text_kind": "text"]=]
    [=["text_kind": "dimension"]=]
    [=["source_type": "DIMENSION"]=]
    [=["proxy_kind": "dimension"]=]
    [=["dim_style": "STANDARD"]=]
    [=["space": 0]=])
  string(FIND "${_input_text_importer_text_metadata}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense importer_text_metadata source document:\n${_input_text_importer_text_metadata}")
  endif()
endforeach()

foreach(_needle
    [=["dxf.text.nonfinite_values": "2"]=]
    [=["dxf.text.skipped_missing_xy": "2"]=]
    [=["space": 0]=]
    [=["type": 2]=])
  string(FIND "${_input_text_nonfinite}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense nonfinite source document:\n${_input_text_nonfinite}")
  endif()
endforeach()

foreach(_needle
    [=["space": 1]=]
    [=["layout": "PaperSpace"]=])
  string(FIND "${_input_text_viewport}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense viewport source document:\n${_input_text_viewport}")
  endif()
endforeach()

foreach(_needle
    [=["source_type": "LEADER"]=]
    [=["proxy_kind": "leader"]=]
    [=["space": 0]=])
  string(FIND "${_input_text_leader}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense leader source document:\n${_input_text_leader}")
  endif()
endforeach()

foreach(_needle
    [=["source_type": "HATCH"]=]
    [=["proxy_kind": "hatch"]=]
    [=["hatch_pattern": "ANSI31"]=]
    [=["space": 0]=])
  string(FIND "${_input_text_hatch}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense hatch source document:\n${_input_text_hatch}")
  endif()
endforeach()

foreach(_needle
    [=["source_type": "HATCH"]=]
    [=["proxy_kind": "hatch"]=]
    [=["hatch_pattern": "ANSI31"]=]
    [=["space": 0]=])
  string(FIND "${_input_text_hatch_dash}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense hatch-dash source document:\n${_input_text_hatch_dash}")
  endif()
endforeach()

foreach(_needle
    [=["source_type": "HATCH"]=]
    [=["proxy_kind": "hatch"]=]
    [=["space": 0]=])
  string(FIND "${_input_text_hatch_large}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense hatch-large source document:\n${_input_text_hatch_large}")
  endif()
endforeach()

foreach(_needle
    [=["text_kind": "text"]=]
    [=["space": 0]=])
  string(FIND "${_input_text_text_align_partial}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense text-align-partial source document:\n${_input_text_text_align_partial}")
  endif()
endforeach()

foreach(_needle
    [=["text_kind": "text"]=]
    [=["text_kind": "attrib"]=]
    [=["text_kind": "attdef"]=]
    [=["text_kind": "mtext"]=]
    [=["space": 0]=])
  string(FIND "${_input_text_text_align_ext}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense text-align source document:\n${_input_text_text_align_ext}")
  endif()
endforeach()

foreach(_needle
    [=["text_kind": "attrib"]=]
    [=["text_kind": "attdef"]=]
    [=["text_kind": "mtext"]=]
    [=["space": 0]=])
  string(FIND "${_input_text_text_kinds}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense text-kinds source document:\n${_input_text_text_kinds}")
  endif()
endforeach()

foreach(_needle
    [=["text_kind": "mleader"]=]
    [=["space": 0]=])
  string(FIND "${_input_text_mleader}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense mleader source document:\n${_input_text_mleader}")
  endif()
endforeach()

foreach(_needle
    [=["text_kind": "table"]=]
    [=["space": 0]=])
  string(FIND "${_input_text_table}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense table source document:\n${_input_text_table}")
  endif()
endforeach()

foreach(_needle
    [=["source_type": "HATCH"]=]
    [=["hatch_pattern"]=]
    [=["space": 0]=])
  string(FIND "${_input_text_hatch_dense}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense hatch-dense source document")
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
  string(FIND "${_input_text_mixed}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense mixed source document:\n${_input_text_mixed}")
  endif()
endforeach()

foreach(_needle
    [=["source_type": "LEADER"]=]
    [=["proxy_kind": "leader"]=]
    [=["block_name": "PaperStyledBlock"]=]
    [=["layout": "LayoutStyle"]=]
    [=["space": 1]=]
    [=["group_id": 1]=]
    [=["group_id": 2]=])
  string(FIND "${_input_text_paperspace}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense paperspace source document:\n${_input_text_paperspace}")
  endif()
endforeach()

foreach(_needle
    [=["source_type": "INSERT"]=]
    [=["proxy_kind": "insert"]=]
    [=["block_name": "PaperStyledBlock"]=]
    [=["layout": "LayoutStyle"]=]
    [=["space": 1]=]
    [=["group_id": 2]=]
    [=["line_type": "CENTER"]=]
    [=["line_type_scale": 0.25]=])
  string(FIND "${_input_text_styles}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense styles source document:\n${_input_text_styles}")
  endif()
endforeach()

foreach(_needle
    [=["source_type": "INSERT"]=]
    [=["proxy_kind": "insert"]=]
    [=["block_name": "PaperStyledBlockB"]=]
    [=["layout": "LayoutStyle"]=]
    [=["space": 1]=]
    [=["group_id": 2]=]
    [=["line_type": "CENTER"]=]
    [=["line_type": "CENTER2"]=]
    [=["line_type_scale": 0.25]=]
    [=["line_type_scale": 0.6]=])
  string(FIND "${_input_text_styles_variant}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense styles_variant source document:\n${_input_text_styles_variant}")
  endif()
endforeach()

foreach(_needle
    [=["source_type": "LEADER"]=]
    [=["proxy_kind": "leader"]=]
    [=["source_type": "DIMENSION"]=]
    [=["proxy_kind": "dimension"]=]
    [=["dim_style": "Standard"]=]
    [=["text_kind": "mtext"]=]
    [=["source_type": "INSERT"]=]
    [=["block_name": "PaperStyledBlock"]=]
    [=["layout": "LayoutStyle"]=]
    [=["space": 1]=]
    [=["group_id": 3]=]
    [=["group_id": 4]=]
    [=["group_id": 5]=])
  string(FIND "${_input_text_dimension}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense dimension source document:\n${_input_text_dimension}")
  endif()
endforeach()

foreach(_needle
    [=["source_type": "LEADER"]=]
    [=["proxy_kind": "leader"]=]
    [=["dxf.viewport.count": "1"]=]
    [=["dxf.viewport.0.layout": "LayoutStyle"]=]
    [=["source_type": "HATCH"]=]
    [=["proxy_kind": "hatch"]=]
    [=["hatch_pattern": "SOLID"]=]
    [=["hatch_id": 1]=]
    [=["source_type": "DIMENSION"]=]
    [=["proxy_kind": "dimension"]=]
    [=["dim_style": "Standard"]=]
    [=["text_kind": "mtext"]=]
    [=["source_type": "INSERT"]=]
    [=["block_name": "PaperStyledBlock"]=]
    [=["layout": "LayoutStyle"]=]
    [=["space": 1]=]
    [=["group_id": 1]=]
    [=["group_id": 2]=]
    [=["group_id": 3]=]
    [=["group_id": 4]=]
    [=["group_id": 5]=])
  string(FIND "${_input_text_dimension_hatch}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense dimension+hatch source document:\n${_input_text_dimension_hatch}")
  endif()
endforeach()

foreach(_needle
    [=["source_type": "LEADER"]=]
    [=["proxy_kind": "leader"]=]
    [=["dxf.viewport.count": "1"]=]
    [=["dxf.viewport.0.layout": "LayoutStyle"]=]
    [=["source_type": "HATCH"]=]
    [=["proxy_kind": "hatch"]=]
    [=["hatch_pattern": "SOLID"]=]
    [=["source_type": "DIMENSION"]=]
    [=["proxy_kind": "dimension"]=]
    [=["dim_style": "Standard"]=]
    [=["text_kind": "text"]=]
    [=["text_kind": "mtext"]=]
    [=["source_type": "INSERT"]=]
    [=["block_name": "PaperStyledBlock"]=]
    [=["layout": "LayoutStyle"]=]
    [=["space": 1]=]
    [=["group_id": 1]=]
    [=["group_id": 2]=]
    [=["group_id": 3]=]
    [=["group_id": 4]=]
    [=["group_id": 5]=]
    [=["group_id": 6]=])
  string(FIND "${_input_text_annotation_bundle}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense annotation bundle source document:\n${_input_text_annotation_bundle}")
  endif()
endforeach()

foreach(_needle
    [=["source_type": "LEADER"]=]
    [=["proxy_kind": "leader"]=]
    [=["dxf.viewport.count": "1"]=]
    [=["dxf.viewport.0.layout": "LayoutCombo"]=]
    [=["source_type": "HATCH"]=]
    [=["proxy_kind": "hatch"]=]
    [=["hatch_pattern": "SOLID"]=]
    [=["hatch_pattern": "ANSI31"]=]
    [=["source_type": "DIMENSION"]=]
    [=["proxy_kind": "dimension"]=]
    [=["dim_style": "Standard"]=]
    [=["text_kind": "text"]=]
    [=["text_kind": "mtext"]=]
    [=["source_type": "INSERT"]=]
    [=["block_name": "PaperComboBlock"]=]
    [=["layout": "LayoutCombo"]=]
    [=["space": 1]=]
    [=["group_id": 1]=]
    [=["group_id": 2]=]
    [=["group_id": 3]=]
    [=["group_id": 4]=]
    [=["group_id": 5]=]
    [=["group_id": 6]=]
    [=["group_id": 7]=]
    [=["group_id": 8]=])
  string(FIND "${_input_text_combo}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense combo source document:\n${_input_text_combo}")
  endif()
endforeach()

foreach(_needle
    [=["layout": "LayoutA"]=]
    [=["layout": "LayoutB"]=]
    [=["space": 1]=]
    [=["group_id": 1]=]
    [=["text_kind": "text"]=]
    [=["value": "LAYOUT B NOTE"]=])
  string(FIND "${_input_text_multilayout}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense multi-layout source document:\n${_input_text_multilayout}")
  endif()
endforeach()

foreach(_needle
    [=["source_type": "INSERT"]=]
    [=["proxy_kind": "insert"]=]
    [=["block_name": "BlockTriad"]=]
    [=["space": 0]=]
    [=["group_id": 1]=])
  string(FIND "${_input_text_triad}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense triad source document:\n${_input_text_triad}")
  endif()
endforeach()

foreach(_needle
    [=["type": 0]=]
    [=["type": 2]=]
    [=["type": 4]=]
    [=["type": 3]=]
    [=["type": 5]=]
    [=["type": 6]=]
    [=["type": 7]=]
    [=["space": 0]=]
    [=["value": "Hello DXF"]=])
  string(FIND "${_input_text_importer_entities}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in dense importer_entities source document:\n${_input_text_importer_entities}")
  endif()
endforeach()

message(STATUS "dense editor assembly roundtrip semantics validated")
