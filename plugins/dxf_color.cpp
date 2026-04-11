#include "dxf_color.h"

unsigned int aci_to_rgb(int index) {
    switch (index) {
        case 1: return 0xFF0000u;
        case 2: return 0xFFFF00u;
        case 3: return 0x00FF00u;
        case 4: return 0x00FFFFu;
        case 5: return 0x0000FFu;
        case 6: return 0xFF00FFu;
        case 7: return 0xFFFFFFu;
        case 8: return 0x808080u;
        case 9: return 0xC0C0C0u;
        default: return 0xFFFFFFu;
    }
}

const char* color_source_label(DxfColorSource source) {
    switch (source) {
        case DxfColorSource::ByLayer:
            return "BYLAYER";
        case DxfColorSource::ByBlock:
            return "BYBLOCK";
        case DxfColorSource::Index:
            return "INDEX";
        case DxfColorSource::TrueColor:
            return "TRUECOLOR";
        default:
            return "";
    }
}

DxfColorMeta resolve_color_metadata(const DxfStyle& style,
                                    const DxfStyle* layer_style,
                                    const DxfStyle* block_style,
                                    unsigned int* out_color,
                                    bool* out_has_color) {
    if (out_color) *out_color = 0;
    if (out_has_color) *out_has_color = false;

    DxfColorMeta meta{};
    const DxfStyle* resolved = nullptr;
    DxfColorSource source_hint = DxfColorSource::ByLayer;

    if (style.has_color) {
        resolved = &style;
        source_hint = DxfColorSource::Index;
    } else if (style.byblock_color && block_style && block_style->has_color) {
        resolved = block_style;
        source_hint = DxfColorSource::ByBlock;
    } else if (layer_style && layer_style->has_color) {
        resolved = layer_style;
        source_hint = DxfColorSource::ByLayer;
    }

    if (resolved) {
        if (out_color) *out_color = resolved->color;
        if (out_has_color) *out_has_color = true;
        if (resolved->color_is_true) {
            meta.source = DxfColorSource::TrueColor;
        } else {
            meta.source = source_hint;
        }
        if (resolved->has_color_aci && !resolved->color_is_true) {
            meta.aci = resolved->color_aci;
            meta.has_aci = true;
        }
        return meta;
    }

    meta.source = DxfColorSource::ByLayer;
    return meta;
}
