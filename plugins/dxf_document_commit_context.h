#pragma once

#include "dxf_importer_internal_types.h"
#include "dxf_types.h"
#include "dxf_table_records.h"
#include "dxf_parser_zero_record.h"
#include "dxf_text_handler.h"

#include <cstddef>
#include <string>
#include <unordered_map>
#include <vector>

struct DxfDocumentCommitContext {
    std::unordered_map<std::string, int> layer_ids;
    std::string default_paper_layout_name;
    bool include_all_spaces = false;
    int target_space = 0;
    int default_space = 0;
    size_t count_space0 = 0;
    size_t count_space1 = 0;
};

bool prepare_dxf_document_commit_context(
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
    const std::vector<DxfViewport>& viewports,
    const std::unordered_map<std::string, DxfLayer>& layers,
    bool has_paperspace,
    bool has_active_view,
    const DxfView& active_view,
    double default_text_height,
    const HatchPatternStats& hatch_stats,
    const TextImportStats& text_stats,
    const DxfImportStats& import_stats,
    DxfDocumentCommitContext* out_context,
    std::string* out_error);
