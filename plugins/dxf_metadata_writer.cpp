#include "dxf_metadata_writer.h"

#include "dxf_color.h"
#include "dxf_math_utils.h"

#include <cmath>
#include <cstdio>
#include <string>

namespace {

void write_entity_string_metadata(cadgf_document* doc,
                                  cadgf_entity_id id,
                                  const char* suffix,
                                  const std::string& value) {
    if (!doc || id == 0 || !suffix || !*suffix || value.empty()) return;
    const std::string key =
        "dxf.entity." + std::to_string(static_cast<unsigned long long>(id)) + "." + suffix;
    (void)cadgf_document_set_meta_value(doc, key.c_str(), value.c_str());
}

void write_entity_int_metadata(cadgf_document* doc,
                               cadgf_entity_id id,
                               const char* suffix,
                               int value) {
    if (!doc || id == 0 || !suffix || !*suffix) return;
    const std::string key =
        "dxf.entity." + std::to_string(static_cast<unsigned long long>(id)) + "." + suffix;
    const std::string encoded = std::to_string(value);
    (void)cadgf_document_set_meta_value(doc, key.c_str(), encoded.c_str());
}

void write_entity_vec2_metadata(cadgf_document* doc,
                                cadgf_entity_id id,
                                const char* suffix,
                                const cadgf_vec2& value) {
    if (!doc || id == 0 || !suffix || !*suffix) return;
    char buf[64]{};
    const std::string base =
        "dxf.entity." + std::to_string(static_cast<unsigned long long>(id)) + "." + suffix;
    std::snprintf(buf, sizeof(buf), "%.6f", value.x);
    (void)cadgf_document_set_meta_value(doc, (base + "_x").c_str(), buf);
    std::snprintf(buf, sizeof(buf), "%.6f", value.y);
    (void)cadgf_document_set_meta_value(doc, (base + "_y").c_str(), buf);
}

double dot_vec(const cadgf_vec2& a, const cadgf_vec2& b) {
    return a.x * b.x + a.y * b.y;
}

bool resolve_dimension_anchor_axis(const DxfInsert& insert, cadgf_vec2* out_axis) {
    if (!out_axis) return false;
    cadgf_vec2 axis{};
    const int base_dim_type = insert.dim_type & 7;
    if (base_dim_type == 1 && insert.has_dim_defpoint1 && insert.has_dim_defpoint2) {
        axis.x = insert.dim_defpoint2.x - insert.dim_defpoint1.x;
        axis.y = insert.dim_defpoint2.y - insert.dim_defpoint1.y;
    } else {
        const double angle_rad = insert.rotation_deg * kDegToRad;
        axis.x = std::cos(angle_rad);
        axis.y = std::sin(angle_rad);
    }
    const double length = std::hypot(axis.x, axis.y);
    if (!(length > 1e-9)) return false;
    out_axis->x = axis.x / length;
    out_axis->y = axis.y / length;
    return true;
}

bool apply_dimension_text_guide_metadata(DxfEntityOriginMeta* meta, const DxfInsert& insert) {
    if (!meta || !insert.is_dimension || !insert.has_x || !insert.has_y) return false;
    cadgf_vec2 axis{};
    if (!resolve_dimension_anchor_axis(insert, &axis)) return false;

    cadgf_vec2 anchor = insert.pos;
    if (insert.has_dim_defpoint1 && insert.has_dim_defpoint2) {
        const auto project_onto_dimension_axis = [&](const cadgf_vec2& point) {
            const cadgf_vec2 delta{point.x - insert.pos.x, point.y - insert.pos.y};
            const double along = dot_vec(delta, axis);
            return cadgf_vec2{
                insert.pos.x + axis.x * along,
                insert.pos.y + axis.y * along,
            };
        };
        const cadgf_vec2 projected_a = project_onto_dimension_axis(insert.dim_defpoint1);
        const cadgf_vec2 projected_b = project_onto_dimension_axis(insert.dim_defpoint2);
        anchor.x = (projected_a.x + projected_b.x) * 0.5;
        anchor.y = (projected_a.y + projected_b.y) * 0.5;
    }

    meta->source_anchor = anchor;
    meta->has_source_anchor = true;
    meta->source_anchor_driver_type = "line";
    meta->source_anchor_driver_kind = "midpoint";
    return true;
}

void write_dimension_origin_metadata(cadgf_document* doc,
                                     cadgf_entity_id id,
                                     const DxfInsert& insert,
                                     bool include_text_metadata) {
    if (!doc || id == 0 || !insert.is_dimension) return;
    const std::string base = "dxf.entity." + std::to_string(static_cast<unsigned long long>(id));
    DxfEntityOriginMeta dimension_meta = build_insert_origin_metadata(insert);
    if (include_text_metadata) {
        (void)apply_dimension_text_guide_metadata(&dimension_meta, insert);
    }
    write_entity_origin_metadata(doc, id, dimension_meta);
    {
        const std::string key = base + ".dim_type";
        const std::string value = std::to_string(insert.dim_type);
        (void)cadgf_document_set_meta_value(doc, key.c_str(), value.c_str());
    }
    if (!insert.dim_style.empty()) {
        (void)cadgf_document_set_meta_value(doc, (base + ".dim_style").c_str(), insert.dim_style.c_str());
    }
    if (!include_text_metadata) return;
    (void)cadgf_document_set_meta_value(doc, (base + ".text_kind").c_str(), "dimension");
    if (insert.has_dim_text_pos) {
        char buf[64]{};
        std::snprintf(buf, sizeof(buf), "%.6f", insert.dim_text_pos.x);
        (void)cadgf_document_set_meta_value(doc, (base + ".dim_text_pos_x").c_str(), buf);
        std::snprintf(buf, sizeof(buf), "%.6f", insert.dim_text_pos.y);
        (void)cadgf_document_set_meta_value(doc, (base + ".dim_text_pos_y").c_str(), buf);
    }
    {
        char buf[64]{};
        const double rotation = insert.rotation_deg * kDegToRad;
        std::snprintf(buf, sizeof(buf), "%.6f", rotation);
        (void)cadgf_document_set_meta_value(doc, (base + ".dim_text_rotation").c_str(), buf);
    }
}

void write_viewport_metadata(cadgf_document* doc, size_t index, const DxfViewport& viewport) {
    if (!doc) return;
    char buf[64];
    const std::string base = "dxf.viewport." + std::to_string(static_cast<unsigned long long>(index));
    std::snprintf(buf, sizeof(buf), "%d", viewport.space);
    (void)cadgf_document_set_meta_value(doc, (base + ".space").c_str(), buf);
    if (viewport.has_id) {
        std::snprintf(buf, sizeof(buf), "%d", viewport.id);
        (void)cadgf_document_set_meta_value(doc, (base + ".id").c_str(), buf);
    }
    std::snprintf(buf, sizeof(buf), "%.6f", viewport.center.x);
    (void)cadgf_document_set_meta_value(doc, (base + ".center_x").c_str(), buf);
    std::snprintf(buf, sizeof(buf), "%.6f", viewport.center.y);
    (void)cadgf_document_set_meta_value(doc, (base + ".center_y").c_str(), buf);
    std::snprintf(buf, sizeof(buf), "%.6f", viewport.width);
    (void)cadgf_document_set_meta_value(doc, (base + ".width").c_str(), buf);
    std::snprintf(buf, sizeof(buf), "%.6f", viewport.height);
    (void)cadgf_document_set_meta_value(doc, (base + ".height").c_str(), buf);
    std::snprintf(buf, sizeof(buf), "%.6f", viewport.view_center.x);
    (void)cadgf_document_set_meta_value(doc, (base + ".view_center_x").c_str(), buf);
    std::snprintf(buf, sizeof(buf), "%.6f", viewport.view_center.y);
    (void)cadgf_document_set_meta_value(doc, (base + ".view_center_y").c_str(), buf);
    std::snprintf(buf, sizeof(buf), "%.6f", viewport.view_height);
    (void)cadgf_document_set_meta_value(doc, (base + ".view_height").c_str(), buf);
    if (viewport.has_twist) {
        std::snprintf(buf, sizeof(buf), "%.6f", viewport.twist_deg);
        (void)cadgf_document_set_meta_value(doc, (base + ".twist_deg").c_str(), buf);
    }
    if (!viewport.layout.empty()) {
        (void)cadgf_document_set_meta_value(doc, (base + ".layout").c_str(), viewport.layout.c_str());
    }
}

} // namespace

