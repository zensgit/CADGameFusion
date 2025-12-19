#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <cstring>
#include <filesystem>
#include <iomanip>
#include <sstream>
#include <algorithm>
#include <cmath>
#include <limits>
#include "core/core_c_api.h"

#if defined(CADGF_HAS_TINYGLTF)
#define TINYGLTF_IMPLEMENTATION
#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include <tiny_gltf.h>
#endif

namespace fs = std::filesystem;

struct ExportOptions {
    std::string outputDir = "build/exports";
    std::string scene = "sample";
    double unitScale = 1.0;
    std::string specDir; // when set, copy from spec directory
    std::string specFile; // when set, read JSON spec file
    enum class HolesMode { OuterOnly, Full } gltfHolesMode = HolesMode::Full; // glTF holes emission strategy (default: Full)
    // Experimental glTF feature flags (default OFF)
    bool emitNormals = false;           // add flat normals (0,0,1)
    bool emitUVs = false;               // add UV channel 0 (0,0)
    bool emitMaterialsStub = false;     // add single default material + primitive binding
    bool emitDxf = false;               // emit DXF file
};

// Scene definitions
struct SceneData {
    std::vector<cadgf_vec2> points;
    std::vector<int> ringCounts;
    std::vector<int> ringRoles;
    int groupId;
    int joinType;
    double miterLimit;
    bool useDocUnit;
};

static void writeDXF(const std::string& filename, const SceneData& scene, double unitScale) {
    std::ofstream out(filename);
    if (!out.is_open()) return;

    out << "0\nSECTION\n2\nHEADER\n0\nENDSEC\n";
    out << "0\nSECTION\n2\nENTITIES\n";

    size_t offset = 0;
    for (int count : scene.ringCounts) {
        if (count < 2) { offset += count; continue; }
        
        out << "0\nLWPOLYLINE\n";
        out << "8\n0\n"; 
        out << "90\n" << count << "\n";
        out << "70\n1\n"; // Closed

        for (int i = 0; i < count; ++i) {
            const auto& p = scene.points[offset + i];
            out << "10\n" << (p.x * unitScale) << "\n";
            out << "20\n" << (-p.y * unitScale) << "\n"; // Y-flip
        }
        offset += count;
    }

    out << "0\nENDSEC\n";
    out << "0\nEOF\n";
    out.close();
}

static double signedArea(const std::vector<cadgf_vec2>& pts, size_t start, size_t count) {
    if (count < 3) return 0.0;
    double a = 0.0;
    for (size_t i = 0; i < count; ++i) {
        const auto& p0 = pts[start + i];
        const auto& p1 = pts[start + ((i + 1) % count)];
        a += (p0.x * p1.y) - (p1.x * p0.y);
    }
    return a * 0.5;
}

static void normalizeOrientation(SceneData& scene) {
    // Ensure outer rings CCW, holes CW, based on ringRoles (0 outer-like, 1 hole)
    size_t offset = 0;
    for (size_t r = 0; r < scene.ringCounts.size(); ++r) {
        int cnt = scene.ringCounts[r];
        if (cnt <= 2) { offset += cnt; continue; }
        double area = signedArea(scene.points, offset, static_cast<size_t>(cnt));
        bool isHole = (r < scene.ringRoles.size() ? scene.ringRoles[r] == 1 : (r > 0));
        // For outer (desired CCW): area should be > 0; for hole (desired CW): area should be < 0
        bool needFlip = (!isHole && area < 0.0) || (isHole && area > 0.0);
        if (needFlip) {
            // Reverse the segment [offset, offset+cnt)
            std::reverse(scene.points.begin() + static_cast<long>(offset), scene.points.begin() + static_cast<long>(offset + cnt));
        }
        offset += cnt;
    }
}

static void normalizeStartVertex(SceneData& scene) {
    // For each ring, rotate so the lexicographically smallest (x,y) is first
    size_t offset = 0;
    for (size_t r = 0; r < scene.ringCounts.size(); ++r) {
        int cnt = scene.ringCounts[r];
        if (cnt <= 0) { continue; }
        size_t start = offset;
        size_t end = offset + static_cast<size_t>(cnt);
        size_t best = start;
        for (size_t i = start + 1; i < end; ++i) {
            const auto& a = scene.points[i];
            const auto& b = scene.points[best];
            if (a.x < b.x || (a.x == b.x && a.y < b.y)) best = i;
        }
        if (best != start) {
            std::rotate(scene.points.begin() + static_cast<long>(start),
                        scene.points.begin() + static_cast<long>(best),
                        scene.points.begin() + static_cast<long>(end));
        }
        offset += cnt;
    }
}

