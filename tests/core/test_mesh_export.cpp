#include <cassert>
#include <cstdio>
#include <cstring>
#include <fstream>
#include <string>

#include "core/geometry2d.hpp"
#include "core/ops2d.hpp"
#include "core/mesh_export.hpp"

static std::string tmpPath(const char* name) {
    return std::string("/tmp/cadgf_test_") + name;
}

int main() {
    using namespace core;

    // Create a test mesh (extruded square)
    Polyline sq;
    sq.points = {{0,0},{10,0},{10,10},{0,10},{0,0}};
    auto mesh = extrude_mesh(sq, 5.0);
    assert(!mesh.vertices.empty());

    // ═══ Test 1: Binary STL export ═══
    {
        std::string path = tmpPath("test.stl");
        assert(export_stl(mesh, path));

        // Verify file: 80-byte header + 4-byte count + (50 bytes per triangle)
        std::ifstream f(path, std::ios::binary | std::ios::ate);
        auto size = f.tellg();
        uint32_t triCount = static_cast<uint32_t>(mesh.indices.size() / 3);
        auto expected = 80 + 4 + triCount * 50;
        assert(size == expected);
        fprintf(stderr, "  PASS: binary STL export (%d bytes, %u triangles)\n",
                static_cast<int>(size), triCount);
    }

    // ═══ Test 2: ASCII STL export ═══
    {
        std::string path = tmpPath("test_ascii.stl");
        assert(export_stl_ascii(mesh, path));

        std::ifstream f(path);
        std::string line;
        std::getline(f, line);
        assert(line.find("solid") != std::string::npos);

        // Count "facet" lines
        int facetCount = 0;
        while (std::getline(f, line)) {
            if (line.find("facet normal") != std::string::npos) ++facetCount;
        }
        assert(facetCount == static_cast<int>(mesh.indices.size() / 3));
        fprintf(stderr, "  PASS: ASCII STL export (%d facets)\n", facetCount);
    }

    // ═══ Test 3: OBJ export ═══
    {
        std::string path = tmpPath("test.obj");
        assert(export_obj(mesh, path));

        std::ifstream f(path);
        int vCount = 0, vnCount = 0, fCount = 0;
        std::string line;
        while (std::getline(f, line)) {
            if (line.size() >= 2 && line[0] == 'v' && line[1] == ' ') ++vCount;
            if (line.size() >= 3 && line[0] == 'v' && line[1] == 'n') ++vnCount;
            if (line.size() >= 2 && line[0] == 'f' && line[1] == ' ') ++fCount;
        }
        assert(vCount == static_cast<int>(mesh.vertices.size()));
        assert(vnCount == static_cast<int>(mesh.normals.size()));
        assert(fCount == static_cast<int>(mesh.indices.size() / 3));
        fprintf(stderr, "  PASS: OBJ export (v=%d vn=%d f=%d)\n", vCount, vnCount, fCount);
    }

    // ═══ Test 4: Empty mesh ═══
    {
        TriMesh3D empty;
        assert(export_stl(empty, tmpPath("empty.stl")));
        assert(export_obj(empty, tmpPath("empty.obj")));
        fprintf(stderr, "  PASS: empty mesh export\n");
    }

    // ═══ Test 5: STL binary header verification ═══
    {
        std::string path = tmpPath("header.stl");
        export_stl(mesh, path);
        std::ifstream f(path, std::ios::binary);
        char header[80];
        f.read(header, 80);
        assert(std::string(header).find("CADGameFusion") != std::string::npos);
        fprintf(stderr, "  PASS: STL header contains identifier\n");
    }

    fprintf(stderr, "\n  All mesh export tests passed!\n");
    return 0;
}