void write_color_metadata(cadgf_document* doc, cadgf_entity_id id, const DxfColorMeta& meta) {
    if (!doc || id == 0) return;
    const char* label = color_source_label(meta.source);
    if (!label || !*label) return;

    const std::string base = "dxf.entity." + std::to_string(static_cast<unsigned long long>(id));
    const std::string source_key = base + ".color_source";
    (void)cadgf_document_set_meta_value(doc, source_key.c_str(), label);

    if (!meta.has_aci) return;
    const std::string aci_key = base + ".color_aci";
    const std::string aci_value = std::to_string(meta.aci);
    (void)cadgf_document_set_meta_value(doc, aci_key.c_str(), aci_value.c_str());
}

void write_space_metadata(cadgf_document* doc, cadgf_entity_id id, int space) {
    if (!doc || id == 0) return;
    if (space != 0 && space != 1) return;
    const std::string key = "dxf.entity." + std::to_string(static_cast<unsigned long long>(id)) + ".space";
    const std::string value = std::to_string(space);
    (void)cadgf_document_set_meta_value(doc, key.c_str(), value.c_str());
}

void write_layout_metadata(cadgf_document* doc, cadgf_entity_id id, const std::string& layout) {
    if (!doc || id == 0 || layout.empty()) return;
    const std::string key = "dxf.entity." + std::to_string(static_cast<unsigned long long>(id)) + ".layout";
    (void)cadgf_document_set_meta_value(doc, key.c_str(), layout.c_str());
}

