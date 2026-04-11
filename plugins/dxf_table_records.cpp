#include "dxf_table_records.h"

#include "dxf_style.h"
#include "dxf_math_utils.h"
#include "dxf_text_encoding.h"

bool handle_layer_record_field(int code, const std::string& value_line,
                               const std::string& header_codepage,
                               DxfLayer& layer) {
    if (parse_style_code(&layer.style, code, value_line, header_codepage)) {
        if (layer.style.hidden) layer.visible = false;
        return true;
    }
    switch (code) {
        case 2:
            layer.name = sanitize_utf8(value_line, header_codepage);
            layer.has_name = true;
            return true;
        case 70: {
            int flags = 0;
            if (parse_int(value_line, &flags)) {
                layer.frozen = (flags & 1) != 0 || (flags & 2) != 0;
                layer.locked = (flags & 4) != 0;
                layer.printable = (flags & 128) == 0;
            }
            return true;
        }
        default:
            break;
    }
    return false;
}

bool handle_style_record_field(int code, const std::string& value_line,
                               const std::string& header_codepage,
                               DxfTextStyle& style) {
    switch (code) {
        case 2:
            style.name = sanitize_utf8(value_line, header_codepage);
            style.has_name = !style.name.empty();
            return true;
        case 40: {
            double height = 0.0;
            if (parse_double(value_line, &height)) {
                style.height = height;
                style.has_height = height > 0.0;
            }
            return true;
        }
        default:
            break;
    }
    return false;
}

bool handle_vport_record_field(int code, const std::string& value_line,
                               const std::string& header_codepage,
                               DxfView& vport) {
    switch (code) {
        case 2:
            vport.name = sanitize_utf8(value_line, header_codepage);
            vport.has_name = !vport.name.empty();
            return true;
        case 12:
            if (parse_double(value_line, &vport.center.x)) {
                vport.has_center_x = true;
            }
            return true;
        case 22:
            if (parse_double(value_line, &vport.center.y)) {
                vport.has_center_y = true;
            }
            return true;
        case 40:
            if (parse_double(value_line, &vport.view_height)) {
                vport.has_view_height = true;
            }
            return true;
        case 41:
            if (parse_double(value_line, &vport.aspect)) {
                vport.has_aspect = vport.aspect > 0.0;
            }
            return true;
        default:
            break;
    }
    return false;
}
