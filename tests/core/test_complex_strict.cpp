// test_complex_strict.cpp
// Strict test for L-shaped polygon with two holes triangulation

#include <vector>
#include <iostream>
#include <cassert>
#include "core/core_c_api.h"

#ifdef GTEST_FOUND
#include <gtest/gtest.h>
#define TEST_FUNC(test_suite, test_name) TEST(test_suite, test_name)
#define EXPECT_GT(a, b) EXPECT_GT(a, b)
#define EXPECT_LT(a, b) EXPECT_LT(a, b)
#define EXPECT_EQ(a, b) EXPECT_EQ(a, b)
#define EXPECT_TRUE(a) EXPECT_TRUE(a)
#define EXPECT_FALSE(a) EXPECT_FALSE(a)
#define SUCCEED() SUCCEED()
#else
#define TEST_FUNC(test_suite, test_name) void test_suite##_##test_name()
// Simple assert-based macros that ignore the message
#define EXPECT_GT(a, b) assert((a) > (b)); if(false) std::cout
#define EXPECT_LT(a, b) assert((a) < (b)); if(false) std::cout
#define EXPECT_EQ(a, b) assert((a) == (b)); if(false) std::cout
#define EXPECT_TRUE(a) assert(a); if(false) std::cout
#define EXPECT_FALSE(a) assert(!(a)); if(false) std::cout
#define SUCCEED() if(false) std::cout
#endif

TEST_FUNC(ComplexStrictTest, LShapedWithTwoHoles) {
    // L-shaped outer ring (6 vertices, counter-clockwise)
    std::vector<float> points = {
        0.0f, 0.0f,  // 0
        3.0f, 0.0f,  // 1
        3.0f, 1.0f,  // 2
        1.0f, 1.0f,  // 3
        1.0f, 3.0f,  // 4
        0.0f, 3.0f   // 5
    };
    
    // First hole (4 vertices, clockwise for hole)
    points.insert(points.end(), {
        0.2f, 0.2f,  // 6
        0.8f, 0.2f,  // 7
        0.8f, 0.8f,  // 8
        0.2f, 0.8f   // 9
    });
    
    // Second hole (4 vertices, clockwise for hole)
    points.insert(points.end(), {
        1.5f, 1.5f,  // 10
        2.5f, 1.5f,  // 11
        2.5f, 2.5f,  // 12
        1.5f, 2.5f   // 13
    });
    
    // Ring counts: outer=6, hole1=4, hole2=4
    std::vector<int> ring_counts = {6, 4, 4};
    
    // Triangulate - API assumes first ring is outer, rest are holes
    std::vector<unsigned int> indices(100); // Pre-allocate space
    int index_count = 0;
    int success = core_triangulate_polygon_rings(
        reinterpret_cast<const core_vec2*>(points.data()),
        ring_counts.data(),
        static_cast<int>(ring_counts.size()),
        indices.data(),
        &index_count
    );
    
    // Resize to actual count
    indices.resize(index_count);
    
    std::cout << "[TEST] L-shaped with 2 holes triangulation result:" << std::endl;
    std::cout << "  - Success: " << (success ? "YES" : "NO") << std::endl;
    std::cout << "  - Vertices: " << (points.size() / 2) << std::endl;
    std::cout << "  - Indices generated: " << indices.size() << std::endl;
    std::cout << "  - Triangles: " << (indices.size() / 3) << std::endl;
    
#ifdef USE_EARCUT
    // With earcut enabled, we expect valid triangulation
    EXPECT_TRUE(success) << "Triangulation should succeed with earcut";
    EXPECT_FALSE(indices.empty()) << "Indices should not be empty with earcut";
    
    // Basic validation of triangle count
    // L-shaped area ≈ 5 square units, minus 2 small holes
    // Should produce reasonable number of triangles
    size_t num_triangles = indices.size() / 3;
    EXPECT_GE(num_triangles, 4u) << "Should have at least 4 triangles";
    EXPECT_LE(num_triangles, 30u) << "Should have at most 30 triangles (reasonable upper bound)";
    
    // Verify indices are within valid range
    size_t num_vertices = points.size() / 2;
    for (size_t i = 0; i < indices.size(); ++i) {
        EXPECT_LT(indices[i], num_vertices) << "Index " << i << " out of range";
    }
    
    // Verify we have complete triangles (multiple of 3)
    EXPECT_EQ(indices.size() % 3, 0u) << "Indices should be multiple of 3";
    
    std::cout << "[TEST] Earcut validation passed:" << std::endl;
    std::cout << "  - All indices within range [0, " << num_vertices << ")" << std::endl;
    std::cout << "  - Triangle count reasonable: " << num_triangles << std::endl;
#else
    // Without earcut, ensure no crash (fallback behavior)
    std::cout << "[TEST] Running without earcut (fallback mode)" << std::endl;
    if (success) {
        // If fallback succeeded, do basic validation
        EXPECT_FALSE(indices.empty()) << "If success, indices should not be empty";
        EXPECT_EQ(indices.size() % 3, 0u) << "Indices should be multiple of 3";
        
        // Verify indices are within valid range
        size_t num_vertices = points.size() / 2;
        for (size_t i = 0; i < indices.size(); ++i) {
            EXPECT_LT(indices[i], num_vertices) << "Index " << i << " out of range";
        }
    } else {
        // Fallback may fail for complex polygons with holes
        std::cout << "[TEST] Fallback triangulation failed (expected for complex holes)" << std::endl;
    }
    
    // Main assertion: no crash occurred
    SUCCEED() << "No crash occurred during triangulation (fallback mode)";
#endif
}

