#pragma once
// DXF ellipse entity record parser extracted from dxf_importer_plugin.cpp.
// Handles group codes for the ELLIPSE entity kind.

#include "dxf_types.h"

#include <string>

// Parse a single group-code/value pair for an ELLIPSE entity.
// Delegates space (67), owner (330), and style codes to shared helpers;
// maps 8 -> layer, 10/20 -> center, 11/21 -> major axis, 40 -> ratio,
// 41/42 -> start/end param.
void parse_ellipse_entity_record(int code, const std::string& value_line,
                                 DxfEllipse* ellipse, bool* has_paperspace,
                                 const std::string& header_codepage);
