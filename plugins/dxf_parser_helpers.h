#pragma once
// DXF parser helper utilities extracted from dxf_importer_plugin.cpp.
// Leaf module -- depends only on dxf_math_utils.h and standard headers.

#include "dxf_math_utils.h"

#include <string>

// Returns true if group code 67 was handled (entity space field).
// Updates *space_out and sets *has_paperspace_out to true when space == 1.
bool parse_entity_space(int code, const std::string& value, int* space_out,
                        bool* has_paperspace_out);

// Returns true if group code 330 was handled (owner handle field).
// Updates *owner_out and *has_owner_out.
bool parse_entity_owner(int code, const std::string& value, std::string* owner_out,
                        bool* has_owner_out);
