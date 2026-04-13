#pragma once

#include "core/geometry2d.hpp"
#include <string>

namespace core {

// Export TriMesh3D to binary STL file.
// Returns true on success.
bool export_stl(const TriMesh3D& mesh, const std::string& path);

// Export TriMesh3D to ASCII STL file.
bool export_stl_ascii(const TriMesh3D& mesh, const std::string& path);

// Export TriMesh3D to Wavefront OBJ file.
bool export_obj(const TriMesh3D& mesh, const std::string& path);

} // namespace core
