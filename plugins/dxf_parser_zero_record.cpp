#include "dxf_parser_zero_record.h"

static void ensure_insert_group_tag(DxfInsert* insert, int* next_tag) {
    if (!insert) return;
    if (insert->local_group_tag < 0) {
        insert->local_group_tag = (*next_tag)++;
    }
}

void handle_zero_record(const std::string& value_line, DxfZeroRecordContext& ctx) {
    // --- Layout finalize on any code==0 record ---
    if (*ctx.in_layout_object) {
        ctx.finalize_layout();
        ctx.reset_layout();
        *ctx.in_layout_object = false;
    }

    // --- Old-style polyline VERTEX / flush ---
    if (*ctx.in_old_style_polyline && value_line == "VERTEX") {
        // Don't flush — VERTEX coords will be added to current_polyline
    } else {
        if (*ctx.in_old_style_polyline && value_line != "VERTEX") {
            *ctx.in_old_style_polyline = false; // sequence ended
        }
        ctx.flush_current();
    }

    // --- SECTION ---
    if (value_line == "SECTION") {
        *ctx.expect_section_name = true;
        return;
    }

    // --- ENDSEC ---
    if (value_line == "ENDSEC") {
        if (*ctx.in_layer_table && *ctx.in_layer_record) {
            ctx.finalize_layer();
            ctx.reset_layer();
            *ctx.in_layer_record = false;
        }
        if (*ctx.in_style_table && *ctx.in_style_record) {
            ctx.finalize_text_style();
            ctx.reset_text_style();
            *ctx.in_style_record = false;
        }
        if (*ctx.in_vport_table && *ctx.in_vport_record) {
            ctx.finalize_vport();
            ctx.reset_vport();
            *ctx.in_vport_record = false;
        }
        if (*ctx.in_layout_object) {
            ctx.finalize_layout();
            ctx.reset_layout();
            *ctx.in_layout_object = false;
        }
        if (*ctx.in_block) {
            ctx.finalize_block();
            ctx.reset_block();
            *ctx.in_block = false;
            *ctx.in_block_header = false;
        }
        *ctx.in_layer_table = false;
        *ctx.in_style_table = false;
        *ctx.in_vport_table = false;
        *ctx.in_layout_object = false;
        ctx.current_table->clear();
        *ctx.current_section = DxfSection::None;
        return;
    }

    // --- TABLE (section-level, in Tables section) ---
    if (value_line == "TABLE" && *ctx.current_section == DxfSection::Tables) {
        *ctx.expect_table_name = true;
        return;
    }

    // --- ENDTAB ---
    if (value_line == "ENDTAB") {
        if (*ctx.in_layer_table && *ctx.in_layer_record) {
            ctx.finalize_layer();
            ctx.reset_layer();
            *ctx.in_layer_record = false;
        }
        if (*ctx.in_style_table && *ctx.in_style_record) {
            ctx.finalize_text_style();
            ctx.reset_text_style();
            *ctx.in_style_record = false;
        }
        if (*ctx.in_vport_table && *ctx.in_vport_record) {
            ctx.finalize_vport();
            ctx.reset_vport();
            *ctx.in_vport_record = false;
        }
        *ctx.in_layer_table = false;
        *ctx.in_style_table = false;
        *ctx.in_vport_table = false;
        ctx.current_table->clear();
        return;
    }

    // --- LAYER record start ---
    if (*ctx.in_layer_table && value_line == "LAYER") {
        if (*ctx.in_layer_record) {
            ctx.finalize_layer();
            ctx.reset_layer();
        }
        *ctx.in_layer_record = true;
        return;
    }

    // --- STYLE record start ---
    if (*ctx.in_style_table && value_line == "STYLE") {
        if (*ctx.in_style_record) {
            ctx.finalize_text_style();
            ctx.reset_text_style();
        }
        *ctx.in_style_record = true;
        return;
    }

    // --- VPORT record start ---
    if (*ctx.in_vport_table && value_line == "VPORT") {
        if (*ctx.in_vport_record) {
            ctx.finalize_vport();
            ctx.reset_vport();
        }
        ctx.reset_vport();
        *ctx.in_vport_record = true;
        return;
    }

    // --- BLOCK ---
    if (value_line == "BLOCK" && *ctx.current_section == DxfSection::Blocks) {
        if (*ctx.in_block) {
            ctx.finalize_block();
        }
        ctx.reset_block();
        *ctx.in_block = true;
        *ctx.in_block_header = true;
        return;
    }

    // --- ENDBLK ---
    if (value_line == "ENDBLK") {
        if (*ctx.in_block) {
            ctx.finalize_block();
            ctx.reset_block();
            *ctx.in_block = false;
        }
        *ctx.in_block_header = false;
        return;
    }

    // --- Exit block header on first entity ---
    if (*ctx.in_block && *ctx.in_block_header) {
        *ctx.in_block_header = false;
    }

    // --- LAYOUT object ---
    if (value_line == "LAYOUT" && *ctx.current_section == DxfSection::Objects) {
        ctx.reset_layout();
        *ctx.in_layout_object = true;
        return;
    }

    // --- Entity scope check ---
    const bool in_entities = *ctx.current_section == DxfSection::Entities;
    const bool in_block_entities = *ctx.current_section == DxfSection::Blocks
                                   && *ctx.in_block && !*ctx.in_block_header;
    if (!in_entities && !in_block_entities) {
        *ctx.current_kind = DxfEntityKind::None;
        return;
    }

    // --- SEQEND ---
    if (value_line == "SEQEND" && in_entities) {
        *ctx.has_active_insert_attribute_owner = false;
        *ctx.has_last_top_level_insert = false;
        *ctx.current_kind = DxfEntityKind::None;
        return;
    }

    // --- ATTRIB ownership tracking ---
    if (value_line == "ATTRIB" && in_entities) {
        if (*ctx.has_last_top_level_insert) {
            if (!ctx.inserts->empty()) {
                ensure_insert_group_tag(&ctx.inserts->back(), ctx.next_insert_attribute_group_tag);
                *ctx.active_insert_attribute_owner = ctx.inserts->back();
            } else {
                ensure_insert_group_tag(ctx.last_top_level_insert, ctx.next_insert_attribute_group_tag);
                *ctx.active_insert_attribute_owner = *ctx.last_top_level_insert;
            }
            *ctx.has_active_insert_attribute_owner = true;
        }
    } else {
        *ctx.has_active_insert_attribute_owner = false;
    }
    *ctx.has_last_top_level_insert = false;
    ctx.import_stats->entities_parsed++;

    // --- Entity kind selection ---
    if (value_line == "INSERT" && (in_entities || in_block_entities)) {
        *ctx.current_kind = DxfEntityKind::Insert;
        ctx.reset_insert();
    } else if (value_line == "LWPOLYLINE") {
        *ctx.current_kind = DxfEntityKind::Polyline;
        ctx.reset_polyline();
    } else if (value_line == "LINE") {
        *ctx.current_kind = DxfEntityKind::Line;
        ctx.reset_line();
    } else if (value_line == "POINT") {
        *ctx.current_kind = DxfEntityKind::Point;
        ctx.reset_point();
    } else if (value_line == "CIRCLE") {
        *ctx.current_kind = DxfEntityKind::Circle;
        ctx.reset_circle();
    } else if (value_line == "ARC") {
        *ctx.current_kind = DxfEntityKind::Arc;
        ctx.reset_arc();
    } else if (value_line == "ELLIPSE") {
        *ctx.current_kind = DxfEntityKind::Ellipse;
        ctx.reset_ellipse();
    } else if (value_line == "SPLINE") {
        *ctx.current_kind = DxfEntityKind::Spline;
        ctx.reset_spline();
    } else if (value_line == "SOLID") {
        *ctx.current_kind = DxfEntityKind::Solid;
        ctx.reset_solid();
    } else if (value_line == "HATCH") {
        *ctx.current_kind = DxfEntityKind::Hatch;
        ctx.reset_hatch();
        *ctx.current_hatch_hatch_id = (*ctx.next_hatch_id)++;
    } else if (value_line == "TEXT" || value_line == "MTEXT" || value_line == "ATTRIB" || value_line == "ATTDEF") {
        *ctx.current_kind = DxfEntityKind::Text;
        ctx.reset_text();
        if (value_line == "MTEXT") {
            ctx.current_text->allow_extended_text = true;
            ctx.current_text->is_mtext = true;
            ctx.current_text->kind = "mtext";
        } else if (value_line == "ATTRIB") {
            ctx.current_text->kind = "attrib";
            if (*ctx.has_active_insert_attribute_owner) {
                ctx.current_text->origin_meta = ctx.build_insert_origin_metadata(*ctx.active_insert_attribute_owner);
                ctx.current_text->local_group_tag = ctx.active_insert_attribute_owner->local_group_tag;
            }
        } else if (value_line == "ATTDEF") {
            ctx.current_text->kind = "attdef";
        } else {
            ctx.current_text->kind = "text";
        }
    } else if (value_line == "LEADER" || value_line == "MLEADER") {
        if (value_line == "MLEADER") {
            *ctx.current_kind = DxfEntityKind::Text;
            ctx.reset_text();
            ctx.current_text->allow_extended_text = true;
            ctx.current_text->is_mtext = true;
            ctx.current_text->kind = "mleader";
        } else {
            *ctx.current_kind = DxfEntityKind::Polyline;
            ctx.reset_polyline();
            *ctx.current_polyline_origin_meta = ctx.build_leader_origin_metadata();
        }
    } else if (value_line == "DIMENSION") {
        *ctx.current_kind = DxfEntityKind::Insert;
        ctx.reset_insert();
        ctx.current_insert->is_dimension = true;
    } else if (value_line == "TABLE") {
        *ctx.current_kind = DxfEntityKind::Text;
        ctx.reset_text();
        ctx.current_text->allow_extended_text = true;
        ctx.current_text->is_mtext = true;
        ctx.current_text->kind = "table";
    } else if (value_line == "VIEWPORT") {
        *ctx.current_kind = DxfEntityKind::Viewport;
        ctx.reset_viewport();
    } else if (value_line == "POLYLINE" && (in_entities || in_block_entities)) {
        // Old-style 3D POLYLINE (followed by VERTEX entities then SEQEND)
        *ctx.current_kind = DxfEntityKind::Polyline;
        ctx.reset_polyline();
        *ctx.in_old_style_polyline = true;
    } else if (value_line == "VERTEX" && *ctx.in_old_style_polyline) {
        // VERTEX within old-style POLYLINE — don't change current_kind, coords parsed in Polyline switch
    } else if (value_line == "TOLERANCE" && (in_entities || in_block_entities)) {
        // GD&T tolerance frame — import as text entity with kind="tolerance"
        *ctx.current_kind = DxfEntityKind::Text;
        ctx.reset_text();
        ctx.current_text->kind = "tolerance";
    } else {
        *ctx.current_kind = DxfEntityKind::None;
        if (value_line != "SEQEND" && value_line != "ENDBLK" && value_line != "VERTEX") {
            ctx.import_stats->unsupported_types[value_line]++;
            ctx.import_stats->entities_skipped++;
        }
    }
}