#ifdef CADGF_SORT_RINGS
static void sortRingsByRoleAndArea(SceneData& scene) {
    struct RingInfo { size_t start; int count; int role; double areaAbs; };
    std::vector<RingInfo> rings;
    rings.reserve(scene.ringCounts.size());
    size_t offset = 0;
    for (size_t r = 0; r < scene.ringCounts.size(); ++r) {
        int cnt = scene.ringCounts[r];
        double a = std::abs(signedArea(scene.points, offset, static_cast<size_t>(cnt)));
        int role = (r < scene.ringRoles.size() ? scene.ringRoles[r] : (r == 0 ? 0 : 1));
        rings.push_back(RingInfo{offset, cnt, role, a});
        offset += cnt;
    }
    // Sort: preserve original order of roles as they appear to minimize disruption.
    // Compute first occurrence index for each role.
    int firstOuter = -1, firstHole = -1;
    for (size_t i = 0; i < rings.size(); ++i) {
        if (rings[i].role == 0 && firstOuter < 0) firstOuter = static_cast<int>(i);
        if (rings[i].role == 1 && firstHole < 0) firstHole = static_cast<int>(i);
    }
    std::stable_sort(rings.begin(), rings.end(), [&](const RingInfo& a, const RingInfo& b){
        int ra = (a.role == 0 ? (firstOuter >= 0 ? 0 : 1) : (firstHole >= 0 ? 1 : 0));
        int rb = (b.role == 0 ? (firstOuter >= 0 ? 0 : 1) : (firstHole >= 0 ? 1 : 0));
        if (ra != rb) return ra < rb; // keep groups by first-appearance order
        // within group, sort by descending area for stability
        if (a.areaAbs != b.areaAbs) return a.areaAbs > b.areaAbs;
        return a.start < b.start;
    });
    // Rebuild points and metadata based on new order
    std::vector<cadgf_vec2> newPts;
    newPts.reserve(scene.points.size());
    std::vector<int> newCounts; newCounts.reserve(scene.ringCounts.size());
    std::vector<int> newRoles; newRoles.reserve(scene.ringRoles.size());
    for (const auto& ri : rings) {
        for (size_t i = 0; i < static_cast<size_t>(ri.count); ++i) newPts.push_back(scene.points[ri.start + i]);
        newCounts.push_back(ri.count);
        newRoles.push_back(ri.role);
    }
    scene.points.swap(newPts);
    scene.ringCounts.swap(newCounts);
    scene.ringRoles.swap(newRoles);
}
#endif

SceneData createSampleScene() {
    SceneData scene;
    // Match sample_exports/scene_sample (unit square)
    scene.points = {{0,0}, {1,0}, {1,1}, {0,1}};
    scene.ringCounts = {4};
    scene.ringRoles = {0};
    scene.groupId = 0;
    scene.joinType = 0;
    scene.miterLimit = 2.0;
    scene.useDocUnit = true;
    return scene;
}

SceneData createHolesScene() {
    SceneData scene;
    // Match sample_exports/scene_holes
    // Outer ring: 0,0 - 4,0 - 4,3 - 0,3
    scene.points = {{0,0}, {4,0}, {4,3}, {0,3}};
    // Hole: 1,1 - 2,1 - 2,2 - 1,2
    scene.points.insert(scene.points.end(), {{1,1}, {2,1}, {2,2}, {1,2}});
    scene.ringCounts = {4, 4};
    scene.ringRoles = {0, 1}; // 0=outer, 1=hole
    scene.groupId = 0;
    scene.joinType = 0;
    scene.miterLimit = 2.0;
    scene.useDocUnit = true;
    return scene;
}

std::vector<SceneData> createMultiGroupsScene() {
    std::vector<SceneData> scenes;
    
    // Group 0 - Miter
    SceneData scene0;
    // Match sample_exports/scene_multi_groups/group_0.json (unit square at origin)
    scene0.points = {{0,0}, {1,0}, {1,1}, {0,1}};
    scene0.ringCounts = {4};
    scene0.ringRoles = {0};
    scene0.groupId = 0;
    scene0.joinType = 0; // Miter
    scene0.miterLimit = 2.0;
    scene0.useDocUnit = true;
    scenes.push_back(scene0);
    
    // Group 1 - Round
    SceneData scene1;
    // Match sample_exports/scene_multi_groups/group_1.json (shifted to x in [2,3])
    scene1.points = {{2,0}, {3,0}, {3,1}, {2,1}};
    scene1.ringCounts = {4};
    scene1.ringRoles = {0};
    scene1.groupId = 1;
    scene1.joinType = 1; // Round
    scene1.miterLimit = 2.0;
    scene1.useDocUnit = true;
    scenes.push_back(scene1);
    
    // Group 2 - Bevel
    SceneData scene2;
    // Match sample_exports/scene_multi_groups/group_2.json (shifted to y in [2,3])
    scene2.points = {{0,2}, {1,2}, {1,3}, {0,3}};
    scene2.ringCounts = {4};
    scene2.ringRoles = {0};
    scene2.groupId = 2;
    scene2.joinType = 2; // Bevel
    scene2.miterLimit = 2.0;
    scene2.useDocUnit = true;
    scenes.push_back(scene2);
    
    return scenes;
}

