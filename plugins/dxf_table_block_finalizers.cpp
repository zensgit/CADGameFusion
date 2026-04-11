#include "dxf_table_block_finalizers.h"

void finalize_layer(DxfLayer& layer,
                    std::unordered_map<std::string, DxfLayer>& layers) {
    if (!layer.has_name) return;
    if (layer.style.hidden) {
        layer.visible = false;
    }
    layers[layer.name] = layer;
}

void finalize_text_style(DxfTextStyle& style,
                         std::unordered_map<std::string, DxfTextStyle>& text_styles) {
    if (!style.has_name) return;
    text_styles[style.name] = style;
}
