// Document-like export example using core C API helpers
#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include "core/core_c_api.h"

static int write_json(const char* path, const cadgf_vec2* pts, const int* counts, int poly_count) {
    FILE* f = fopen(path, "w");
    if (!f) return 0;
    fprintf(f, "{\n  \"polygons\": [\n");
    int offset = 0;
    for (int i=0;i<poly_count;i++) {
        int cnt = counts[i];
        fprintf(f, "    { \"points\": [");
        for (int j=0;j<cnt;j++) {
            const cadgf_vec2 p = pts[offset + j];
            fprintf(f, "%s[%.6f, %.6f]", (j?", ":""), p.x, p.y);
        }
        offset += cnt;
        fprintf(f, "] }%s\n", (i+1<poly_count)?",":"");
    }
    fprintf(f, "  ]\n}\n");
    fclose(f);
    return 1;
}

int main(int argc, char** argv) {
    const char* out = (argc > 1) ? argv[1] : "build/out_offset.json";
    printf("cadgf version: %s\n", cadgf_get_version());

    // Base polygon (CCW square)
    cadgf_vec2 sq[4] = { {0,0}, {1,0}, {1,1}, {0,1} };

    // Query sizes for offset results
    int poly_count = 0, total_pts = 0;
    if (!cadgf_offset_single(sq, 4, 0.1, NULL, NULL, &poly_count, &total_pts)) {
        fprintf(stderr, "offset query failed\n");
        return 1;
    }
    cadgf_vec2* out_pts = (cadgf_vec2*)malloc(sizeof(cadgf_vec2) * (size_t)total_pts);
    int* out_counts = (int*)malloc(sizeof(int) * (size_t)poly_count);
    if (!out_pts || !out_counts) { fprintf(stderr, "oom\n"); return 1; }

    if (!cadgf_offset_single(sq, 4, 0.1, out_pts, out_counts, &poly_count, &total_pts)) {
        fprintf(stderr, "offset compute failed\n");
        free(out_pts); free(out_counts);
        return 1;
    }

    // Write simple JSON
    if (!write_json(out, out_pts, out_counts, poly_count)) {
        fprintf(stderr, "write failed: %s\n", out);
        free(out_pts); free(out_counts);
        return 1;
    }
    printf("wrote %s (polygons=%d, points=%d)\n", out, poly_count, total_pts);
    free(out_pts); free(out_counts);
    return 0;
}