SceneData createUnitsScene(double unitScale) {
    SceneData scene;
    scene.points = {{0,0}, {1,0}, {1,1}, {0,1}};
    for (auto& p : scene.points) {
        p.x *= unitScale;
        p.y *= unitScale;
    }
    scene.ringCounts = {4};
    scene.ringRoles = {0};
    scene.groupId = 0;
    scene.joinType = 0;
    scene.miterLimit = 2.0;
    scene.useDocUnit = false; // Using custom unit scale
    return scene;
}

SceneData createComplexScene() {
    SceneData scene;
    // L-shaped outer ring (6 points without closing)
    scene.points = {
        {0,0}, {3,0}, {3,1}, {1,1}, {1,3}, {0,3}
    };
    // First hole (4 points without closing)
    scene.points.insert(scene.points.end(), {
        {0.2,0.2}, {0.8,0.2}, {0.8,0.8}, {0.2,0.8}
    });
    // Second hole (4 points without closing)
    scene.points.insert(scene.points.end(), {
        {1.5,1.5}, {2.5,1.5}, {2.5,2.5}, {1.5,2.5}
    });
    scene.ringCounts = {6, 4, 4};
    scene.ringRoles = {0, 1, 1}; // 0=outer, 1=hole, 1=hole
    scene.groupId = 0;
    scene.joinType = 0;
    scene.miterLimit = 2.0;
    scene.useDocUnit = true;
    return scene;
}

void writeJSON(const std::string& filepath, const SceneData& scene, double unitScale) {
    std::ofstream file(filepath);
    if (!file.is_open()) {
        std::cerr << "Failed to open " << filepath << " for writing\n";
        return;
    }
    
    file << "{\n";
    file << "  \"group_id\": " << scene.groupId << ",\n";
    file << "  \"groupId\": " << scene.groupId << ",\n"; // Compatibility
    file << "  \"flat_pts\": [\n";
    
    // Write points in object format
    for (size_t i = 0; i < scene.points.size(); ++i) {
        file << "    { \"x\": " << std::fixed << std::setprecision(1) 
             << scene.points[i].x << ", \"y\": " << scene.points[i].y << "}";
        if (i < scene.points.size() - 1) file << ",";
        file << "\n";
    }
    
    file << "  ],\n";
    file << "  \"ring_counts\": [";
    for (size_t i = 0; i < scene.ringCounts.size(); ++i) {
        file << scene.ringCounts[i];
        if (i < scene.ringCounts.size() - 1) file << ", ";
    }
    file << "],\n";
    
    file << "  \"ring_roles\": [";
    for (size_t i = 0; i < scene.ringRoles.size(); ++i) {
        file << scene.ringRoles[i];
        if (i < scene.ringRoles.size() - 1) file << ", ";
    }
    file << "],\n";
    
    file << "  \"meta\": {\n";
    // v0.3 additive meta fields
    // pipelineVersion, source, exportTime (UTC ISO8601)
    file << "    \"pipelineVersion\": \"0.3.0\",\n";
    file << "    \"source\": \"cli\",\n";
    {
        // Format export time as ISO8601 UTC
        std::time_t t = std::time(nullptr);
        std::tm tm{};
    #if defined(_WIN32)
        gmtime_s(&tm, &t);
    #else
        gmtime_r(&t, &tm);
    #endif
        std::ostringstream oss;
        oss << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
        file << "    \"exportTime\": \"" << oss.str() << "\",\n";
    }
    file << "    \"joinType\": " << scene.joinType << ",\n";
    file << "    \"miterLimit\": " << std::fixed << std::setprecision(1) 
         << scene.miterLimit << ",\n";
    file << "    \"unitScale\": " << std::fixed << std::setprecision(1) 
         << unitScale << ",\n";
    file << "    \"useDocUnit\": " << (scene.useDocUnit ? "true" : "false") << ",\n";
    file << "    \"normalize\": {\n";
    file << "      \"orientation\": true,\n";
    file << "      \"start\": true,\n";
#ifdef CADGF_SORT_RINGS
    file << "      \"sortRings\": true\n";
#else
    file << "      \"sortRings\": false\n";
#endif
    file << "    }\n";
    file << "  }\n";
    file << "}\n";
    
    file.close();
}

