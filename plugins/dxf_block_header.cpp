#include "dxf_block_header.h"
#include "dxf_math_utils.h"
#include "dxf_text_encoding.h"

bool handle_block_header_field(int code, const std::string& value_line,
                               DxfBlockHeaderContext& ctx) {
    if (!*ctx.in_block_header) return false;

    switch (code) {
        case 2:
            *ctx.block_name = sanitize_utf8(value_line, *ctx.header_codepage);
            *ctx.has_name = true;
            break;
        case 330:
            *ctx.owner_handle = value_line;
            *ctx.has_owner_handle = !ctx.owner_handle->empty();
            break;
        case 10:
            if (parse_double(value_line, ctx.pending_block_x)) {
                *ctx.has_block_x = true;
            }
            break;
        case 20: {
            if (!*ctx.has_block_x) break;
            double y = 0.0;
            if (parse_double(value_line, &y)) {
                *ctx.block_base = cadgf_vec2{*ctx.pending_block_x, y};
                *ctx.has_base = true;
            }
            *ctx.has_block_x = false;
            break;
        }
        default:
            break;
    }
    return true;
}
