if(NOT DEFINED exe)
  message(FATAL_ERROR "exe not set")
endif()
if(NOT DEFINED outdir)
  message(FATAL_ERROR "outdir not set")
endif()

string(REGEX REPLACE "^\"(.*)\"$" "\\1" exe "${exe}")
string(REGEX REPLACE "^\"(.*)\"$" "\\1" outdir "${outdir}")

file(MAKE_DIRECTORY "${outdir}")
set(_input "${outdir}/bad_constraints_project.json")

file(WRITE "${_input}" [=[
{
  "header": {"format": "CADGF-PROJ", "version": 1},
  "project": {"id": "diag-demo", "units": "mm"},
  "scene": {
    "entities": [
      {"id": "p0", "type": "point", "params": {"x": 0, "y": 0}},
      {"id": "p1", "type": "point", "params": {"x": 1, "y": 1}}
    ],
    "constraints": [
      {"id": "c0", "type": "broken", "refs": ["p0.x", "p1.x"]},
      {"id": "c1", "type": "distance", "refs": ["p0.x", "p0.y", "p1.x", "p1.y"]},
      {"id": "c2", "type": "horizontal", "refs": ["p0.y"]},
      {"id": "c3", "type": "equal", "refs": ["p0.x", "missing.x"]},
      {"id": "c4", "type": "horizontal", "refs": ["p0.y", "p1.y"]},
      {"id": "c5", "type": "horizontal", "refs": ["p0.y", "p1.y"]}
    ]
  },
  "featureTree": {"nodes": [], "edges": []},
  "resources": {"sketches": [], "meshes": [], "materials": []},
  "meta": {}
}
]=])

execute_process(
  COMMAND "${exe}" --json "${_input}"
  RESULT_VARIABLE rc
  OUTPUT_VARIABLE _stdout
  ERROR_VARIABLE _stderr
)

if(NOT rc EQUAL 1)
  message(FATAL_ERROR "solve_from_project expected rc=1, got ${rc}: ${_stderr}\n${_stdout}")
endif()