// EXP_FEATURES: signature extended with ExportOptions for experimental flags (normals/uvs/materials)
void writeGLTF(const std::string& gltfPath, const std::string& binPath, 
               const SceneData& scene, bool outerOnlyFan, const ExportOptions& opts) {
#if !defined(CADGF_HAS_TINYGLTF)
    (void)gltfPath;
    (void)binPath;
    (void)scene;
    (void)outerOnlyFan;
    (void)opts;
    static bool warnedOnce = false;
    if (!warnedOnce) {
        std::cerr << "[WARN] TinyGLTF not available; skipping glTF export. (Build with vcpkg tinygltf to enable)\n";
        warnedOnce = true;
    }
    return;
#else
    tinygltf::Model gltfModel;
    tinygltf::Scene gltfScene;
    tinygltf::Mesh gltfMesh;
    tinygltf::Primitive gltfPrimitive;

    // Asset
    gltfModel.asset.version = "2.0";
    gltfModel.asset.generator = "CADGameFusion_CLI_Exporter";

    // 1. Triangulate the polygon
    std::vector<unsigned int> indices;
    int indexCount = 0;
    
    // Try triangulation with rings unless we force outer-only fan for holes scene
    bool success = false;
    if (!outerOnlyFan && scene.ringRoles.size() > 1 && scene.ringRoles[1] == 1) {
        // Has holes - use rings API if available
        success = cadgf_triangulate_polygon_rings(
            scene.points.data(),
            scene.ringCounts.data(),
            static_cast<int>(scene.ringCounts.size()),
            nullptr, 
            &indexCount);
        
        if (success && indexCount > 0) {
            indices.resize(indexCount);
            cadgf_triangulate_polygon_rings(
                scene.points.data(),
                scene.ringCounts.data(),
                static_cast<int>(scene.ringCounts.size()),
                indices.data(),
                &indexCount);
        }
    } else {
        // Simple polygon - use basic triangulation
        int outerCount = scene.ringCounts[0];
        success = cadgf_triangulate_polygon(
            scene.points.data(), outerCount,
            nullptr, &indexCount);
        
        if (success && indexCount > 0) {
            indices.resize(indexCount);
            cadgf_triangulate_polygon(
                scene.points.data(), outerCount,
                indices.data(), &indexCount);
        }
    }
    
    // Fallback to fan triangulation if needed
    if (!success || indexCount == 0) {
        int n = scene.ringCounts[0]; // No closing point now
        indices.clear();
        for (int i = 1; i < n - 1; ++i) {
            indices.push_back(0);
            indices.push_back(i);
            indices.push_back(i + 1);
        }
        indexCount = indices.size();
    }
    
    // 2. Build positions, normals, UVs
    std::vector<float> positions; positions.reserve(scene.points.size() * 3);
    size_t vertexCount = 0;

    if (outerOnlyFan) {
        int outerCount = scene.ringCounts.empty() ? 0 : scene.ringCounts[0];
        vertexCount = static_cast<size_t>(outerCount);
        for (int i=0;i<outerCount;++i) {
            const auto& pt = scene.points[i];
            positions.push_back(static_cast<float>(pt.x));
            positions.push_back(static_cast<float>(pt.y));
            positions.push_back(0.0f);
        }
    } else {
        for (size_t ringIdx=0, off=0; ringIdx<scene.ringCounts.size(); ++ringIdx) {
            int cnt = scene.ringCounts[ringIdx];
            for (int i=0;i<cnt;++i) {
                const auto& pt = scene.points[off+i];
                positions.push_back(static_cast<float>(pt.x));
                positions.push_back(static_cast<float>(pt.y));
                positions.push_back(0.0f);
            }
            vertexCount += static_cast<size_t>(cnt);
            off += static_cast<size_t>(cnt);
        }
    }

    std::vector<float> normals;
    if (opts.emitNormals) {
        normals.resize(vertexCount*3, 0.0f);
        for (size_t i=0;i<vertexCount;i++) normals[i*3+2] = 1.0f;
    }
    std::vector<float> uvs;
    if (opts.emitUVs) {
        uvs.resize(vertexCount*2, 0.0f);
    }

    // 3. Create Buffer
    tinygltf::Buffer buffer;
    size_t totalBufferSize = positions.size() * sizeof(float) +
                             normals.size() * sizeof(float) +
                             uvs.size() * sizeof(float) +
                             indices.size() * sizeof(unsigned int);
    buffer.data.resize(totalBufferSize);
    unsigned char* bufferPtr = buffer.data.data();
    size_t currentOffset = 0;

    // Positions
    std::memcpy(bufferPtr + currentOffset, positions.data(), positions.size() * sizeof(float));
    currentOffset += positions.size() * sizeof(float);
    // Normals
    if (!normals.empty()) {
        std::memcpy(bufferPtr + currentOffset, normals.data(), normals.size() * sizeof(float));
        currentOffset += normals.size() * sizeof(float);
    }
    // UVs
    if (!uvs.empty()) {
        std::memcpy(bufferPtr + currentOffset, uvs.data(), uvs.size() * sizeof(float));
        currentOffset += uvs.size() * sizeof(float);
    }
    // Indices
    std::memcpy(bufferPtr + currentOffset, indices.data(), indices.size() * sizeof(unsigned int));
    currentOffset += indices.size() * sizeof(unsigned int);

    buffer.uri = fs::path(binPath).filename().string();
    gltfModel.buffers.push_back(buffer);

    // 4. Create BufferViews and Accessors
    int bufferViewIdx = 0;
    int accessorIdx = 0;
    currentOffset = 0; // Reset offset for buffer views

    // Positions
    tinygltf::BufferView posBufferView;
    posBufferView.buffer = 0;
    posBufferView.byteOffset = currentOffset;
    posBufferView.byteLength = positions.size() * sizeof(float);
    posBufferView.target = TINYGLTF_TARGET_ARRAY_BUFFER;
    gltfModel.bufferViews.push_back(posBufferView);
    currentOffset += posBufferView.byteLength;

    tinygltf::Accessor posAccessor;
    posAccessor.bufferView = bufferViewIdx++;
    posAccessor.byteOffset = 0;
    posAccessor.componentType = TINYGLTF_COMPONENT_TYPE_FLOAT;
    posAccessor.count = vertexCount;
    posAccessor.type = TINYGLTF_TYPE_VEC3;
    float minX = std::numeric_limits<float>::infinity(), minY = minX, minZ = 0.0f;
    float maxX = -std::numeric_limits<float>::infinity(), maxY = maxX, maxZ = 0.0f;
    for (size_t i=0; i+2 < positions.size(); i+=3) {
        float x=positions[i], y=positions[i+1];
        if (x<minX) minX=x; if (x>maxX) maxX=x;
        if (y<minY) minY=y; if (y>maxY) maxY=y;
    }
    if (!std::isfinite(minX)) { minX=minY=0.0f; maxX=maxY=0.0f; } // Handle empty case
    posAccessor.minValues = {static_cast<double>(minX), static_cast<double>(minY), static_cast<double>(minZ)};
    posAccessor.maxValues = {static_cast<double>(maxX), static_cast<double>(maxY), static_cast<double>(maxZ)};
    gltfModel.accessors.push_back(posAccessor);
    int posAccessorIdx = accessorIdx++;

    // Normals
    int normalAccessorIdx = -1;
    if (!normals.empty()) {
        tinygltf::BufferView normalBufferView;
        normalBufferView.buffer = 0;
        normalBufferView.byteOffset = currentOffset;
        normalBufferView.byteLength = normals.size() * sizeof(float);
        normalBufferView.target = TINYGLTF_TARGET_ARRAY_BUFFER;
        gltfModel.bufferViews.push_back(normalBufferView);
        currentOffset += normalBufferView.byteLength;

        tinygltf::Accessor normalAccessor;
        normalAccessor.bufferView = bufferViewIdx++;
        normalAccessor.byteOffset = 0;
        normalAccessor.componentType = TINYGLTF_COMPONENT_TYPE_FLOAT;
        normalAccessor.count = vertexCount;
        normalAccessor.type = TINYGLTF_TYPE_VEC3;
        gltfModel.accessors.push_back(normalAccessor);
        normalAccessorIdx = accessorIdx++;
    }

    // UVs
    int uvAccessorIdx = -1;
    if (!uvs.empty()) {
        tinygltf::BufferView uvBufferView;
        uvBufferView.buffer = 0;
        uvBufferView.byteOffset = currentOffset;
        uvBufferView.byteLength = uvs.size() * sizeof(float);
        uvBufferView.target = TINYGLTF_TARGET_ARRAY_BUFFER;
        gltfModel.bufferViews.push_back(uvBufferView);
        currentOffset += uvBufferView.byteLength;

        tinygltf::Accessor uvAccessor;
        uvAccessor.bufferView = bufferViewIdx++;
        uvAccessor.byteOffset = 0;
        uvAccessor.componentType = TINYGLTF_COMPONENT_TYPE_FLOAT;
        uvAccessor.count = vertexCount;
        uvAccessor.type = TINYGLTF_TYPE_VEC2;
        gltfModel.accessors.push_back(uvAccessor);
        uvAccessorIdx = accessorIdx++;
    }

    // Indices
    tinygltf::BufferView idxBufferView;
    idxBufferView.buffer = 0;
    idxBufferView.byteOffset = currentOffset;
    idxBufferView.byteLength = indices.size() * sizeof(unsigned int);
    idxBufferView.target = TINYGLTF_TARGET_ELEMENT_ARRAY_BUFFER;
    gltfModel.bufferViews.push_back(idxBufferView);
    currentOffset += idxBufferView.byteLength;

    tinygltf::Accessor idxAccessor;
    idxAccessor.bufferView = bufferViewIdx++;
    idxAccessor.byteOffset = 0;
    idxAccessor.componentType = TINYGLTF_COMPONENT_TYPE_UNSIGNED_INT;
    idxAccessor.count = indices.size();
    idxAccessor.type = TINYGLTF_TYPE_SCALAR;
    gltfModel.accessors.push_back(idxAccessor);
    int idxAccessorIdx = accessorIdx++;

    // 5. Create Primitive and Mesh
    gltfPrimitive.attributes["POSITION"] = posAccessorIdx;
    if (normalAccessorIdx != -1) gltfPrimitive.attributes["NORMAL"] = normalAccessorIdx;
    if (uvAccessorIdx != -1) gltfPrimitive.attributes["TEXCOORD_0"] = uvAccessorIdx;
    gltfPrimitive.indices = idxAccessorIdx;
    gltfPrimitive.mode = TINYGLTF_MODE_TRIANGLES;

    if (opts.emitMaterialsStub) {
        tinygltf::Material material;
        material.name = "Default";
        material.pbrMetallicRoughness.baseColorFactor = {1.0, 1.0, 1.0, 1.0};
        material.pbrMetallicRoughness.metallicFactor = 0.0;
        material.pbrMetallicRoughness.roughnessFactor = 1.0;
        gltfModel.materials.push_back(material);
        gltfPrimitive.material = 0;
    }

    gltfMesh.primitives.push_back(gltfPrimitive);
    gltfModel.meshes.push_back(gltfMesh);

    // 6. Create Node and Scene
    tinygltf::Node node;
    node.mesh = 0;
    gltfModel.nodes.push_back(node);

    gltfScene.nodes.push_back(0);
    gltfModel.scenes.push_back(gltfScene);
    gltfModel.defaultScene = 0;

    // 7. Save GLTF
    tinygltf::TinyGLTF gltfLoader;
    bool ret = gltfLoader.WriteGltfSceneToFile(&gltfModel, gltfPath, false, false, true, false);
    if (!ret) {
        std::cerr << "Failed to write glTF file: " << gltfPath << "\n";
    }
#endif
}

