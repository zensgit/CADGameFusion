#include "dxf_text_handler.h"

namespace {

int map_text_attachment(int halign, int valign) {
    int col = 0;
    if (halign == 2) {
        col = 2;
    } else if (halign == 1 || halign == 3 || halign == 4 || halign == 5) {
        col = 1;
    }
    int row = 2;
    if (valign == 3) {
        row = 0;
    } else if (valign == 2) {
        row = 1;
    } else if (valign == 1) {
        row = 2;
    }
    return row * 3 + col + 1;
}

} // namespace

void finalize_text(DxfText& text, std::vector<DxfText>& out, TextImportStats* stats) {
    if (stats) {
        stats->entities_seen += 1;
        if (text.has_align_x && text.has_align_y) {
            stats->align_complete += 1;
        } else if (text.has_align_x != text.has_align_y) {
            stats->align_partial += 1;
            if (text.has_align_x) {
                stats->align_partial_x_only += 1;
            } else {
                stats->align_partial_y_only += 1;
            }
        }
    }

    if (!(text.has_x && text.has_y)) {
        if (stats) stats->skipped_missing_xy += 1;
        return;
    }

    if (!text.is_mtext && (text.has_halign || text.has_valign)) {
        if (text.has_align_x && text.has_align_y) {
            text.pos = text.align_pos;
            text.has_x = true;
            text.has_y = true;
            if (stats) stats->align_used += 1;
        }
        if (!text.has_attachment) {
            text.attachment = map_text_attachment(text.halign, text.valign);
            text.has_attachment = true;
        }
    }

    out.push_back(text);
    if (stats) stats->entities_emitted += 1;
}
