#pragma once

#include "dxf_types.h"

#include <string>

struct DxfLineParseState {
    std::string* layer;
    std::string* owner_handle;
    bool* has_owner_handle;
    DxfStyle* style;
    int* space;
    cadgf_vec2* a;
    cadgf_vec2* b;
    bool* has_ax;
    bool* has_ay;
    bool* has_bx;
    bool* has_by;
};

struct DxfPointParseState {
    std::string* layer;
    std::string* owner_handle;
    bool* has_owner_handle;
    DxfStyle* style;
    int* space;
    cadgf_vec2* point;
    bool* has_x;
    bool* has_y;
};

struct DxfCircleParseState {
    std::string* layer;
    std::string* owner_handle;
    bool* has_owner_handle;
    DxfStyle* style;
    int* space;
    cadgf_vec2* center;
    double* radius;
    bool* has_cx;
    bool* has_cy;
    bool* has_radius;
};

struct DxfArcParseState {
    std::string* layer;
    std::string* owner_handle;
    bool* has_owner_handle;
    DxfStyle* style;
    int* space;
    cadgf_vec2* center;
    double* radius;
    double* start_deg;
    double* end_deg;
    bool* has_cx;
    bool* has_cy;
    bool* has_radius;
    bool* has_start;
    bool* has_end;
};

void parse_line_entity_record(const DxfLineParseState& state,
                              int code,
                              const std::string& value_line,
                              const std::string& header_codepage,
                              bool* has_paperspace);

void parse_point_entity_record(const DxfPointParseState& state,
                               int code,
                               const std::string& value_line,
                               const std::string& header_codepage,
                               bool* has_paperspace);

void parse_circle_entity_record(const DxfCircleParseState& state,
                                int code,
                                const std::string& value_line,
                                const std::string& header_codepage,
                                bool* has_paperspace);

void parse_arc_entity_record(const DxfArcParseState& state,
                             int code,
                             const std::string& value_line,
                             const std::string& header_codepage,
                             bool* has_paperspace);
