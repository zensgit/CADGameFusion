#include "dxf_parser_helpers.h"

bool parse_entity_space(int code, const std::string& value, int* space_out,
                        bool* has_paperspace_out) {
    if (code != 67 || !space_out) return false;
    int space = 0;
    if (parse_int(value, &space)) {
        *space_out = space;
        if (space == 1 && has_paperspace_out) *has_paperspace_out = true;
    }
    return true;
}

bool parse_entity_owner(int code, const std::string& value, std::string* owner_out,
                        bool* has_owner_out) {
    if (code != 330 || !owner_out || !has_owner_out) return false;
    *owner_out = value;
    *has_owner_out = !owner_out->empty();
    return true;
}
