// Minimal C API example: create a triangle and triangulate
#include <stdio.h>
#include <stdint.h>
#include "core/core_c_api.h"

int main(void) {
    printf("cadgf version: %s\n", cadgf_get_version());
    unsigned int feats = cadgf_get_feature_flags();
    printf("features: EARCUT=%s CLIPPER2=%s\n", (feats & 1u)?"on":"off", (feats & 2u)?"on":"off");

    cadgf_vec2 tri[3] = { {0.0, 0.0}, {1.0, 0.0}, {0.0, 1.0} };
    int idx_count = 0;
    if (!cadgf_triangulate_polygon(tri, 3, NULL, &idx_count) || idx_count <= 0) {
        printf("query index count failed\n");
        return 0;
    }
    unsigned int indices_buf[16];
    if (idx_count > (int)(sizeof(indices_buf)/sizeof(indices_buf[0]))) {
        printf("too many indices (%d), increase buffer in example\n", idx_count);
        return 0;
    }
    if (!cadgf_triangulate_polygon(tri, 3, indices_buf, &idx_count)) {
        printf("triangulation failed\n");
        return 0;
    }
    printf("indices (%d):", idx_count);
    for (int i=0;i<idx_count;i++) printf(" %u", indices_buf[i]);
    printf("\nOK\n");
    return 0;
}
