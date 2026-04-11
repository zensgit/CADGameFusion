#include "dxf_ellipse_entity_parser.h"

#include "dxf_math_utils.h"
#include "dxf_parser_helpers.h"
#include "dxf_style.h"
#include "dxf_text_encoding.h"

void parse_ellipse_entity_record(int code, const std::string& value_line,
                                 DxfEllipse* ellipse, bool* has_paperspace,
                                 const std::string& header_codepage) {
    if (parse_entity_space(code, value_line, &ellipse->space, has_paperspace)) return;
    if (parse_entity_owner(code, value_line, &ellipse->owner_handle,
                           &ellipse->has_owner_handle)) return;
    if (parse_style_code(&ellipse->style, code, value_line, header_codepage)) return;
    switch (code) {
        case 8:
            ellipse->layer = sanitize_utf8(value_line, header_codepage);
            break;
        case 10:
            if (parse_double(value_line, &ellipse->center.x)) {
                ellipse->has_cx = true;
            }
            break;
        case 20:
            if (parse_double(value_line, &ellipse->center.y)) {
                ellipse->has_cy = true;
            }
            break;
        case 11:
            if (parse_double(value_line, &ellipse->major_axis.x)) {
                ellipse->has_ax = true;
            }
            break;
        case 21:
            if (parse_double(value_line, &ellipse->major_axis.y)) {
                ellipse->has_ay = true;
            }
            break;
        case 40:
            if (parse_double(value_line, &ellipse->ratio)) {
                ellipse->has_ratio = true;
            }
            break;
        case 41:
            if (parse_double(value_line, &ellipse->start_param)) {
                ellipse->has_start = true;
            }
            break;
        case 42:
            if (parse_double(value_line, &ellipse->end_param)) {
                ellipse->has_end = true;
            }
            break;
        default:
            break;
    }
}
