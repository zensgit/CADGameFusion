#pragma once

#include "dxf_types.h"

#include <vector>

struct TextImportStats {
    int entities_seen = 0;
    int entities_emitted = 0;
    int skipped_missing_xy = 0;
    int align_complete = 0;
    int align_partial = 0;
    int align_partial_x_only = 0;
    int align_partial_y_only = 0;
    int align_used = 0;
    int nonfinite_values = 0;
};

void finalize_text(DxfText& text, std::vector<DxfText>& out, TextImportStats* stats);

