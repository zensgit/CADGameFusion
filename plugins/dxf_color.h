#pragma once
// DXF color resolution utilities extracted from dxf_importer_plugin.cpp.
// Depends on DxfStyle, DxfColorMeta, DxfColorSource from dxf_types.h.

#include "dxf_types.h"

// Map an AutoCAD Color Index (ACI 1-9) to a 24-bit 0xRRGGBB value.
// Returns white (0xFFFFFF) for unknown indices.
unsigned int aci_to_rgb(int index);

// Human-readable label for a DxfColorSource enum value.
const char* color_source_label(DxfColorSource source);

// Resolve the effective color for an entity by checking entity style,
// then block style (BYBLOCK), then layer style (BYLAYER).
// Writes the resolved 24-bit color into *out_color and sets *out_has_color.
DxfColorMeta resolve_color_metadata(const DxfStyle& style,
                                    const DxfStyle* layer_style,
                                    const DxfStyle* block_style,
                                    unsigned int* out_color,
                                    bool* out_has_color);
