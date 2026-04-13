#include "core/mesh_export.hpp"

#include <cstdint>
#include <cstring>
#include <fstream>
#include <cmath>

namespace core {

// ─── Binary STL ───
// Format: 80-byte header, uint32 triangle count,
//   per triangle: float32 normal[3], float32 vertex[3]×3, uint16 attr=0

bool export_stl(const TriMesh3D& mesh, const std::string& path) {
    if (mesh.indices.size() % 3 != 0) return false;

    std::ofstream out(path, std::ios::binary);
    if (!out) return false;

    // Header (80 bytes)
    char header[80] = {};
    std::strncpy(header, "CADGameFusion STL export", sizeof(header) - 1);
    out.write(header, 80);

    // Triangle count
    uint32_t triCount = static_cast<uint32_t>(mesh.indices.size() / 3);
    out.write(reinterpret_cast<const char*>(&triCount), 4);

    for (uint32_t t = 0; t < triCount; ++t) {
        uint32_t i0 = mesh.indices[t * 3];
        uint32_t i1 = mesh.indices[t * 3 + 1];
        uint32_t i2 = mesh.indices[t * 3 + 2];

        const auto& v0 = mesh.vertices[i0];
        const auto& v1 = mesh.vertices[i1];
        const auto& v2 = mesh.vertices[i2];

        // Compute face normal
        double e1x = v1.x - v0.x, e1y = v1.y - v0.y, e1z = v1.z - v0.z;
        double e2x = v2.x - v0.x, e2y = v2.y - v0.y, e2z = v2.z - v0.z;
        double nx = e1y*e2z - e1z*e2y;
        double ny = e1z*e2x - e1x*e2z;
        double nz = e1x*e2y - e1y*e2x;
        double len = std::sqrt(nx*nx + ny*ny + nz*nz);
        if (len > 1e-12) { nx /= len; ny /= len; nz /= len; }

        float fn[3] = {static_cast<float>(nx), static_cast<float>(ny), static_cast<float>(nz)};
        out.write(reinterpret_cast<const char*>(fn), 12);

        for (uint32_t idx : {i0, i1, i2}) {
            float fv[3] = {static_cast<float>(mesh.vertices[idx].x),
                           static_cast<float>(mesh.vertices[idx].y),
                           static_cast<float>(mesh.vertices[idx].z)};
            out.write(reinterpret_cast<const char*>(fv), 12);
        }

        uint16_t attr = 0;
        out.write(reinterpret_cast<const char*>(&attr), 2);
    }

    return out.good();
}

// ─── ASCII STL ───

bool export_stl_ascii(const TriMesh3D& mesh, const std::string& path) {
    if (mesh.indices.size() % 3 != 0) return false;

    std::ofstream out(path);
    if (!out) return false;

    out << "solid cadgamefusion\n";

    uint32_t triCount = static_cast<uint32_t>(mesh.indices.size() / 3);
    for (uint32_t t = 0; t < triCount; ++t) {
        const auto& v0 = mesh.vertices[mesh.indices[t*3]];
        const auto& v1 = mesh.vertices[mesh.indices[t*3+1]];
        const auto& v2 = mesh.vertices[mesh.indices[t*3+2]];

        double e1x = v1.x-v0.x, e1y = v1.y-v0.y, e1z = v1.z-v0.z;
        double e2x = v2.x-v0.x, e2y = v2.y-v0.y, e2z = v2.z-v0.z;
        double nx = e1y*e2z-e1z*e2y, ny = e1z*e2x-e1x*e2z, nz = e1x*e2y-e1y*e2x;
        double len = std::sqrt(nx*nx+ny*ny+nz*nz);
        if (len > 1e-12) { nx/=len; ny/=len; nz/=len; }

        out << "  facet normal " << nx << " " << ny << " " << nz << "\n";
        out << "    outer loop\n";
        out << "      vertex " << v0.x << " " << v0.y << " " << v0.z << "\n";
        out << "      vertex " << v1.x << " " << v1.y << " " << v1.z << "\n";
        out << "      vertex " << v2.x << " " << v2.y << " " << v2.z << "\n";
        out << "    endloop\n";
        out << "  endfacet\n";
    }

    out << "endsolid cadgamefusion\n";
    return out.good();
}

// ─── Wavefront OBJ ───

bool export_obj(const TriMesh3D& mesh, const std::string& path) {
    if (mesh.indices.size() % 3 != 0) return false;

    std::ofstream out(path);
    if (!out) return false;

    out << "# CADGameFusion OBJ export\n";
    out << "# Vertices: " << mesh.vertices.size() << " Triangles: " << mesh.indices.size()/3 << "\n\n";

    // Vertices
    for (const auto& v : mesh.vertices)
        out << "v " << v.x << " " << v.y << " " << v.z << "\n";

    // Normals
    if (mesh.normals.size() == mesh.vertices.size()) {
        out << "\n";
        for (const auto& n : mesh.normals)
            out << "vn " << n.x << " " << n.y << " " << n.z << "\n";
    }

    // Faces (1-indexed)
    out << "\n";
    bool hasNormals = (mesh.normals.size() == mesh.vertices.size());
    for (size_t i = 0; i + 2 < mesh.indices.size(); i += 3) {
        uint32_t a = mesh.indices[i] + 1;
        uint32_t b = mesh.indices[i+1] + 1;
        uint32_t c = mesh.indices[i+2] + 1;
        if (hasNormals)
            out << "f " << a << "//" << a << " " << b << "//" << b << " " << c << "//" << c << "\n";
        else
            out << "f " << a << " " << b << " " << c << "\n";
    }

    return out.good();
}

} // namespace core
