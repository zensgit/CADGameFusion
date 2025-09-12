#include "core/ops2d.hpp"
#include <cassert>
#include <vector>

using namespace core;

int main() {
    // Simple rectangle triangulation via single-ring API
    std::vector<Vec2> r{{0,0},{10,0},{10,5},{0,5}};
    auto m = triangulate_polygon(r);
    // Expect at least 2 triangles for a rectangle
    assert(m.vertices.size() == 4);
    assert(m.indices.size() >= 6);

    // Multi-ring: rectangle with a hole
    std::vector<std::vector<Vec2>> rings{
        {{0,0},{10,0},{10,10},{0,10}},
        {{3,3},{7,3},{7,7},{3,7}}
    };
    auto mh = triangulate_rings(rings);
    // When earcut enabled, expect indices; otherwise may be empty
    // Just ensure no crash and vertices >= outer ring size
    assert(mh.vertices.size() >= 4);
    return 0;
}

