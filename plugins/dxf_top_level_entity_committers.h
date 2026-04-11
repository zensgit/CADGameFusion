#pragma once

#include "dxf_document_commit_context.h"
#include "dxf_table_records.h"
#include "dxf_types.h"

#include <string>
#include <unordered_map>
#include <vector>

bool commit_dxf_top_level_entities(
    cadgf_document* doc,
    const std::vector<DxfPolyline>& polylines,
    const std::vector<DxfLine>& lines,
    const std::vector<DxfPoint>& points,
    const std::vector<DxfCircle>& circles,
    const std::vector<DxfArc>& arcs,
    const std::vector<DxfEllipse>& ellipses,
    const std::vector<DxfSpline>& splines,
    const std::vector<DxfText>& texts,
    const std::vector<DxfInsert>& inserts,
    const std::unordered_map<std::string, DxfTextStyle>& text_styles,
    const std::unordered_map<std::string, DxfLayer>& layers,
    const std::string& default_paper_layout_name,
    bool include_all_spaces,
    int target_space,
    double default_text_height,
    double default_line_scale,
    std::unordered_map<int, int>& top_level_local_groups,
    std::unordered_map<std::string, int>& layer_ids);
