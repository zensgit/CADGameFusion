#pragma once

#include "dxf_types.h"

#include <string>
#include <vector>

struct DxfPolylineParseState {
    std::string* layer;
    std::string* owner_handle;
    bool* has_owner_handle;
    DxfStyle* style;
    int* space;
    std::vector<cadgf_vec2>* points;
    bool* closed;
    double* pending_x;
    bool* has_x;
};

void parse_polyline_entity_record(const DxfPolylineParseState& state,
                                  int code,
                                  const std::string& value_line,
                                  const std::string& header_codepage,
                                  bool* has_paperspace);