void write_entity_origin_metadata(cadgf_document* doc,
                                  cadgf_entity_id id,
                                  const DxfEntityOriginMeta& meta) {
    if (!doc || id == 0) return;
    write_entity_string_metadata(doc, id, "source_type", meta.source_type);
    write_entity_string_metadata(doc, id, "edit_mode", meta.edit_mode);
    write_entity_string_metadata(doc, id, "proxy_kind", meta.proxy_kind);
    write_entity_string_metadata(doc, id, "block_name", meta.block_name);
    write_entity_string_metadata(doc, id, "hatch_pattern", meta.hatch_pattern);
    if (meta.hatch_id >= 0) {
        write_entity_int_metadata(doc, id, "hatch_id", meta.hatch_id);
    }
    if (meta.has_source_anchor) {
        write_entity_vec2_metadata(doc, id, "source_anchor", meta.source_anchor);
    }
    if (meta.has_leader_landing) {
        write_entity_vec2_metadata(doc, id, "leader_landing", meta.leader_landing);
    }
    if (meta.has_leader_elbow) {
        write_entity_vec2_metadata(doc, id, "leader_elbow", meta.leader_elbow);
    }
    write_entity_string_metadata(doc, id, "source_anchor_driver_type", meta.source_anchor_driver_type);
    write_entity_string_metadata(doc, id, "source_anchor_driver_kind", meta.source_anchor_driver_kind);
}

void write_source_bundle_metadata(cadgf_document* doc,
                                  cadgf_entity_id id,
                                  int source_bundle_id) {
    if (!doc || id == 0 || source_bundle_id < 0) return;
    write_entity_int_metadata(doc, id, "source_bundle_id", source_bundle_id);
}

DxfEntityOriginMeta build_insert_origin_metadata(const DxfInsert& insert) {
    DxfEntityOriginMeta meta;
    meta.block_name = insert.block_name;
    if (insert.is_dimension) {
        meta.source_type = "DIMENSION";
        meta.edit_mode = "proxy";
        meta.proxy_kind = "dimension";
    } else {
        meta.source_type = "INSERT";
        meta.edit_mode = "exploded";
        meta.proxy_kind = "insert";
    }
    return meta;
}

