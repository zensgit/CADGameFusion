#include "core/ops2d.hpp"
#include <vector>
#include <cassert>
#include <cmath>

using namespace core;

static double polygon_area(const std::vector<Vec2>& ring) {
    if (ring.size() < 3) return 0.0;
    double a=0.0; size_t n=ring.size();
    for (size_t i=0,j=n-1;i<n;j=i++) a += ring[j].x*ring[i].y - ring[i].x*ring[j].y;
    return 0.5 * a;
}

int main() {
    // L-shaped outer with two holes
    std::vector<std::vector<Vec2>> rings{
        { {0,0},{3,0},{3,1},{1,1},{1,3},{0,3} },
        { {0.2,0.2},{0.8,0.2},{0.8,0.8},{0.2,0.8} },
        { {1.5,1.5},{2.5,1.5},{2.5,2.5},{1.5,2.5} }
    };
#if defined(USE_EARCUT)
    auto mesh = triangulate_rings(rings);
    // Basic assertions: non-empty, indices multiple of 3, vertices >= outer ring size
    assert(!mesh.indices.empty());
    assert(mesh.indices.size() % 3 == 0);
    assert(mesh.vertices.size() >= rings[0].size());
#else
    // Without earcut, triangulate_rings may be empty; ensure no crash path
    auto mesh = triangulate_rings(rings);
    (void)mesh;
#endif
    return 0;
}

