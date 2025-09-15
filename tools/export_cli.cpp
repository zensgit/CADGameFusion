#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <cstring>
#include <filesystem>
#include <iomanip>
#include <sstream>
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
    file << "    \"useDocUnit\": " << (scene.useDocUnit ? "true" : "false") << "\n";
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
            scene.points.data(), scene.points.size(),
            scene.ringCounts.data(), scene.ringCounts.size(),
            nullptr, &indexCount);
        
        if (success && indexCount > 0) {
            indices.resize(indexCount);
            core_triangulate_polygon_rings(
                scene.points.data(), scene.points.size(),
                scene.ringCounts.data(), scene.ringCounts.size(),
                indices.data(), &indexCount);
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
    gltfFile << "      \"min\": [0,0,0], \"max\": [1000,1000,0] },\n";
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
    
    for (const auto& scene : scenes) {
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

// Minimal ad-hoc parser for flat_pts + ring_counts (+ ring_roles) JSON.
// This supports our provided specs without external deps.
static std::vector<SceneData> parseSpecFile(const std::string& path) {
    std::ifstream f(path);
    if (!f.is_open()) throw std::runtime_error("Failed to open spec file: " + path);
    std::stringstream buffer; buffer << f.rdbuf(); f.close();
    const std::string s = buffer.str();

    // Helper: find matching ']' for '[' at pos
    auto match_rbracket = [&](size_t open_pos) -> size_t {
        int depth = 0;
        for (size_t i = open_pos; i < s.size(); ++i) {
            if (s[i] == '[') depth++;
            else if (s[i] == ']') { depth--; if (depth == 0) return i; }
        }
        return std::string::npos;
    };

    // Parse rings in object format: rings: [ [ {x,y}, ... ], ... ]
    auto parse_rings_objects = [&]() -> std::vector<std::vector<core_vec2>> {
        std::vector<std::vector<core_vec2>> rings_out;
        auto pos = s.find("\"rings\"");
        if (pos == std::string::npos) return rings_out;
        pos = s.find('[', pos);
        if (pos == std::string::npos) return rings_out;
        size_t rings_open = pos;
        size_t rings_close = match_rbracket(rings_open);
        if (rings_close == std::string::npos) return rings_out;
        size_t i = rings_open + 1;
        while (i < rings_close) {
            // find next ring '['
            size_t ring_open = s.find('[', i);
            if (ring_open == std::string::npos || ring_open >= rings_close) break;
            size_t ring_close = match_rbracket(ring_open);
            if (ring_close == std::string::npos || ring_close > rings_close) break;
            std::string ring_sub = s.substr(ring_open, ring_close - ring_open + 1);
            std::vector<core_vec2> ring_pts;
            size_t cursor = 0;
            while (true) {
                size_t xk = ring_sub.find("\"x\"", cursor);
                if (xk == std::string::npos) break;
                size_t xcolon = ring_sub.find(':', xk);
                size_t xend = ring_sub.find_first_of(",}\n\r\t ", xcolon + 1);
                if (xcolon == std::string::npos) break;
                double x = std::stod(ring_sub.substr(xcolon + 1, (xend == std::string::npos ? ring_sub.size() : xend) - (xcolon + 1)));
                size_t yk = ring_sub.find("\"y\"", xend == std::string::npos ? xcolon + 1 : xend + 1);
                if (yk == std::string::npos) break;
                size_t ycolon = ring_sub.find(':', yk);
                size_t yend = ring_sub.find_first_of(",}\n\r\t ", ycolon + 1);
                double y = std::stod(ring_sub.substr(ycolon + 1, (yend == std::string::npos ? ring_sub.size() : yend) - (ycolon + 1)));
                ring_pts.push_back(core_vec2{ x, y });
                cursor = (yend == std::string::npos ? ring_sub.size() : yend + 1);
            }
            if (!ring_pts.empty()) rings_out.push_back(std::move(ring_pts));
            i = ring_close + 1;
        }
        return rings_out;
    };

    auto findIntArray = [&](const std::string& key) -> std::vector<int> {
        std::vector<int> out; out.reserve(8);
        auto pos = s.find("\"" + key + "\"");
        if (pos == std::string::npos) return out;
        pos = s.find('[', pos);
        if (pos == std::string::npos) return out;
        int depth = 1; size_t i = pos + 1; std::string num;
        auto flush = [&]() {
            if (!num.empty()) { out.push_back(std::stoi(num)); num.clear(); }
        };
        for (; i < s.size(); ++i) {
            if (s[i] == '[') depth++;
            else if (s[i] == ']') { depth--; if (depth == 0) { flush(); break; } }
            else if ((s[i] >= '0' && s[i] <= '9') || s[i] == '-' ) num.push_back(s[i]);
            else if (s[i] == ',' || s[i] == ' ' || s[i] == '\n' || s[i] == '\r' || s[i] == '\t') { flush(); }
        }
        return out;
    };

    auto findDoublePairs = [&](const std::string& key) -> std::vector<core_vec2> {
        std::vector<core_vec2> pts; pts.reserve(32);
        auto pos = s.find("\"" + key + "\"");
        if (pos == std::string::npos) return pts;
        pos = s.find('[', pos);
        if (pos == std::string::npos) return pts;
        int depth = 1; size_t i = pos + 1;
        // Try to parse either objects with x/y or arrays [x,y]
        while (i < s.size() && depth > 0) {
            if (s[i] == '{') {
                // parse { "x": num, "y": num }
                size_t j = i;
                double x = 0.0, y = 0.0; bool hasX=false, hasY=false;
                while (j < s.size()) {
                    if (s[j] == '}') { i = j + 1; break; }
                    auto xk = s.find("\"x\"", j);
                    auto yk = s.find("\"y\"", j);
                    if (xk != std::string::npos && xk < s.find('}', j)) {
                        auto colon = s.find(':', xk);
                        auto end = s.find_first_of(",}\n\r\t ", colon+1);
                        x = std::stod(s.substr(colon+1, end - (colon+1))); hasX=true; j = end;
                    } else if (yk != std::string::npos && yk < s.find('}', j)) {
                        auto colon = s.find(':', yk);
                        auto end = s.find_first_of(",}\n\r\t ", colon+1);
                        y = std::stod(s.substr(colon+1, end - (colon+1))); hasY=true; j = end;
                    } else { j++; }
                }
                if (hasX && hasY) pts.push_back(core_vec2{ x, y });
            } else if (s[i] == '[') {
                // parse [x,y]
                size_t j = i + 1;
                // skip whitespace
                while (j < s.size() && (s[j]==' '||s[j]=='\n'||s[j]=='\r'||s[j]=='\t')) j++;
                size_t j2 = s.find(',', j);
                size_t j3 = s.find(']', j2 == std::string::npos ? j : j2 + 1);
                if (j2 != std::string::npos && j3 != std::string::npos) {
                    double x = std::stod(s.substr(j, j2 - j));
                    double y = std::stod(s.substr(j2+1, j3 - (j2+1)));
                    pts.push_back(core_vec2{ x, y });
                    i = j3 + 1;
                } else {
                    i++;
                }
            } else if (s[i] == ']') {
                depth--; i++;
            } else if (s[i] == '[') {
                depth++; i++;
            } else { i++; }
        }
        return pts;
    };

    auto findIntValue = [&](const std::string& key, int defVal) -> int {
        auto pos = s.find("\"" + key + "\"");
        if (pos == std::string::npos) return defVal;
        pos = s.find(':', pos);
        if (pos == std::string::npos) return defVal;
        size_t end = s.find_first_of(",}\n\r\t ", pos+1);
        return std::stoi(s.substr(pos+1, end - (pos+1)));
    };

    auto findBoolValue = [&](const std::string& key, bool defVal) -> bool {
        auto pos = s.find("\"" + key + "\"");
        if (pos == std::string::npos) return defVal;
        pos = s.find(':', pos);
        if (pos == std::string::npos) return defVal;
        auto sub = s.substr(pos+1, 5);
        if (sub.find("true") != std::string::npos) return true;
        if (sub.find("false") != std::string::npos) return false;
        return defVal;
    };

    std::vector<SceneData> result;

    // Single-scene support: prefer rings if present, else flat_pts + ring_counts
    SceneData sc{};
    sc.groupId = findIntValue("group_id", findIntValue("groupId", 0));
    sc.joinType = findIntValue("joinType", 0);
    sc.miterLimit = 2.0;
    sc.useDocUnit = findBoolValue("useDocUnit", true);

    auto rings = parse_rings_objects();
    if (!rings.empty()) {
        // Flatten
        std::vector<int> counts; counts.reserve(rings.size());
        std::vector<core_vec2> pts;
        for (const auto& ring : rings) {
            counts.push_back(static_cast<int>(ring.size()));
            pts.insert(pts.end(), ring.begin(), ring.end());
        }
        std::vector<int> roles = findIntArray("ring_roles");
        if (roles.empty()) {
            roles.push_back(0); for (size_t i = 1; i < counts.size(); ++i) roles.push_back(1);
        }
        sc.points = std::move(pts);
        sc.ringCounts = std::move(counts);
        sc.ringRoles = std::move(roles);
    } else {
        auto counts = findIntArray("ring_counts");
        auto roles  = findIntArray("ring_roles");
        auto pts    = findDoublePairs("flat_pts");
        if (pts.empty() || counts.empty()) {
            throw std::runtime_error("Spec must contain 'rings' or 'flat_pts' + 'ring_counts'");
        }
        if (roles.empty() && !counts.empty()) {
            roles.push_back(0); for (size_t i = 1; i < counts.size(); ++i) roles.push_back(1);
        }
        sc.points = std::move(pts);
        sc.ringCounts = std::move(counts);
        sc.ringRoles = std::move(roles);
    }

    result.push_back(std::move(sc));
    return result;
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
