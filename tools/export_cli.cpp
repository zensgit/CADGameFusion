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
#include "core/core_c_api.h"

namespace fs = std::filesystem;

struct ExportOptions {
    std::string outputDir = "build/exports";
    std::string scene = "sample";
    double unitScale = 1.0;
    std::string specDir; // when set, copy from spec directory
    std::string specFile; // when set, read JSON spec file
};

// Scene definitions
struct SceneData {
    std::vector<core_vec2> points;
    std::vector<int> ringCounts;
    std::vector<int> ringRoles;
    int groupId;
    int joinType;
    double miterLimit;
    bool useDocUnit;
};

static double signedArea(const std::vector<core_vec2>& pts, size_t start, size_t count) {
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
    std::vector<core_vec2> newPts;
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
    scene.points = {{0,0}, {100,0}, {100,100}, {0,100}};
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
    // Outer ring
    scene.points = {{0,0}, {200,0}, {200,200}, {0,200}};
    // Hole
    scene.points.insert(scene.points.end(), {
        {50,50}, {150,50}, {150,150}, {50,150}
    });
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
    scene0.points = {{0,0}, {100,0}, {100,100}, {0,100}};
    scene0.ringCounts = {4};
    scene0.ringRoles = {0};
    scene0.groupId = 0;
    scene0.joinType = 0; // Miter
    scene0.miterLimit = 2.0;
    scene0.useDocUnit = true;
    scenes.push_back(scene0);
    
    // Group 1 - Round
    SceneData scene1;
    scene1.points = {{150,0}, {250,0}, {250,100}, {150,100}};
    scene1.ringCounts = {4};
    scene1.ringRoles = {0};
    scene1.groupId = 1;
    scene1.joinType = 1; // Round
    scene1.miterLimit = 2.0;
    scene1.useDocUnit = true;
    scenes.push_back(scene1);
    
    // Group 2 - Bevel
    SceneData scene2;
    scene2.points = {{300,0}, {400,0}, {400,100}, {300,100}};
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

void writeGLTF(const std::string& gltfPath, const std::string& binPath, 
               const SceneData& scene) {
    // Triangulate the polygon
    std::vector<unsigned int> indices;
    int indexCount = 0;
    
    // Try triangulation with rings
    bool success = false;
    if (scene.ringRoles.size() > 1 && scene.ringRoles[1] == 1) {
        // Has holes - use rings API if available
        success = core_triangulate_polygon_rings(
            reinterpret_cast<const core_vec2*>(scene.points.data()),
            scene.ringCounts.data(),
            static_cast<int>(scene.ringCounts.size()),
            nullptr, 
            &indexCount);
        
        if (success && indexCount > 0) {
            indices.resize(indexCount);
            core_triangulate_polygon_rings(
                reinterpret_cast<const core_vec2*>(scene.points.data()),
                scene.ringCounts.data(),
                static_cast<int>(scene.ringCounts.size()),
                indices.data(),
                &indexCount);
        }
    } else {
        // Simple polygon - use basic triangulation
        int outerCount = scene.ringCounts[0];
        success = core_triangulate_polygon(
            scene.points.data(), outerCount,
            nullptr, &indexCount);
        
        if (success && indexCount > 0) {
            indices.resize(indexCount);
            core_triangulate_polygon(
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
    
    // Write binary file
    std::ofstream binFile(binPath, std::ios::binary);
    if (!binFile.is_open()) {
        std::cerr << "Failed to open " << binPath << " for writing\n";
        return;
    }
    
    // Write vertices (no closing points now)
    std::vector<float> vertices;
    size_t vertexCount = 0;
    for (size_t ringIdx = 0; ringIdx < scene.ringCounts.size(); ++ringIdx) {
        vertexCount += scene.ringCounts[ringIdx];
    }
    
    for (const auto& pt : scene.points) {
        vertices.push_back(static_cast<float>(pt.x));
        vertices.push_back(static_cast<float>(pt.y));
        vertices.push_back(0.0f); // Z=0
    }
    
    binFile.write(reinterpret_cast<const char*>(vertices.data()), 
                  vertices.size() * sizeof(float));
    binFile.write(reinterpret_cast<const char*>(indices.data()), 
                  indices.size() * sizeof(unsigned int));
    binFile.close();
    
    // Write glTF file
    std::ofstream gltfFile(gltfPath);
    if (!gltfFile.is_open()) {
        std::cerr << "Failed to open " << gltfPath << " for writing\n";
        return;
    }
    
    size_t vertexByteLength = vertices.size() * sizeof(float);
    size_t indexByteLength = indices.size() * sizeof(unsigned int);
    size_t totalByteLength = vertexByteLength + indexByteLength;

    // Compute POSITION min/max (AABB)
    float minX = std::numeric_limits<float>::infinity();
    float minY = std::numeric_limits<float>::infinity();
    float maxX = -std::numeric_limits<float>::infinity();
    float maxY = -std::numeric_limits<float>::infinity();
    for (size_t i = 0; i + 2 < vertices.size(); i += 3) {
        float x = vertices[i];
        float y = vertices[i + 1];
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    if (!std::isfinite(minX)) { minX = minY = 0.0f; maxX = maxY = 0.0f; }
    
    gltfFile << "{\n";
    gltfFile << "  \"asset\": { \"version\": \"2.0\" },\n";
    gltfFile << "  \"buffers\": [\n";
    gltfFile << "    { \"uri\": \"" << fs::path(binPath).filename().string() 
             << "\", \"byteLength\": " << totalByteLength << " }\n";
    gltfFile << "  ],\n";
    gltfFile << "  \"bufferViews\": [\n";
    gltfFile << "    { \"buffer\": 0, \"byteOffset\": 0, \"byteLength\": " 
             << vertexByteLength << ", \"target\": 34962 },\n";
    gltfFile << "    { \"buffer\": 0, \"byteOffset\": " << vertexByteLength 
             << ", \"byteLength\": " << indexByteLength << ", \"target\": 34963 }\n";
    gltfFile << "  ],\n";
    gltfFile << "  \"accessors\": [\n";
    gltfFile << "    { \"bufferView\": 0, \"byteOffset\": 0, \"componentType\": 5126, "
             << "\"count\": " << vertexCount << ", \"type\": \"VEC3\",\n";
    gltfFile << "      \"min\": [" << minX << "," << minY << ",0], \"max\": [" << maxX << "," << maxY << ",0] },\n";
    gltfFile << "    { \"bufferView\": 1, \"byteOffset\": 0, \"componentType\": 5125, "
             << "\"count\": " << indices.size() << ", \"type\": \"SCALAR\" }\n";
    gltfFile << "  ],\n";
    gltfFile << "  \"meshes\": [\n";
    gltfFile << "    { \"primitives\": [ { \"attributes\": { \"POSITION\": 0 }, "
             << "\"indices\": 1, \"mode\": 4 } ] }\n";
    gltfFile << "  ],\n";
    gltfFile << "  \"nodes\": [ { \"mesh\": 0 } ],\n";
    gltfFile << "  \"scenes\": [ { \"nodes\": [0] } ],\n";
    gltfFile << "  \"scene\": 0\n";
    gltfFile << "}\n";
    
    gltfFile.close();
}

void exportScene(const std::string& outputDir, const std::string& sceneName,
                 const std::vector<SceneData>& scenes, double unitScale) {
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
        
        // Write glTF + bin (skip for multi-groups since they are JSON only)
        if (sceneName != "multi" || scenes.size() == 1) {
            std::string gltfPath = sceneDir + "/mesh_" + baseName + ".gltf";
            std::string binPath = sceneDir + "/mesh_" + baseName + ".bin";
            writeGLTF(gltfPath, binPath, scene);
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
            std::vector<core_vec2> pts;

            if (js.contains("rings")) {
                for (const auto& ring : js.at("rings")) {
                    int cnt = 0;
                    for (const auto& p : ring) {
                        if (p.is_object()) pts.push_back(core_vec2{ p.value("x",0.0), p.value("y",0.0) });
                        else if (p.is_array() && p.size()>=2) pts.push_back(core_vec2{ p[0].get<double>(), p[1].get<double>() });
                        cnt++;
                    }
                    counts.push_back(cnt);
                }
                if (js.contains("ring_roles")) for (const auto& rr : js.at("ring_roles")) roles.push_back(rr.get<int>());
            } else {
                if (js.contains("flat_pts")) {
                    for (const auto& p : js.at("flat_pts")) {
                        if (p.is_object()) pts.push_back(core_vec2{ p.value("x",0.0), p.value("y",0.0) });
                        else if (p.is_array() && p.size()>=2) pts.push_back(core_vec2{ p[0].get<double>(), p[1].get<double>() });
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
        } else if (arg == "--help" || arg == "-h") {
            std::cout << "Usage: export_cli [options]\n";
            std::cout << "  --out <dir>    Output directory (default: build/exports)\n";
            std::cout << "  --scene <name> Scene name: sample|holes|multi|units|complex (default: sample)\n";
            std::cout << "  --unit <scale> Unit scale (default: 1.0)\n";
            std::cout << "  --spec-dir <d> Copy scene files from spec directory (group_*.json, mesh_group_*)\n";
            std::cout << "  --spec <file>  Read JSON spec and generate scene(s)\n";
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
            exportScene(opts.outputDir, stem, scenes, opts.unitScale);
            return 0;
        } catch (const std::exception& e) {
            std::cerr << "[ERROR] Failed to parse spec: " << e.what() << "\n";
            return 3;
        }
    }

    // Export requested scene
    if (opts.scene == "sample") {
        std::vector<SceneData> scenes = {createSampleScene()};
        exportScene(opts.outputDir, "sample", scenes, opts.unitScale);
    } else if (opts.scene == "holes") {
        std::vector<SceneData> scenes = {createHolesScene()};
        exportScene(opts.outputDir, "holes", scenes, opts.unitScale);
    } else if (opts.scene == "multi") {
        auto scenes = createMultiGroupsScene();
        exportScene(opts.outputDir, "multi", scenes, opts.unitScale);
    } else if (opts.scene == "units") {
        std::vector<SceneData> scenes = {createUnitsScene(1000.0)};
        exportScene(opts.outputDir, "units", scenes, 1000.0);
    } else if (opts.scene == "complex") {
        std::vector<SceneData> scenes = {createComplexScene()};
        exportScene(opts.outputDir, "complex", scenes, opts.unitScale);
    } else {
        std::cerr << "Unknown scene: " << opts.scene << "\n";
        return 1;
    }
    
    return 0;
}
