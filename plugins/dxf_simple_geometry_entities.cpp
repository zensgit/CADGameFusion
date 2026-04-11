#include "dxf_simple_geometry_entities.h"

#include "dxf_parser_helpers.h"
#include "dxf_style.h"
#include "dxf_text_encoding.h"

void parse_line_entity_record(const DxfLineParseState& state,
                              int code,
                              const std::string& value_line,
                              const std::string& header_codepage,
                              bool* has_paperspace) {
    if (!state.layer || !state.owner_handle || !state.has_owner_handle || !state.style || !state.space ||
        !state.a || !state.b || !state.has_ax || !state.has_ay || !state.has_bx || !state.has_by) {
        return;
    }
    if (parse_entity_space(code, value_line, state.space, has_paperspace)) return;
    if (parse_entity_owner(code, value_line, state.owner_handle, state.has_owner_handle)) return;
    if (parse_style_code(state.style, code, value_line, header_codepage)) return;
    switch (code) {
        case 8:
            *state.layer = sanitize_utf8(value_line, header_codepage);
            break;
        case 10:
            if (parse_double(value_line, &state.a->x)) {
                *state.has_ax = true;
            }
            break;
        case 20:
            if (parse_double(value_line, &state.a->y)) {
                *state.has_ay = true;
            }
            break;
        case 11:
            if (parse_double(value_line, &state.b->x)) {
                *state.has_bx = true;
            }
            break;
        case 21:
            if (parse_double(value_line, &state.b->y)) {
                *state.has_by = true;
            }
            break;
        default:
            break;
    }
}

void parse_point_entity_record(const DxfPointParseState& state,
                               int code,
                               const std::string& value_line,
                               const std::string& header_codepage,
                               bool* has_paperspace) {
    if (!state.layer || !state.owner_handle || !state.has_owner_handle || !state.style || !state.space ||
        !state.point || !state.has_x || !state.has_y) {
        return;
    }
    if (parse_entity_space(code, value_line, state.space, has_paperspace)) return;
    if (parse_entity_owner(code, value_line, state.owner_handle, state.has_owner_handle)) return;
    if (parse_style_code(state.style, code, value_line, header_codepage)) return;
    switch (code) {
        case 8:
            *state.layer = sanitize_utf8(value_line, header_codepage);
            break;
        case 10:
            if (parse_double(value_line, &state.point->x)) {
                *state.has_x = true;
            }
            break;
        case 20:
            if (parse_double(value_line, &state.point->y)) {
                *state.has_y = true;
            }
            break;
        default:
            break;
    }
}

void parse_circle_entity_record(const DxfCircleParseState& state,
                                int code,
                                const std::string& value_line,
                                const std::string& header_codepage,
                                bool* has_paperspace) {
    if (!state.layer || !state.owner_handle || !state.has_owner_handle || !state.style || !state.space ||
        !state.center || !state.radius || !state.has_cx || !state.has_cy || !state.has_radius) {
        return;
    }
    if (parse_entity_space(code, value_line, state.space, has_paperspace)) return;
    if (parse_entity_owner(code, value_line, state.owner_handle, state.has_owner_handle)) return;
    if (parse_style_code(state.style, code, value_line, header_codepage)) return;
    switch (code) {
        case 8:
            *state.layer = sanitize_utf8(value_line, header_codepage);
            break;
        case 10:
            if (parse_double(value_line, &state.center->x)) {
                *state.has_cx = true;
            }
            break;
        case 20:
            if (parse_double(value_line, &state.center->y)) {
                *state.has_cy = true;
            }
            break;
        case 40:
            if (parse_double(value_line, state.radius)) {
                *state.has_radius = true;
            }
            break;
        default:
            break;
    }
}

void parse_arc_entity_record(const DxfArcParseState& state,
                             int code,
                             const std::string& value_line,
                             const std::string& header_codepage,
                             bool* has_paperspace) {
    if (!state.layer || !state.owner_handle || !state.has_owner_handle || !state.style || !state.space ||
        !state.center || !state.radius || !state.start_deg || !state.end_deg ||
        !state.has_cx || !state.has_cy || !state.has_radius || !state.has_start || !state.has_end) {
        return;
    }
    if (parse_entity_space(code, value_line, state.space, has_paperspace)) return;
    if (parse_entity_owner(code, value_line, state.owner_handle, state.has_owner_handle)) return;
    if (parse_style_code(state.style, code, value_line, header_codepage)) return;
    switch (code) {
        case 8:
            *state.layer = sanitize_utf8(value_line, header_codepage);
            break;
        case 10:
            if (parse_double(value_line, &state.center->x)) {
                *state.has_cx = true;
            }
            break;
        case 20:
            if (parse_double(value_line, &state.center->y)) {
                *state.has_cy = true;
            }
            break;
        case 40:
            if (parse_double(value_line, state.radius)) {
                *state.has_radius = true;
            }
            break;
        case 50:
            if (parse_double(value_line, state.start_deg)) {
                *state.has_start = true;
            }
            break;
        case 51:
            if (parse_double(value_line, state.end_deg)) {
                *state.has_end = true;
            }
            break;
        default:
            break;
    }
}
