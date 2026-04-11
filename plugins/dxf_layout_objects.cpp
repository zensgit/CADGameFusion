#include "dxf_layout_objects.h"
#include "dxf_text_encoding.h"

bool handle_layout_object_field(int code, const std::string& value_line,
                                const std::string& header_codepage,
                                DxfLayout& layout) {
    switch (code) {
        case 1:
            layout.name = sanitize_utf8(value_line, header_codepage);
            layout.has_name = !layout.name.empty();
            break;
        case 330:
            layout.block_record = value_line;
            layout.has_block_record = !layout.block_record.empty();
            break;
        default:
            break;
    }
    return true;
}