void exportScene(const std::string& outputDir, const std::string& sceneName,
                 const std::vector<SceneData>& scenes, double unitScale,
                 bool gltfOuterOnlyForHoles, const ExportOptions& opts) {
    std::string sceneDir = outputDir + "/scene_cli_" + sceneName;
    fs::create_directories(sceneDir);
    
    for (auto scene : scenes) {
        // Normalize ring orientation and start vertex for stability
        normalizeOrientation(scene);
        normalizeStartVertex(scene);
#ifdef CADGF_SORT_RINGS
        sortRingsByRoleAndArea(scene);
#endif
        std::string baseName = "group_" + std::to_string(scene.groupId);
        
        // Write JSON
        std::string jsonPath = sceneDir + "/" + baseName + ".json";
        writeJSON(jsonPath, scene, unitScale);

        // Write DXF if requested
        if (opts.emitDxf) {
            std::string dxfPath = sceneDir + "/mesh_" + baseName + ".dxf";
            writeDXF(dxfPath, scene, unitScale);
        }
        
        // Write glTF + bin (skip for multi-groups since they are JSON only)
        if (sceneName != "multi" || scenes.size() == 1) {
            std::string gltfPath = sceneDir + "/mesh_" + baseName + ".gltf";
            std::string binPath = sceneDir + "/mesh_" + baseName + ".bin";
            // Determine if this scene has holes
            bool hasHoles = false;
            if (scene.ringCounts.size() > 1) {
                for (size_t r = 1; r < scene.ringCounts.size(); ++r) {
                    if (r < scene.ringRoles.size() ? scene.ringRoles[r] == 1 : true) { hasHoles = true; break; }
                }
            }
            bool outerOnlyFan = (gltfOuterOnlyForHoles && hasHoles);
            writeGLTF(gltfPath, binPath, scene, outerOnlyFan, opts);
        }
    }
    
    std::cout << "Exported " << sceneName << " to " << sceneDir << "\n";
}

    // Parse spec JSON using nlohmann/json when available; no fallback in strict mode
    #ifdef CADGF_USE_NLOHMANN_JSON
    #include "third_party/json.hpp" // expected to be official nlohmann/json single-header
    #endif
    
    static std::vector<SceneData> parseSpecFile(const std::string& path) {
    #ifdef CADGF_USE_NLOHMANN_JSON
        using nlohmann::json;
        std::ifstream f(path);
        if (!f.is_open()) throw std::runtime_error("Failed to open spec file: " + path);
        json j; f >> j; f.close();

        auto parse_one = [](const json& js) -> SceneData {
            SceneData sc{};
            sc.groupId    = js.value("group_id", js.value("groupId", 0));
            sc.joinType   = js.contains("meta") ? js["meta"].value("joinType", 0) : 0;
            sc.miterLimit = js.contains("meta") ? js["meta"].value("miterLimit", 2.0) : 2.0;
            sc.useDocUnit = js.contains("meta") ? js["meta"].value("useDocUnit", true) : true;

            std::vector<int> counts;
            std::vector<int> roles;
            std::vector<cadgf_vec2> pts;

            if (js.contains("rings")) {
                for (const auto& ring : js.at("rings")) {
                    int cnt = 0;
                    for (const auto& p : ring) {
                        if (p.is_object()) pts.push_back(cadgf_vec2{ p.value("x",0.0), p.value("y",0.0) });
                        else if (p.is_array() && p.size()>=2) pts.push_back(cadgf_vec2{ p[0].get<double>(), p[1].get<double>() });
                        cnt++;
                    }
                    counts.push_back(cnt);
                }
                if (js.contains("ring_roles")) for (const auto& rr : js.at("ring_roles")) roles.push_back(rr.get<int>());
            } else {
                if (js.contains("flat_pts")) {
                    for (const auto& p : js.at("flat_pts")) {
                        if (p.is_object()) pts.push_back(cadgf_vec2{ p.value("x",0.0), p.value("y",0.0) });
                        else if (p.is_array() && p.size()>=2) pts.push_back(cadgf_vec2{ p[0].get<double>(), p[1].get<double>() });
                    }
                }
                if (js.contains("ring_counts")) for (const auto& c : js.at("ring_counts")) counts.push_back(c.get<int>());
                if (js.contains("ring_roles")) for (const auto& rr : js.at("ring_roles")) roles.push_back(rr.get<int>());
            }

            if (roles.empty() && !counts.empty()) { roles.push_back(0); for (size_t i=1;i<counts.size();++i) roles.push_back(1);}
            if (pts.empty() || counts.empty()) throw std::runtime_error("Spec must contain 'rings' or 'flat_pts' + 'ring_counts'");

            sc.points = std::move(pts); sc.ringCounts = std::move(counts); sc.ringRoles = std::move(roles);
            return sc;
        };

        std::vector<SceneData> out;
        if (j.contains("scenes")) { for (const auto& it : j.at("scenes")) out.push_back(parse_one(it)); } 
        else { out.push_back(parse_one(j)); }
        return out;
    #else
        throw std::runtime_error("This build does not enable CADGF_USE_NLOHMANN_JSON; --spec is unavailable");
    #endif
    }

