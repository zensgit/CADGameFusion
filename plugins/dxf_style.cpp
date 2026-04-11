#include "dxf_style.h"

#include "dxf_color.h"
#include "dxf_math_utils.h"
#include "dxf_metadata_writer.h"
#include "dxf_text_encoding.h"

bool parse_style_code(DxfStyle* style, int code, const std::string& value_line,
                      const std::string& codepage) {
    if (!style) return false;
    switch (code) {
        case 6: {
            if (value_line == "BYBLOCK") {
                style->byblock_line_type = true;
                return true;
            }
            if (!value_line.empty() && value_line != "BYLAYER") {
                style->line_type = sanitize_utf8(value_line, codepage);
                style->has_line_type = true;
            }
            return true;
        }
        case 48: {
            double scale = 0.0;
            if (parse_double(value_line, &scale)) {
                style->line_type_scale = scale;
                style->has_line_scale = true;
            }
            return true;
        }
        case 370: {
            int weight = 0;
            if (parse_int(value_line, &weight)) {
                if (weight == -2) {
                    style->byblock_line_weight = true;
                    return true;
                }
                if (weight >= 0) {
                    style->line_weight = static_cast<double>(weight) / 100.0;
                    style->has_line_weight = true;
                }
            }
            return true;
        }
        case 60: {
            int hidden = 0;
            if (parse_int(value_line, &hidden) && hidden != 0) {
                style->hidden = true;
            }
            return true;
        }
        case 62: {
            int index = 0;
            if (parse_int(value_line, &index)) {
                if (index == 0) {
                    style->byblock_color = true;
                    return true;
                }
                if (index == 256) {
                    return true;
                }
                if (index < 0) {
                    style->hidden = true;
                    index = -index;
                }
                if (index > 0) {
                    style->color = aci_to_rgb(index);
                    style->has_color = true;
                    style->color_aci = index;
                    style->has_color_aci = true;
                    style->color_is_true = false;
                }
            }
            return true;
        }
        case 420: {
            int rgb = 0;
            if (parse_int(value_line, &rgb)) {
                style->color = static_cast<unsigned int>(rgb) & 0xFFFFFFu;
                style->has_color = true;
                style->has_color_aci = false;
                style->color_is_true = true;
            }
            return true;
        }
        default:
            return false;
    }
}

void apply_line_style(cadgf_document* doc, cadgf_entity_id id, const DxfStyle& style,
                      const DxfStyle* layer_style, const DxfStyle* block_style,
                      double default_line_scale) {
    if (!doc || id == 0) return;
    const bool use_byblock = style.byblock_line_type || style.byblock_line_weight || style.byblock_color;
    if (style.has_line_type) {
        (void)cadgf_document_set_entity_line_type(doc, id, style.line_type.c_str());
    } else if (style.byblock_line_type && block_style && block_style->has_line_type) {
        (void)cadgf_document_set_entity_line_type(doc, id, block_style->line_type.c_str());
    } else if (layer_style && layer_style->has_line_type) {
        (void)cadgf_document_set_entity_line_type(doc, id, layer_style->line_type.c_str());
    }
    if (style.has_line_weight) {
        (void)cadgf_document_set_entity_line_weight(doc, id, style.line_weight);
    } else if (style.byblock_line_weight && block_style && block_style->has_line_weight) {
        (void)cadgf_document_set_entity_line_weight(doc, id, block_style->line_weight);
    } else if (layer_style && layer_style->has_line_weight) {
        (void)cadgf_document_set_entity_line_weight(doc, id, layer_style->line_weight);
    }
    bool line_scale_applied = false;
    if (style.has_line_scale) {
        (void)cadgf_document_set_entity_line_type_scale(doc, id, style.line_type_scale);
        line_scale_applied = true;
    } else if (use_byblock && block_style && block_style->has_line_scale) {
        (void)cadgf_document_set_entity_line_type_scale(doc, id, block_style->line_type_scale);
        line_scale_applied = true;
    } else if (layer_style && layer_style->has_line_scale) {
        (void)cadgf_document_set_entity_line_type_scale(doc, id, layer_style->line_type_scale);
        line_scale_applied = true;
    }
    if (!line_scale_applied) {
        (void)cadgf_document_set_entity_line_type_scale(doc, id, default_line_scale);
    }
    unsigned int resolved_color = 0;
    bool has_color = false;
    const DxfColorMeta color_meta = resolve_color_metadata(style, layer_style, block_style,
                                                           &resolved_color, &has_color);
    if (has_color) {
        (void)cadgf_document_set_entity_color(doc, id, resolved_color);
    }
    write_color_metadata(doc, id, color_meta);
    if (style.hidden) {
        (void)cadgf_document_set_entity_visible(doc, id, 0);
    }
}

DxfStyle resolve_insert_byblock_style(const DxfStyle& insert_style, const DxfStyle* parent_style) {
    if (!parent_style) {
        return insert_style;
    }
    DxfStyle out = insert_style;
    const bool use_byblock = out.byblock_line_type || out.byblock_line_weight || out.byblock_color;
    if (out.byblock_line_type && parent_style->has_line_type) {
        out.line_type = parent_style->line_type;
        out.has_line_type = true;
    }
    if (out.byblock_line_weight && parent_style->has_line_weight) {
        out.line_weight = parent_style->line_weight;
        out.has_line_weight = true;
    }
    if (out.byblock_color && parent_style->has_color) {
        out.color = parent_style->color;
        out.has_color = true;
        out.color_aci = parent_style->color_aci;
        out.has_color_aci = parent_style->has_color_aci;
        out.color_is_true = parent_style->color_is_true;
    }
    if (use_byblock && !out.has_line_scale && parent_style->has_line_scale) {
        out.line_type_scale = parent_style->line_type_scale;
        out.has_line_scale = true;
    }
    return out;
}

