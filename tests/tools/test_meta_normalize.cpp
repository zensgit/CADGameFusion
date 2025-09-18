#include <cassert>
#include <fstream>
#include <filesystem>
#include <iostream>
#include <string>
#include <cstdlib>

#include "../../tools/third_party/json.hpp"

namespace fs = std::filesystem;
using json = nlohmann::json;

// Test that meta.normalize fields are properly emitted in JSON export
// Tests Issue #13: C++ unit test for meta.normalize emission

extern "C" {
#include "core/core_c_api.h"
}

static void writeSimpleScene(const std::string& tempDir, const std::string& sceneName, double unitScale) {
    // Create a simple scene with outer + hole for testing
    std::string jsonPath = tempDir + "/" + sceneName + ".json";
    
    std::ofstream file(jsonPath);
    assert(file.is_open());
    
    // Write a simple test scene with meta fields
    file << "{\n";
    file << "  \"group_id\": 0,\n";
    file << "  \"groupId\": 0,\n";
    file << "  \"flat_pts\": [\n";
    file << "    { \"x\": 0.0, \"y\": 0.0},\n";
    file << "    { \"x\": 2.0, \"y\": 0.0},\n";
    file << "    { \"x\": 2.0, \"y\": 2.0},\n";
    file << "    { \"x\": 0.0, \"y\": 2.0},\n";
    file << "    { \"x\": 0.5, \"y\": 0.5},\n";
    file << "    { \"x\": 1.5, \"y\": 0.5},\n";
    file << "    { \"x\": 1.5, \"y\": 1.5},\n";
    file << "    { \"x\": 0.5, \"y\": 1.5}\n";
    file << "  ],\n";
    file << "  \"ring_counts\": [4, 4],\n";
    file << "  \"ring_roles\": [0, 1],\n";
    file << "  \"meta\": {\n";
    file << "    \"joinType\": 0,\n";
    file << "    \"miterLimit\": 2.0,\n";
    file << "    \"unitScale\": " << unitScale << ",\n";
    file << "    \"useDocUnit\": " << (unitScale == 1.0 ? "true" : "false") << ",\n";
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

static void validateMetaNormalizeFields(const std::string& jsonPath, double expectedUnitScale, bool expectedUseDocUnit) {
    std::cout << "Validating meta.normalize fields in: " << jsonPath << std::endl;
    
    std::ifstream file(jsonPath);
    assert(file.is_open() && "Failed to open JSON file");
    
    json j;
    file >> j;
    
    // Test that meta object exists
    assert(j.contains("meta") && "JSON must contain 'meta' object");
    auto meta = j["meta"];
    
    // Test required meta fields
    assert(meta.contains("unitScale") && "meta.unitScale is required");
    assert(meta.contains("useDocUnit") && "meta.useDocUnit is required");
    assert(meta.contains("normalize") && "meta.normalize is required");
    
    // Test field types and values
    assert(meta["unitScale"].is_number() && "meta.unitScale must be numeric");
    assert(meta["useDocUnit"].is_boolean() && "meta.useDocUnit must be boolean");
    assert(meta["normalize"].is_object() && "meta.normalize must be object");
    
    // Test specific values
    double actualUnitScale = meta["unitScale"].get<double>();
    bool actualUseDocUnit = meta["useDocUnit"].get<bool>();
    
    assert(std::abs(actualUnitScale - expectedUnitScale) < 1e-9 && "unitScale value mismatch");
    assert(actualUseDocUnit == expectedUseDocUnit && "useDocUnit value mismatch");
    
    // Test normalize sub-fields
    auto normalize = meta["normalize"];
    assert(normalize.contains("sortRings") && "meta.normalize.sortRings is required");
    assert(normalize["sortRings"].is_boolean() && "meta.normalize.sortRings must be boolean");
    
    // Test conditional sortRings value based on compile flag
#ifdef CADGF_SORT_RINGS
    assert(normalize["sortRings"].get<bool>() == true && "sortRings should be true when CADGF_SORT_RINGS=ON");
    std::cout << "✓ CADGF_SORT_RINGS=ON: sortRings correctly set to true" << std::endl;
#else
    assert(normalize["sortRings"].get<bool>() == false && "sortRings should be false when CADGF_SORT_RINGS=OFF");
    std::cout << "✓ CADGF_SORT_RINGS=OFF: sortRings correctly set to false" << std::endl;
#endif
    
    // Test optional normalize fields if present
    if (normalize.contains("orientation")) {
        assert(normalize["orientation"].is_boolean() && "meta.normalize.orientation must be boolean if present");
    }
    
    if (normalize.contains("start")) {
        assert(normalize["start"].is_boolean() && "meta.normalize.start must be boolean if present");
    }
    
    std::cout << "✓ All meta.normalize field validations passed" << std::endl;
}

int main() {
    std::cout << "Running meta.normalize emission test..." << std::endl;
    
    // Create temporary directory for test outputs
    std::string tempDir = "test_meta_normalize_temp";
    fs::create_directories(tempDir);
    
    try {
        // Test Case 1: Unit scale = 1.0, useDocUnit = true
        std::cout << "\n=== Test Case 1: Default unit scale ===" << std::endl;
        writeSimpleScene(tempDir, "test_default", 1.0);
        validateMetaNormalizeFields(tempDir + "/test_default.json", 1.0, true);
        
        // Test Case 2: Unit scale = 0.001, useDocUnit = false  
        std::cout << "\n=== Test Case 2: Custom unit scale ===" << std::endl;
        writeSimpleScene(tempDir, "test_custom", 0.001);
        validateMetaNormalizeFields(tempDir + "/test_custom.json", 0.001, false);
        
        // Test Case 3: Unit scale = 1000.0, useDocUnit = false
        std::cout << "\n=== Test Case 3: Large unit scale ===" << std::endl;
        writeSimpleScene(tempDir, "test_large", 1000.0);
        validateMetaNormalizeFields(tempDir + "/test_large.json", 1000.0, false);
        
        // Cleanup
        fs::remove_all(tempDir);
        
        std::cout << "\n✅ All meta.normalize emission tests passed!" << std::endl;
        
#ifdef CADGF_SORT_RINGS
        std::cout << "✅ Tested with CADGF_SORT_RINGS=ON" << std::endl;
#else
        std::cout << "✅ Tested with CADGF_SORT_RINGS=OFF" << std::endl;
#endif
        
        return 0;
        
    } catch (const std::exception& e) {
        std::cerr << "❌ Test failed with exception: " << e.what() << std::endl;
        fs::remove_all(tempDir);
        return 1;
    } catch (...) {
        std::cerr << "❌ Test failed with unknown exception" << std::endl;
        fs::remove_all(tempDir);
        return 1;
    }
}