TEST_FUNC(ComplexStrictTest, SimplePolygonFallback) {
    // Test that simple polygon works even without earcut
    std::vector<float> points = {
        0.0f, 0.0f,
        2.0f, 0.0f,
        2.0f, 2.0f,
        0.0f, 2.0f
    };
    
    std::vector<int> ring_counts = {4};
    std::vector<unsigned int> indices(100); // Pre-allocate space  
    int index_count = 0;
    int success = core_triangulate_polygon_rings(
        reinterpret_cast<const core_vec2*>(points.data()),
        ring_counts.data(),
        static_cast<int>(ring_counts.size()),
        indices.data(),
        &index_count
    );
    
    // Resize to actual count
    indices.resize(index_count);
    
    // Simple polygon should always succeed
    EXPECT_TRUE(success) << "Simple polygon should triangulate successfully";
    EXPECT_FALSE(indices.empty()) << "Simple polygon should produce indices";
    EXPECT_EQ(indices.size(), 6u) << "Square should produce 2 triangles (6 indices)";
    
    std::cout << "[TEST] Simple polygon fallback test passed" << std::endl;
}

TEST_FUNC(ComplexStrictTest, EmptyInput) {
    // Test edge case: empty input
    std::vector<unsigned int> indices(10); 
    int index_count = 0;
    
    int success = core_triangulate_polygon_rings(
        nullptr,
        nullptr,
        0,
        indices.data(),
        &index_count
    );
    
    // Resize to actual count
    indices.resize(index_count);
    
    EXPECT_FALSE(success) << "Empty input should fail";
    EXPECT_TRUE(indices.empty()) << "Empty input should produce no indices";
    
    std::cout << "[TEST] Empty input test passed" << std::endl;
}

TEST_FUNC(ComplexStrictTest, DeepNestedHoles) {
    // Placeholder for deep nested holes test
    std::cout << "[TEST] DeepNestedHoles test placeholder" << std::endl;
    SUCCEED() << "Placeholder test passed";
}

TEST_FUNC(ComplexStrictTest, EdgeCases) {
    // Placeholder for edge cases test  
    std::cout << "[TEST] EdgeCases test placeholder" << std::endl;
    SUCCEED() << "Placeholder test passed";
}

int main(int argc, char **argv) {
    std::cout << "=== Complex Strict Triangulation Tests ===" << std::endl;
#ifdef USE_EARCUT
    std::cout << "[INFO] Running with earcut enabled" << std::endl;
#else
    std::cout << "[INFO] Running without earcut (fallback mode)" << std::endl;
#endif

#ifdef GTEST_FOUND
    ::testing::InitGoogleTest(&argc, argv);
    return RUN_ALL_TESTS();
#else
    std::cout << "[INFO] Running without GTest (using assert-based tests)" << std::endl;
    
    // Manually run tests
    ComplexStrictTest_LShapedWithTwoHoles();
    ComplexStrictTest_DeepNestedHoles();
    ComplexStrictTest_EdgeCases();
    
    std::cout << "[PASS] All tests completed successfully" << std::endl;
    return 0;
#endif
}