void write_text_metadata(cadgf_document* doc, cadgf_entity_id id, const DxfText& text) {
    if (!doc || id == 0) return;
    const std::string base = "dxf.entity." + std::to_string(static_cast<unsigned long long>(id));
    if (!text.kind.empty()) {
        const std::string key = base + ".text_kind";
        (void)cadgf_document_set_meta_value(doc, key.c_str(), text.kind.c_str());
    }
    if (text.has_width) {
        const std::string key = base + ".text_width";
        char buf[64]{};
        std::snprintf(buf, sizeof(buf), "%.6f", text.width);
        (void)cadgf_document_set_meta_value(doc, key.c_str(), buf);
    }
    if (text.has_width_factor) {
        const std::string key = base + ".text_width_factor";
        char buf[64]{};
        std::snprintf(buf, sizeof(buf), "%.6f", text.width_factor);
        (void)cadgf_document_set_meta_value(doc, key.c_str(), buf);
    }
    if (text.has_attachment) {
        const std::string key = base + ".text_attachment";
        const std::string value = std::to_string(text.attachment);
        (void)cadgf_document_set_meta_value(doc, key.c_str(), value.c_str());
    }
    if (text.has_halign) {
        const std::string key = base + ".text_halign";
        const std::string value = std::to_string(text.halign);
        (void)cadgf_document_set_meta_value(doc, key.c_str(), value.c_str());
    }
    if (text.has_valign) {
        const std::string key = base + ".text_valign";
        const std::string value = std::to_string(text.valign);
        (void)cadgf_document_set_meta_value(doc, key.c_str(), value.c_str());
    }
    if (text.has_attribute_tag) {
        const std::string key = base + ".attribute_tag";
        (void)cadgf_document_set_meta_value(doc, key.c_str(), text.attribute_tag.c_str());
    }
    if (text.has_attribute_default) {
        const std::string key = base + ".attribute_default";
        (void)cadgf_document_set_meta_value(doc, key.c_str(), text.attribute_default.c_str());
    }
    if (text.has_attribute_prompt) {
        const std::string key = base + ".attribute_prompt";
        (void)cadgf_document_set_meta_value(doc, key.c_str(), text.attribute_prompt.c_str());
    }
    if (text.has_attribute_flags) {
        write_entity_int_metadata(doc, id, "attribute_flags", text.attribute_flags);
        write_entity_int_metadata(doc, id, "attribute_invisible", (text.attribute_flags & 1) != 0 ? 1 : 0);
        write_entity_int_metadata(doc, id, "attribute_constant", (text.attribute_flags & 2) != 0 ? 1 : 0);
        write_entity_int_metadata(doc, id, "attribute_verify", (text.attribute_flags & 4) != 0 ? 1 : 0);
        write_entity_int_metadata(doc, id, "attribute_preset", (text.attribute_flags & 8) != 0 ? 1 : 0);
        write_entity_int_metadata(doc, id, "attribute_lock_position", (text.attribute_flags & 16) != 0 ? 1 : 0);
    }
}

void write_dimension_metadata(cadgf_document* doc, cadgf_entity_id id, const DxfInsert& insert) {
    write_dimension_origin_metadata(doc, id, insert, true);
}

void write_insert_derived_metadata(cadgf_document* doc,
                                   cadgf_entity_id id,
                                   const DxfInsert* origin_insert,
                                   bool include_text_metadata) {
    if (!doc || id == 0 || !origin_insert) return;
    if (origin_insert->is_dimension) {
        write_dimension_origin_metadata(doc, id, *origin_insert, include_text_metadata);
        return;
    }
    write_entity_origin_metadata(doc, id, build_insert_origin_metadata(*origin_insert));
}

void write_viewport_list_metadata(cadgf_document* doc, const std::vector<DxfViewport>& viewports) {
    if (!doc || viewports.empty()) return;
    char buf[32];
    std::snprintf(buf, sizeof(buf), "%zu", viewports.size());
    (void)cadgf_document_set_meta_value(doc, "dxf.viewport.count", buf);
    for (size_t i = 0; i < viewports.size(); ++i) {
        write_viewport_metadata(doc, i, viewports[i]);
    }
}

void write_active_view_metadata(cadgf_document* doc, const DxfView& view) {
    if (!doc) return;
    char buf[64];
    if (view.has_center_x) {
        std::snprintf(buf, sizeof(buf), "%.6f", view.center.x);
        (void)cadgf_document_set_meta_value(doc, "dxf.vport.active.center_x", buf);
    }
    if (view.has_center_y) {
        std::snprintf(buf, sizeof(buf), "%.6f", view.center.y);
        (void)cadgf_document_set_meta_value(doc, "dxf.vport.active.center_y", buf);
    }
    if (view.has_view_height) {
        std::snprintf(buf, sizeof(buf), "%.6f", view.view_height);
        (void)cadgf_document_set_meta_value(doc, "dxf.vport.active.view_height", buf);
    }
    if (view.has_aspect) {
        std::snprintf(buf, sizeof(buf), "%.6f", view.aspect);
        (void)cadgf_document_set_meta_value(doc, "dxf.vport.active.aspect", buf);
    }
    if (view.has_name && !view.name.empty()) {
        (void)cadgf_document_set_meta_value(doc, "dxf.vport.active.name", view.name.c_str());
    }
}