void parseArgs(int argc, char* argv[], ExportOptions& opts) {
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        
        if (arg == "--out" && i + 1 < argc) {
            opts.outputDir = argv[++i];
        } else if (arg == "--scene" && i + 1 < argc) {
            opts.scene = argv[++i];
        } else if (arg == "--unit" && i + 1 < argc) {
            opts.unitScale = std::stod(argv[++i]);
        } else if (arg == "--spec-dir" && i + 1 < argc) {
            opts.specDir = argv[++i];
        } else if (arg == "--spec" && i + 1 < argc) {
            opts.specFile = argv[++i];
        } else if (arg == "--gltf-holes" && i + 1 < argc) {
            std::string v = argv[++i];
            if (v == "outer") opts.gltfHolesMode = ExportOptions::HolesMode::OuterOnly;
            else if (v == "full") opts.gltfHolesMode = ExportOptions::HolesMode::Full;
            else { std::cerr << "Invalid value for --gltf-holes (outer|full)\n"; std::exit(2); }
        } else if (arg == "--emit-normals") {
            opts.emitNormals = true;
        } else if (arg == "--emit-uvs") {
            opts.emitUVs = true;
        } else if (arg == "--emit-materials-stub") {
            opts.emitMaterialsStub = true;
        } else if (arg == "--dxf") {
            opts.emitDxf = true;
        } else if (arg == "--help" || arg == "-h") {
            std::cout << "Usage: export_cli [options]\n";
            std::cout << "  --out <dir>    Output directory (default: build/exports)\n";
            std::cout << "  --scene <name> Scene name: sample|holes|multi|units|complex (default: sample)\n";
            std::cout << "  --unit <scale> Unit scale (default: 1.0)\n";
            std::cout << "  --spec-dir <d> Copy scene files from spec directory (group_*.json, mesh_group_*)\n";
            std::cout << "  --spec <file>  Read JSON spec and generate scene(s)\n";
            std::cout << "  --gltf-holes <outer|full> Emit glTF vertices for holes (default: outer)\n";
            std::cout << "  --emit-normals           (experimental) add flat normals accessor\n";
            std::cout << "  --emit-uvs               (experimental) add UV accessor\n";
            std::cout << "  --emit-materials-stub    (experimental) add default material & primitive.material\n";
            std::cout << "  --dxf                    emit DXF file\n";
            exit(0);
        }
    }
}