foreach(_needle
    [=["ok": false]=]
    [=["message": "Constraint validation failed"]=]
    [=["analysis": {]=]
    [=["duplicate_constraint_count": 1]=]
    [=["duplicate_constraint_group_count": 1]=]
    [=["largest_duplicate_constraint_group_size": 2]=]
    [=["structural_state": "unknown"]=]
    [=["redundancy_groups": []=]
    [=["anchor_constraint_index": 4]=]
    [=["group_size": 2]=]
    [=["code": "unsupported_type"]=]
    [=["code": "missing_value"]=]
    [=["code": "wrong_arity"]=]
    [=["code": "unbound_variable"]=]
    [=["code": "duplicate_constraint"]=]
    [=["related_constraint_index": 4]=])
  string(FIND "${_stdout}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in solve_from_project output:\n${_stdout}")
  endif()
endforeach()

message(STATUS "solve_from_project JSON diagnostics validated")

set(_valid_input "${outdir}/rank_constraints_project.json")

file(WRITE "${_valid_input}" [=[
{
  "header": {"format": "CADGF-PROJ", "version": 1},
  "project": {"id": "rank-demo", "units": "mm"},
  "scene": {
    "entities": [
      {"id": "p0", "type": "point", "params": {"x": 0, "y": 0}},
      {"id": "p1", "type": "point", "params": {"x": 1, "y": 1}}
    ],
    "constraints": [
      {"id": "c0", "type": "horizontal", "refs": ["p0.y", "p1.y"]}
    ]
  },
  "featureTree": {"nodes": [], "edges": []},
  "resources": {"sketches": [], "meshes": [], "materials": []},
  "meta": {}
}
]=])

execute_process(
  COMMAND "${exe}" --json "${_valid_input}"
  RESULT_VARIABLE rc_valid
  OUTPUT_VARIABLE _stdout_valid
  ERROR_VARIABLE _stderr_valid
)

if(NOT rc_valid EQUAL 0)
  message(FATAL_ERROR "solve_from_project expected rc=0 for valid analysis case, got ${rc_valid}: ${_stderr_valid}\n${_stdout_valid}")
endif()

foreach(_needle
    [=["ok": true]=]
    [=["evaluable_constraint_count": 1]=]
    [=["jacobian_row_count": 1]=]
    [=["jacobian_column_count": 2]=]
    [=["jacobian_rank": 1]=]
    [=["dof_estimate": 1]=]
    [=["redundant_constraint_estimate": 0]=]
    [=["structural_state": "underconstrained"]=]
    [=["structural_summary": {]=]
    [=["state": "underconstrained"]=]
    [=["structural_group_count": 1]=]
    [=["underconstrained_group_count": 1]=]
    [=["conflict_group_count": 0]=]
    [=["redundancy_subset_count": 0]=]
    [=["redundant_constraint_candidate_count": 0]=]
    [=["free_variable_candidate_count": 1]=]
    [=["problematic_constraint_count": 0]=]
    [=["primary_conflict_anchor_constraint_index": -1]=]
    [=["primary_redundancy_subset_anchor_constraint_index": -1]=]
    [=["smallest_redundancy_subset_anchor_constraint_index": -1]=]
    "\"primary_conflict_constraint_indices\": []"
    "\"primary_redundancy_basis_constraint_indices\": []"
    "\"primary_redundant_constraint_indices\": []"
    "\"structural_groups\": ["
    "\"anchor_constraint_index\": 0"
    "\"basis_variable_keys\": ["
    "\"free_variable_keys\": ["
    "\"p0.y\""
    "\"p1.y\"")
  string(FIND "${_stdout_valid}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in solve_from_project valid analysis output:\n${_stdout_valid}")
  endif()
endforeach()

message(STATUS "solve_from_project JSON analysis validated")

set(_group_input "${outdir}/grouped_constraints_project.json")

file(WRITE "${_group_input}" [=[
{
  "header": {"format": "CADGF-PROJ", "version": 1},
  "project": {"id": "grouped-demo", "units": "mm"},
  "scene": {
    "entities": [
      {"id": "p0", "type": "point", "params": {"x": 0, "y": 0}},
      {"id": "p1", "type": "point", "params": {"x": 1, "y": 1}},
      {"id": "p2", "type": "point", "params": {"x": 5, "y": 2}},
      {"id": "p3", "type": "point", "params": {"x": 8, "y": 6}}
    ],
    "constraints": [
      {"id": "c0", "type": "horizontal", "refs": ["p0.y", "p1.y"]},
      {"id": "c1", "type": "equal", "refs": ["p2.x", "p3.x"]},
      {"id": "c2", "type": "vertical", "refs": ["p2.x", "p3.x"]}
    ]
  },
  "featureTree": {"nodes": [], "edges": []},
  "resources": {"sketches": [], "meshes": [], "materials": []},
  "meta": {}
}
]=])

execute_process(
  COMMAND "${exe}" --json "${_group_input}"
  RESULT_VARIABLE rc_group
  OUTPUT_VARIABLE _stdout_group
  ERROR_VARIABLE _stderr_group
)

if(NOT rc_group EQUAL 0)
  message(FATAL_ERROR "solve_from_project expected rc=0 for grouped analysis case, got ${rc_group}: ${_stderr_group}\n${_stdout_group}")
endif()

foreach(_needle
    [=["ok": true]=]
    [=["structural_group_count": 2]=]
    [=["underconstrained_group_count": 1]=]
    [=["mixed_group_count": 1]=]
    [=["conflict_group_count": 1]=]
    [=["largest_conflict_group_size": 2]=]
    [=["redundancy_subset_count": 1]=]
    [=["redundant_constraint_candidate_count": 1]=]
    [=["free_variable_candidate_count": 2]=]
    [=["problematic_constraint_count": 2]=]
    [=["primary_conflict_anchor_constraint_index": 1]=]
    [=["smallest_conflict_group_anchor_constraint_index": 1]=]
    [=["smallest_conflict_group_size": 2]=]
    [=["primary_redundancy_subset_anchor_constraint_index": 1]=]
    [=["smallest_redundancy_subset_anchor_constraint_index": 1]=]
    "\"primary_conflict_constraint_indices\": ["
    "\"smallest_conflict_constraint_indices\": ["
    "\"primary_redundancy_basis_constraint_indices\": ["
    "\"primary_redundant_constraint_indices\": ["
    "\"structural_groups\": ["
    "\"conflict_groups\": ["
    "\"redundancy_subsets\": ["
    "\"anchor_constraint_index\": 0"
    "\"anchor_constraint_index\": 1"
    [=["state": "underconstrained"]=]
    [=["state": "mixed"]=]
    "\"constraint_indices\": ["
    "\"basis_constraint_indices\": ["
    "\"redundant_constraint_indices\": ["
    "\"priority_score\": "
    "\"witness_constraint_count\": 2"
    "\"basis_variable_keys\": ["
    "\"free_variable_keys\": ["
    "\"p0.y\""
    "\"p2.x\""
    "\"p1.y\""
    "\"p3.x\""
    "\"problematic_constraint_indices\": ["
    "1,"
    "2")
  string(FIND "${_stdout_group}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in solve_from_project grouped analysis output:\n${_stdout_group}")
  endif()
endforeach()

message(STATUS "solve_from_project JSON structural groups validated")

set(_ranked_input "${outdir}/ranked_constraints_project.json")

file(WRITE "${_ranked_input}" [=[
{
  "header": {"format": "CADGF-PROJ", "version": 1},
  "project": {"id": "ranked-groups-demo", "units": "mm"},
  "scene": {
    "entities": [
      {"id": "p0", "type": "point", "params": {"x": 0, "y": 0}},
      {"id": "p1", "type": "point", "params": {"x": 1, "y": 1}},
      {"id": "p4", "type": "point", "params": {"x": 20, "y": 0}},
      {"id": "p5", "type": "point", "params": {"x": 24, "y": 3}}
    ],
    "constraints": [
      {"id": "c0", "type": "equal", "refs": ["p0.x", "p1.x"]},
      {"id": "c1", "type": "vertical", "refs": ["p0.x", "p1.x"]},
      {"id": "c2", "type": "equal", "refs": ["p4.x", "p5.x"]},
      {"id": "c3", "type": "vertical", "refs": ["p4.x", "p5.x"]},
      {"id": "c4", "type": "distance", "refs": ["p4.x", "p4.y", "p5.x", "p5.y"], "value": 5.0}
    ]
  },
  "featureTree": {"nodes": [], "edges": []},
  "resources": {"sketches": [], "meshes": [], "materials": []},
  "meta": {}
}
]=])

execute_process(
  COMMAND "${exe}" --json "${_ranked_input}"
  RESULT_VARIABLE rc_ranked
  OUTPUT_VARIABLE _stdout_ranked
  ERROR_VARIABLE _stderr_ranked
)

if(NOT rc_ranked EQUAL 0)
  message(FATAL_ERROR "solve_from_project expected rc=0 for ranked conflict case, got ${rc_ranked}: ${_stderr_ranked}\n${_stdout_ranked}")
endif()

foreach(_needle
    [=["ok": true]=]
    [=["conflict_group_count": 2]=]
    [=["redundancy_subset_count": 2]=]
    [=["primary_conflict_anchor_constraint_index": 2]=]
    [=["smallest_conflict_group_anchor_constraint_index": 0]=]
    [=["smallest_conflict_group_size": 2]=]
    [=["primary_redundancy_subset_anchor_constraint_index": 0]=]
    [=["smallest_redundancy_subset_anchor_constraint_index": 0]=]
    "\"primary_conflict_constraint_indices\": ["
    "\"smallest_conflict_constraint_indices\": ["
    "\"primary_redundancy_basis_constraint_indices\": ["
    "\"primary_redundant_constraint_indices\": ["
    "\"smallest_redundancy_basis_constraint_indices\": ["
    "\"smallest_redundant_constraint_indices\": ["
    "\"primary_conflict_priority_breakdown\": {"
    "\"primary_conflict_selection_explanation\": \"highest_priority_conflict_group\""
    "\"primary_conflict_selection_tag\": \"conflict-primary-priority\""
    "\"primary_conflict_selection_summary\": \"highest_priority_conflict_group("
    "\"primary_conflict_action_label\": \"Relax primary conflict\""
    "\"primary_conflict_action_hint\": \"Inspect the primary conflict group first"
    "\"primary_conflict_action\": {"
    "\"action_panel_count\": 4"
    "\"action_panels\": ["
    "\"id\": \"primary_conflict\""
    "\"id\": \"smallest_conflict\""
    "\"id\": \"primary_redundancy\""
    "\"id\": \"smallest_redundancy\""
    "\"category\": \"conflict\""
    "\"category\": \"redundancy\""
    "\"scope\": \"primary\""
    "\"scope\": \"smallest\""
    "\"constraint_indices\": ["
    "\"basis_constraint_indices\": ["
    "\"redundant_constraint_indices\": ["
    "\"ui\": {"
    "\"title\": \"Relax primary conflict\""
    "\"badge_label\": \"Conflict\""
    "\"severity\": \"warning\""
    "\"cta_label\": \"Relax primary conflict\""
    "\"recommended\": true"
    "\"display_order\": 0"
    "\"label\": \"Relax primary conflict\""
    "\"primary_conflict_variable_keys\": ["
    "\"primary_conflict_free_variable_keys\": ["
    "\"primary_conflict_selection_policy\": ["
    "\"smallest_conflict_priority_breakdown\": {"
    "\"smallest_conflict_selection_explanation\": \"smallest_conflict_witness\""
    "\"smallest_conflict_selection_tag\": \"conflict-smallest-witness\""
    "\"smallest_conflict_selection_summary\": \"smallest_conflict_witness("
    "\"smallest_conflict_action_label\": \"Inspect smallest conflict witness\""
    "\"smallest_conflict_action_hint\": \"Start with the smallest conflict witness"
    "\"smallest_conflict_action\": {"
    "\"severity\": \"notice\""
    "\"display_order\": 1"
    "\"label\": \"Inspect smallest conflict witness\""
    "\"smallest_conflict_variable_keys\": ["
    "\"smallest_conflict_free_variable_keys\": ["
    "\"smallest_conflict_selection_policy\": ["
    "\"primary_redundancy_priority_breakdown\": {"
    "\"primary_redundancy_selection_explanation\": \"highest_priority_redundancy_subset\""
    "\"primary_redundancy_selection_tag\": \"redundancy-primary-priority\""
    "\"primary_redundancy_selection_summary\": \"highest_priority_redundancy_subset("
    "\"primary_redundancy_action_label\": \"Suppress primary redundancy\""
    "\"primary_redundancy_action_hint\": \"Remove or suppress one redundant constraint"
    "\"primary_redundancy_action\": {"
    "\"badge_label\": \"Redundancy\""
    "\"severity\": \"info\""
    "\"display_order\": 2"
    "\"label\": \"Suppress primary redundancy\""
    "\"primary_redundancy_variable_keys\": ["
    "\"primary_redundancy_selection_policy\": ["
    "\"smallest_redundancy_priority_breakdown\": {"
    "\"smallest_redundancy_selection_explanation\": \"smallest_redundancy_witness\""
    "\"smallest_redundancy_selection_tag\": \"redundancy-smallest-witness\""
    "\"smallest_redundancy_selection_summary\": \"smallest_redundancy_witness("
    "\"smallest_redundancy_action_label\": \"Trim smallest redundancy witness\""
    "\"smallest_redundancy_action_hint\": \"Trim the smallest redundancy witness first"
    "\"smallest_redundancy_action\": {"
    "\"severity\": \"notice\""
    "\"display_order\": 3"
    "\"label\": \"Trim smallest redundancy witness\""
    "\"smallest_redundancy_variable_keys\": ["
    "\"smallest_redundancy_selection_policy\": ["
    "\"conflict_groups\": ["
    "\"redundancy_subsets\": ["
    "\"priority_breakdown\": {"
    "\"anchor_constraint_index\": 2"
    "\"anchor_constraint_index\": 0"
    "\"state_bias\": "
    "\"witness_penalty\": "
    "\"witness_constraint_count\": 2"
    "\"witness_constraint_count\": 3"
    "\"state_bias\": 15000"
    "\"constraint_count_contribution\": 300"
    "\"free_variable_contribution\": 20"
    "\"dof_contribution\": 2"
    "\"redundant_constraint_contribution\": 1000"
    "\"p4.x\""
    "\"p5.x\""
    "\"p0.x\""
    "\"p1.x\""
    "\"priority_score_desc\""
    "\"constraint_count_asc\""
    "\"witness_constraint_count_asc\""
    "2,"
    "3,"
    "4")
  string(FIND "${_stdout_ranked}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in solve_from_project ranked analysis output:\n${_stdout_ranked}")
  endif()
endforeach()

message(STATUS "solve_from_project JSON ranked groups validated")

set(_tradeoff_input "${outdir}/tradeoff_constraints_project.json")

file(WRITE "${_tradeoff_input}" [=[
{
  "header": {"format": "CADGF-PROJ", "version": 1},
  "project": {"id": "tradeoff-groups-demo", "units": "mm"},
  "scene": {
    "entities": [
      {"id": "p0", "type": "point", "params": {"x": 0, "y": 0}},
      {"id": "p1", "type": "point", "params": {"x": 1, "y": 1}},
      {"id": "p4", "type": "point", "params": {"x": 20, "y": 0}},
      {"id": "p5", "type": "point", "params": {"x": 24, "y": 3}},
      {"id": "p6", "type": "point", "params": {"x": 30, "y": 6}}
    ],
    "constraints": [
      {"id": "c0", "type": "equal", "refs": ["p0.x", "p1.x"]},
      {"id": "c1", "type": "vertical", "refs": ["p0.x", "p1.x"]},
      {"id": "c2", "type": "equal", "refs": ["p4.x", "p5.x"]},
      {"id": "c3", "type": "vertical", "refs": ["p4.x", "p5.x"]},
      {"id": "c4", "type": "equal", "refs": ["p5.x", "p6.x"]},
      {"id": "c5", "type": "vertical", "refs": ["p5.x", "p6.x"]}
    ]
  },
  "featureTree": {"nodes": [], "edges": []},
  "resources": {"sketches": [], "meshes": [], "materials": []},
  "meta": {}
}
]=])

execute_process(
  COMMAND "${exe}" --json "${_tradeoff_input}"
  RESULT_VARIABLE rc_tradeoff
  OUTPUT_VARIABLE _stdout_tradeoff
  ERROR_VARIABLE _stderr_tradeoff
)

if(NOT rc_tradeoff EQUAL 0)
  message(FATAL_ERROR "solve_from_project expected rc=0 for tradeoff subset case, got ${rc_tradeoff}: ${_stderr_tradeoff}\n${_stdout_tradeoff}")
endif()

foreach(_needle
    [=["ok": true]=]
    [=["conflict_group_count": 2]=]
    [=["redundancy_subset_count": 2]=]
    [=["primary_conflict_anchor_constraint_index": 2]=]
    [=["smallest_conflict_group_anchor_constraint_index": 0]=]
    [=["smallest_conflict_group_size": 2]=]
    [=["primary_redundancy_subset_anchor_constraint_index": 2]=]
    [=["smallest_redundancy_subset_anchor_constraint_index": 0]=]
    [=["smallest_redundancy_witness_constraint_count": 2]=]
    "\"primary_conflict_constraint_indices\": ["
    "\"smallest_conflict_constraint_indices\": ["
    "\"primary_redundancy_basis_constraint_indices\": ["
    "\"primary_redundant_constraint_indices\": ["
    "\"smallest_redundancy_basis_constraint_indices\": ["
    "\"smallest_redundant_constraint_indices\": ["
    "\"primary_conflict_priority_breakdown\": {"
    "\"primary_conflict_variable_keys\": ["
    "\"primary_conflict_free_variable_keys\": ["
    "\"primary_conflict_selection_policy\": ["
    "\"primary_conflict_action_label\": \"Relax primary conflict\""
    "\"primary_conflict_action_hint\": \"Inspect the primary conflict group first"
    "\"primary_conflict_action\": {"
    "\"action_panel_count\": 4"
    "\"action_panels\": ["
    "\"id\": \"primary_conflict\""
    "\"id\": \"smallest_conflict\""
    "\"id\": \"primary_redundancy\""
    "\"id\": \"smallest_redundancy\""
    "\"category\": \"conflict\""
    "\"category\": \"redundancy\""
    "\"scope\": \"primary\""
    "\"scope\": \"smallest\""
    "\"constraint_indices\": ["
    "\"basis_constraint_indices\": ["
    "\"redundant_constraint_indices\": ["
    "\"ui\": {"
    "\"title\": \"Relax primary conflict\""
    "\"badge_label\": \"Conflict\""
    "\"severity\": \"warning\""
    "\"cta_label\": \"Relax primary conflict\""
    "\"recommended\": true"
    "\"display_order\": 0"
    "\"label\": \"Relax primary conflict\""
    "\"smallest_conflict_priority_breakdown\": {"
    "\"smallest_conflict_variable_keys\": ["
    "\"smallest_conflict_free_variable_keys\": ["
    "\"smallest_conflict_selection_policy\": ["
    "\"smallest_conflict_action_label\": \"Inspect smallest conflict witness\""
    "\"smallest_conflict_action_hint\": \"Start with the smallest conflict witness"
    "\"smallest_conflict_action\": {"
    "\"severity\": \"notice\""
    "\"display_order\": 1"
    "\"label\": \"Inspect smallest conflict witness\""
    "\"primary_redundancy_priority_breakdown\": {"
    "\"primary_redundancy_variable_keys\": ["
    "\"primary_redundancy_selection_policy\": ["
    "\"primary_redundancy_action_label\": \"Suppress primary redundancy\""
    "\"primary_redundancy_action_hint\": \"Remove or suppress one redundant constraint"
    "\"primary_redundancy_action\": {"
    "\"badge_label\": \"Redundancy\""
    "\"severity\": \"info\""
    "\"display_order\": 2"
    "\"label\": \"Suppress primary redundancy\""
    "\"smallest_redundancy_priority_breakdown\": {"
    "\"smallest_redundancy_variable_keys\": ["
    "\"smallest_redundancy_selection_policy\": ["
    "\"smallest_redundancy_action_label\": \"Trim smallest redundancy witness\""
    "\"smallest_redundancy_action_hint\": \"Trim the smallest redundancy witness first"
    "\"smallest_redundancy_action\": {"
    "\"severity\": \"notice\""
    "\"display_order\": 3"
    "\"label\": \"Trim smallest redundancy witness\""
    "\"priority_breakdown\": {"
    "\"anchor_constraint_index\": 2"
    "\"anchor_constraint_index\": 0"
    "\"witness_penalty\": "
    "\"witness_constraint_count\": 4"
    "\"witness_constraint_count\": 2"
    "\"state_bias\": 15000"
    "\"constraint_count_contribution\": 400"
    "\"free_variable_contribution\": 10"
    "\"dof_contribution\": 1"
    "\"redundant_constraint_contribution\": 2000"
    "\"witness_penalty\": -40"
    "\"p4.x\""
    "\"p5.x\""
    "\"p6.x\""
    "\"p0.x\""
    "\"p1.x\""
    "\"constraint_count_desc\""
    "\"redundant_constraint_count_desc\""
    "\"anchor_constraint_index_asc\""
    "2,"
    "3,"
    "4,"
    "5")
  string(FIND "${_stdout_tradeoff}" "${_needle}" _idx)
  if(_idx EQUAL -1)
    message(FATAL_ERROR "${_needle} not found in solve_from_project tradeoff analysis output:\n${_stdout_tradeoff}")
  endif()
endforeach()

message(STATUS "solve_from_project JSON tradeoff groups validated")
