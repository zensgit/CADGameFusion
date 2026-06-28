if(NOT DEFINED exe OR NOT EXISTS "${exe}")
  message(FATAL_ERROR "render_cli executable not found: ${exe}")
endif()
if(NOT DEFINED input OR NOT EXISTS "${input}")
  message(FATAL_ERROR "input DXF not found: ${input}")
endif()

file(REMOVE "${out}" "${mask}" "${report}")
get_filename_component(out_dir "${out}" DIRECTORY)
get_filename_component(mask_dir "${mask}" DIRECTORY)
get_filename_component(report_dir "${report}" DIRECTORY)
file(MAKE_DIRECTORY "${out_dir}" "${mask_dir}" "${report_dir}")
execute_process(
  COMMAND "${exe}"
    --input "${input}"
    --out "${out}"
    --class-mask-out "${mask}"
    --report "${report}"
    --width 800
    --height 600
    --bg white
  RESULT_VARIABLE rc
  OUTPUT_VARIABLE stdout
  ERROR_VARIABLE stderr
)
if(NOT rc EQUAL 0)
  message(FATAL_ERROR "render_cli semantic class mask smoke failed (${rc})\nstdout=${stdout}\nstderr=${stderr}")
endif()

foreach(path IN ITEMS "${out}" "${mask}" "${report}")
  if(NOT EXISTS "${path}")
    message(FATAL_ERROR "expected output missing: ${path}")
  endif()
  file(SIZE "${path}" sz)
  if(sz LESS 1000)
    message(FATAL_ERROR "expected non-trivial output at ${path}, got ${sz} bytes")
  endif()
endforeach()

file(READ "${report}" rep)
foreach(needle IN ITEMS
    "\"semantic_classes\""
    "\"schema\": \"vemcad.render_semantic_classes\""
    "\"mask_kind\": \"candidate-renderer-semantic-class-buffer\""
    "\"reference_semantics\": \"unknown\""
    "\"text_placement\""
    "\"schema\": \"vemcad.render_text_placement\""
    "\"view_space\": \"same_as_color_render\""
    "\"records\""
    "\"geometry\""
    "\"text\"")
  string(FIND "${rep}" "${needle}" idx)
  if(idx LESS 0)
    message(FATAL_ERROR "report missing ${needle}: ${report}")
  endif()
endforeach()

# Optional: assert one OR MORE semantic classes are populated (non-zero entity_counts).
# expect_nonzero_class may be a single class or a CMake list (e.g. "dimension;hatch;insert_text").
# Used by the provenance regression tests. render_cli's import path (CadgfDrwAdapter)
# must emit "source_type" entity metadata for *D dimension blocks, block-nested solid
# hatches, and INSERT-sourced text; without it they silently fall back to geometry/text
# and the class count stays 0. "<class>":  appears only in entity_counts (palette uses "name").
if(DEFINED expect_nonzero_class)
  foreach(_cls IN LISTS expect_nonzero_class)
    string(FIND "${rep}" "\"${_cls}\":" present_idx)
    if(present_idx LESS 0)
      message(FATAL_ERROR "report has no '${_cls}' class entry: ${report}")
    endif()
    string(FIND "${rep}" "\"${_cls}\": 0" zero_idx)
    if(NOT zero_idx LESS 0)
      message(FATAL_ERROR "expected '${_cls}' semantic class to be non-zero "
        "(import-path provenance metadata missing?): ${report}")
    endif()
  endforeach()
endif()