int main(int argc, char* argv[]) {
    ExportOptions opts;
    parseArgs(argc, argv, opts);
    
    // Validate mutually exclusive options
    if (!opts.specDir.empty() && !opts.specFile.empty()) {
        std::cerr << "Options --spec-dir and --spec are mutually exclusive.\n";
        return 2;
    }
    if (!opts.specFile.empty() && !opts.scene.empty() && opts.scene != "sample") {
        // If user provided both --spec and --scene, we ignore scene but warn (scene defaults to sample)
        std::cerr << "[WARN] --spec provided; ignoring --scene option.\n";
    }

    // Create output directory
    fs::create_directories(opts.outputDir);
    
    // If specDir provided, copy files as-is into a scene directory and exit
    if (!opts.specDir.empty()) {
        fs::path spec{opts.specDir};
        std::string sceneDir = opts.outputDir + "/scene_cli_spec";
        fs::create_directories(sceneDir);
        for (auto& p : fs::directory_iterator(spec)) {
            auto name = p.path().filename().string();
            if (name.rfind("group_",0)==0 && p.path().extension()==".json") {
                fs::copy_file(p.path(), fs::path(sceneDir)/name, fs::copy_options::overwrite_existing);
            }
            if (name.rfind("mesh_group_",0)==0 && (p.path().extension()==".gltf" || p.path().extension()==".bin")) {
                fs::copy_file(p.path(), fs::path(sceneDir)/name, fs::copy_options::overwrite_existing);
            }
        }
        std::cout << "Copied spec scene from " << opts.specDir << " to " << sceneDir << "\n";
        return 0;
    }

    // If spec JSON provided, parse and export
    if (!opts.specFile.empty()) {
        try {
            auto scenes = parseSpecFile(opts.specFile);
            // Use file stem as scene name for clarity
            std::string stem = fs::path(opts.specFile).stem().string();
            if (stem.empty()) stem = "spec";
            exportScene(opts.outputDir, stem, scenes, opts.unitScale, opts.gltfHolesMode == ExportOptions::HolesMode::OuterOnly, opts);
            return 0;
        } catch (const std::exception& e) {
            std::cerr << "[ERROR] Failed to parse spec: " << e.what() << "\n";
            return 3;
        }
    }

    // Export requested scene
    if (opts.scene == "sample") {
        std::vector<SceneData> scenes = {createSampleScene()};
        exportScene(opts.outputDir, "sample", scenes, opts.unitScale, opts.gltfHolesMode == ExportOptions::HolesMode::OuterOnly, opts);
    } else if (opts.scene == "holes") {
        std::vector<SceneData> scenes = {createHolesScene()};
        exportScene(opts.outputDir, "holes", scenes, opts.unitScale, opts.gltfHolesMode == ExportOptions::HolesMode::OuterOnly, opts);
    } else if (opts.scene == "multi") {
        auto scenes = createMultiGroupsScene();
        exportScene(opts.outputDir, "multi", scenes, opts.unitScale, opts.gltfHolesMode == ExportOptions::HolesMode::OuterOnly, opts);
    } else if (opts.scene == "units") {
        std::vector<SceneData> scenes = {createUnitsScene(1000.0)};
        exportScene(opts.outputDir, "units", scenes, 1000.0, opts.gltfHolesMode == ExportOptions::HolesMode::OuterOnly, opts);
    } else if (opts.scene == "complex") {
        std::vector<SceneData> scenes = {createComplexScene()};
        exportScene(opts.outputDir, "complex", scenes, opts.unitScale, opts.gltfHolesMode == ExportOptions::HolesMode::OuterOnly, opts);
    } else {
        std::cerr << "Unknown scene: " << opts.scene << "\n";
        return 1;
    }
    
    return 0;
}
