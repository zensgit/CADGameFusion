#include "dxf_header_vars.h"
#include "dxf_math_utils.h"

bool handle_header_var(int code, const std::string& value_line,
                       DxfHeaderVarsContext& ctx) {
    if (*ctx.current_section != DxfSection::Header) {
        return false;
    }

    if (code == 9) {
        *ctx.current_header_var = value_line;
        return true;
    }
    if ((code == 3 || code == 1) && *ctx.current_header_var == "$DWGCODEPAGE") {
        *ctx.header_codepage = value_line;
        *ctx.has_header_codepage = true;
        return true;
    }
    if (code == 40) {
        double scale = 0.0;
        if (parse_double(value_line, &scale)) {
            if (*ctx.current_header_var == "$LTSCALE") {
                *ctx.header_ltscale = scale;
                *ctx.has_header_ltscale = true;
            } else if (*ctx.current_header_var == "$CELTSCALE") {
                *ctx.header_celtscale = scale;
                *ctx.has_header_celtscale = true;
            } else if (*ctx.current_header_var == "$TEXTSIZE") {
                *ctx.header_textsize = scale;
                *ctx.has_header_textsize = true;
            }
        }
    }
    // The original code always falls through to `continue` when in Header section,
    // regardless of whether a specific code was matched above.
    return true;
}
