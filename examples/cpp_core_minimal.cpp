// Minimal example using the C++ core API
#include <iostream>
#include <vector>
#include "core/geometry2d.hpp"
#include "core/ops2d.hpp"

int main() {
  using core::Vec2; using core::TriMesh2D;
  std::vector<Vec2> square{{0,0},{1,0},{1,1},{0,1}}; // convex, not closed
  TriMesh2D m = core::triangulate_polygon(square);
  std::cout << "vertices=" << m.vertices.size()
            << ", indices=" << m.indices.size() << std::endl;
  if (m.indices.size() >= 3) {
    std::cout << "first tri: " << m.indices[0] << ","
              << m.indices[1] << "," << m.indices[2] << std::endl;
  }
  return 0;
}

