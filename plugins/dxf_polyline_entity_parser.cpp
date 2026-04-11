#include "dxf_polyline_entity_parser.h"

#include "dxf_parser_helpers.h"
#include "dxf_style.h"
#include "dxf_text_encoding.h"

void parse_polyline_entity_record(const DxfPolylineParseState& state,
                                  int code,
                                  const std::string& value_line,
                                  const std::string& header_codepage,
                                  bool* has_paperspace) {
    if (!state.layer || !state.owner_handle || !state.has_owner_handle || !state.style || !state.space ||
        !state.points || !state.closed || !state.pending_x || !state.has_x) {
        return;
    }
    if (parse_entity_space(code, value_line, state.space, has_paperspace)) return;
    if (parse_entity_owner(code, value_line, state.owner_handle, state.has_owner_handle)) return;
    if (parse_style_code(state.style, code, value_line, header_codepage)) return;
    switch (code) {
        case 8:
            *state.layer = sanitize_utf8(value_line, header_codepage);
            break;
        case 70: {
            int flags = 0;
            if (parse_int(value_line, &flags)) {
                *state.closed = (flags & 1) != 0;
            }
            break;
        }
        case 10: {
            double x = 0.0;
            if (parse_double(value_line, &x)) {
                *state.pending_x = x;
                *state.has_x = true;
            }
            break;
        }
        case 20: {
            if (!*state.has_x) break;
            double y = 0.0;
            if (parse_double(value_line, &y)) {
                state.points->push_back(cadgf_vec2{*state.pending_x, y});
            }
            *state.has_x = false;
            break;
        }
        default:
            break;
    }
}
