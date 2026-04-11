#pragma once

#include "dxf_types.h"

#include <string>
#include <vector>

struct DxfPolyline {
    std::string layer;
    std::string owner_handle;
    bool has_owner_handle = false;
    std::string layout_name;
    std::vector<cadgf_vec2> points;
    bool closed = false;
    std::string name;
    DxfStyle style;
    int space = 0;
    DxfEntityOriginMeta origin_meta;
    int local_group_tag = -1;
};

struct DxfLine {
    std::string layer;
    std::string owner_handle;
    bool has_owner_handle = false;
    std::string layout_name;
    cadgf_vec2 a{};
    cadgf_vec2 b{};
    bool has_ax = false;
    bool has_ay = false;
    bool has_bx = false;
    bool has_by = false;
    DxfStyle style;
    int space = 0;
    DxfEntityOriginMeta origin_meta;
};

struct DxfPoint {
    std::string layer;
    std::string owner_handle;
    bool has_owner_handle = false;
    std::string layout_name;
    cadgf_vec2 p{};
    bool has_x = false;
    bool has_y = false;
    DxfStyle style;
    int space = 0;
    DxfEntityOriginMeta origin_meta;
};

struct DxfCircle {
    std::string layer;
    std::string owner_handle;
    bool has_owner_handle = false;
    std::string layout_name;
    cadgf_vec2 center{};
    double radius = 0.0;
    bool has_cx = false;
    bool has_cy = false;
    bool has_radius = false;
    DxfStyle style;
    int space = 0;
};

struct DxfArc {
    std::string layer;
    std::string owner_handle;
    bool has_owner_handle = false;
    std::string layout_name;
    cadgf_vec2 center{};
    double radius = 0.0;
    double start_deg = 0.0;
    double end_deg = 0.0;
    bool has_cx = false;
    bool has_cy = false;
    bool has_radius = false;
    bool has_start = false;
    bool has_end = false;
    DxfStyle style;
    int space = 0;
};

struct DxfSpline {
    std::string layer;
    std::string owner_handle;
    bool has_owner_handle = false;
    std::string layout_name;
    int degree = 3;
    std::vector<cadgf_vec2> control_points;
    std::vector<double> knots;
    DxfStyle style;
    int space = 0;
};

struct DxfSolidPoint {
    cadgf_vec2 pos{};
    bool has_x = false;
    bool has_y = false;
};

struct DxfSolid {
    std::string layer;
    std::string owner_handle;
    bool has_owner_handle = false;
    std::string layout_name;
    DxfSolidPoint points[4];
    DxfStyle style;
    int space = 0;
};

struct DxfHatch {
    std::string layer;
    std::string owner_handle;
    bool has_owner_handle = false;
    std::string layout_name;
    std::vector<std::vector<cadgf_vec2>> boundaries;
    std::string pattern_name;
    double pattern_scale = 1.0;
    bool has_pattern_scale = false;
    struct PatternLine {
        double angle_deg = 0.0;
        double base_x = 0.0;
        double base_y = 0.0;
        double offset_x = 0.0;
        double offset_y = 0.0;
        std::vector<double> dashes;
        bool has_angle = false;
        bool has_base_x = false;
        bool has_base_y = false;
        bool has_offset_x = false;
        bool has_offset_y = false;
    };
    std::vector<PatternLine> pattern_lines;
    bool closed = true;
    int hatch_id = -1;
    DxfStyle style;
    int space = 0;
};

struct HatchEdgeLine {
    cadgf_vec2 start{};
    cadgf_vec2 end{};
    bool has_start_x = false;
    bool has_start_y = false;
    bool has_end_x = false;
    bool has_end_y = false;
};

struct HatchEdgeArc {
    cadgf_vec2 center{};
    double radius = 0.0;
    double start_deg = 0.0;
    double end_deg = 0.0;
    int ccw = 1;
    bool has_cx = false;
    bool has_cy = false;
    bool has_radius = false;
    bool has_start = false;
    bool has_end = false;
};

struct HatchEdgeEllipse {
    cadgf_vec2 center{};
    cadgf_vec2 major_axis{};
    double ratio = 0.0;
    double start_param = 0.0;
    double end_param = 0.0;
    int ccw = 1;
    bool has_cx = false;
    bool has_cy = false;
    bool has_ax = false;
    bool has_ay = false;
    bool has_ratio = false;
    bool has_start = false;
    bool has_end = false;
};

struct DxfBlock {
    std::string name;
    bool has_name = false;
    std::string owner_handle;
    bool has_owner_handle = false;
    std::string layout_name;
    cadgf_vec2 base{};
    bool has_base = false;
    std::vector<DxfPolyline> polylines;
    std::vector<DxfLine> lines;
    std::vector<DxfPoint> points;
    std::vector<DxfCircle> circles;
    std::vector<DxfArc> arcs;
    std::vector<DxfEllipse> ellipses;
    std::vector<DxfSpline> splines;
    std::vector<DxfText> texts;
    std::vector<DxfInsert> inserts;
};

struct HatchPatternStats {
    int emitted_lines = 0;
    bool clamped = false;
    int clamped_hatches = 0;
    int stride_max = 1;
    int edge_checks = 0;
    int edge_budget_exhausted_hatches = 0;
    int boundary_points_clamped_hatches = 0;
    int boundary_points_max = 0;
};
