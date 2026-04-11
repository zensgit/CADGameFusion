#include "dxf_parser_name_routing.h"

bool handle_name_routing(int code, const std::string& value_line,
                         DxfNameRoutingContext& ctx) {
    if (*ctx.expect_section_name && code == 2) {
        *ctx.expect_section_name = false;
        if (value_line == "TABLES") {
            *ctx.current_section = DxfSection::Tables;
            *ctx.in_block = false;
            *ctx.in_block_header = false;
        } else if (value_line == "HEADER") {
            *ctx.current_section = DxfSection::Header;
            ctx.current_header_var->clear();
            *ctx.in_block = false;
            *ctx.in_block_header = false;
        } else if (value_line == "ENTITIES") {
            *ctx.current_section = DxfSection::Entities;
            *ctx.in_block = false;
            *ctx.in_block_header = false;
        } else if (value_line == "BLOCKS") {
            *ctx.current_section = DxfSection::Blocks;
            *ctx.in_block = false;
            *ctx.in_block_header = false;
        } else if (value_line == "OBJECTS") {
            *ctx.current_section = DxfSection::Objects;
            *ctx.in_block = false;
            *ctx.in_block_header = false;
        } else {
            *ctx.current_section = DxfSection::None;
            *ctx.in_block = false;
            *ctx.in_block_header = false;
        }
        return true;
    }

    if (*ctx.expect_table_name && code == 2) {
        *ctx.expect_table_name = false;
        *ctx.current_table = value_line;
        *ctx.in_layer_table = (*ctx.current_section == DxfSection::Tables && *ctx.current_table == "LAYER");
        *ctx.in_style_table = (*ctx.current_section == DxfSection::Tables && *ctx.current_table == "STYLE");
        *ctx.in_vport_table = (*ctx.current_section == DxfSection::Tables && *ctx.current_table == "VPORT");
        return true;
    }

    return false;
}
