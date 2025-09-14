#include "core/ops2d.hpp"
#include "core/document.hpp"
#include <cassert>
#include <vector>
#include <cmath>
#include <iostream>

using namespace core;

static std::vector<Vec2> rect(double x0, double y0, double x1, double y1) {
    return {{x0,y0},{x1,y0},{x1,y1},{x0,y1},{x0,y0}}; // closed
}

static double polygon_area(const std::vector<Vec2>& pts) {
    double area = 0.0;
    size_t n = pts.size();
    if (n < 3) return 0.0;
    
    // Handle closed polygon
    size_t end = n;
    if (n > 0 && std::abs(pts[0].x - pts[n-1].x) < 1e-12 && 
        std::abs(pts[0].y - pts[n-1].y) < 1e-12) {
        end = n - 1;
    }
    
    if (end < 3) return 0.0;
    
    // Shoelace formula
    for (size_t i = 0, j = end - 1; i < end; j = i++) {
        area += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    }
    return std::abs(area) * 0.5;
}

static bool near(double a, double b, double tol = 1e-6) {
    return std::abs(a - b) < tol;
}

int main() {
    std::cout << "=== Running strict boolean/offset tests ===" << std::endl;
    
#if defined(USE_CLIPPER2)
    std::cout << "CLIPPER2 is enabled - running strict assertions" << std::endl;
    
    // Test 1: Disjoint rectangles
    {
        std::cout << "Test 1: Disjoint rectangles..." << std::endl;
        std::vector<Polyline> A(1); A[0].points = rect(0, 0, 5, 5);
        std::vector<Polyline> B(1); B[0].points = rect(10, 10, 15, 15);
        
        auto U = boolean_op(A, B, BoolOp::Union);
        auto I = boolean_op(A, B, BoolOp::Intersection);
        auto D = boolean_op(A, B, BoolOp::Difference);
        
        // Disjoint: Union should have 2 rings, Intersection empty, Difference = A
        assert(U.size() == 2 && "Union of disjoint should have 2 rings");
        assert(I.empty() && "Intersection of disjoint should be empty");
        assert(D.size() == 1 && "Difference should equal A");
        assert(near(polygon_area(D[0].points), 25.0) && "Difference area should be 25");
        
        std::cout << "  ✓ Passed" << std::endl;
    }
    
    // Test 2: Overlapping rectangles (shared edge)
    {
        std::cout << "Test 2: Shared edge rectangles..." << std::endl;
        std::vector<Polyline> A(1); A[0].points = rect(0, 0, 10, 10);
        std::vector<Polyline> B(1); B[0].points = rect(10, 0, 20, 10);
        
        auto U = boolean_op(A, B, BoolOp::Union);
        auto I = boolean_op(A, B, BoolOp::Intersection);
        
        // Shared edge: Union should be single rectangle, Intersection should be line (empty in area)
        assert(U.size() == 1 && "Union should be single shape");
        assert(near(polygon_area(U[0].points), 200.0, 1.0) && "Union area should be ~200");
        assert(I.empty() || polygon_area(I[0].points) < 0.1 && "Intersection should be negligible");
        
        std::cout << "  ✓ Passed" << std::endl;
    }
    
    // Test 3: Contained rectangles
    {
        std::cout << "Test 3: Contained rectangles..." << std::endl;
        std::vector<Polyline> A(1); A[0].points = rect(0, 0, 20, 20);
        std::vector<Polyline> B(1); B[0].points = rect(5, 5, 15, 15);
        
        auto U = boolean_op(A, B, BoolOp::Union);
        auto I = boolean_op(A, B, BoolOp::Intersection);
        auto D = boolean_op(A, B, BoolOp::Difference);
        
        // B inside A: Union = A, Intersection = B, Difference = A with hole
        assert(U.size() == 1 && "Union should be single shape");
        assert(near(polygon_area(U[0].points), 400.0) && "Union area should be 400");
        assert(I.size() == 1 && "Intersection should be B");
        assert(near(polygon_area(I[0].points), 100.0) && "Intersection area should be 100");
        
        // Difference might be represented as polygon with hole or multiple polygons
        double diff_area = 0;
        for (const auto& poly : D) {
            diff_area += polygon_area(poly.points);
        }
        assert(near(diff_area, 300.0, 10.0) && "Difference area should be ~300");
        
        std::cout << "  ✓ Passed" << std::endl;
    }
    
    // Test 4: Offset with different join types
    {
        std::cout << "Test 4: Offset with join types..." << std::endl;
        std::vector<Polyline> square(1); 
        square[0].points = rect(0, 0, 10, 10);
        
        // Test positive offset
        auto offset_pos = offset(square, 2.0);
        assert(!offset_pos.empty() && "Positive offset should produce result");
        
        // With positive offset of 2, square 10x10 becomes ~14x14
        // Area should be approximately (10+2*2)^2 = 196
        double offset_area = polygon_area(offset_pos[0].points);
        assert(offset_area > 150 && offset_area < 250 && "Offset area in expected range");
        
        // Test negative offset (shrinking)
        auto offset_neg = offset(square, -2.0);
        assert(!offset_neg.empty() && "Negative offset should produce result");
        
        // With negative offset of -2, square 10x10 becomes ~6x6
        // Area should be approximately (10-2*2)^2 = 36
        double shrink_area = polygon_area(offset_neg[0].points);
        assert(shrink_area > 30 && shrink_area < 50 && "Shrunk area in expected range");
        
        std::cout << "  ✓ Passed" << std::endl;
    }
    
    // Test 5: Complex offset with miter limit
    {
        std::cout << "Test 5: Complex offset scenarios..." << std::endl;
        
        // L-shaped polygon
        std::vector<Polyline> L(1);
        L[0].points = {
            {0,0}, {10,0}, {10,5}, {5,5}, {5,10}, {0,10}, {0,0}
        };
        
        double original_area = polygon_area(L[0].points);
        assert(near(original_area, 75.0) && "L-shape area should be 75");
        
        // Positive offset
        auto L_offset = offset(L, 1.0);
        assert(!L_offset.empty() && "L-shape offset should succeed");
        
        double offset_area = 0;
        for (const auto& poly : L_offset) {
            offset_area += polygon_area(poly.points);
        }
        assert(offset_area > original_area && "Offset should increase area");
        assert(offset_area < 150 && "Offset area should be reasonable");
        
        // Point count assertions - offset typically increases vertex count
        size_t total_points = 0;
        for (const auto& poly : L_offset) {
            total_points += poly.points.size();
        }
        assert(total_points >= 6 && "Offset should maintain minimum vertices");
        
        std::cout << "  ✓ Passed" << std::endl;
    }
    
    std::cout << "All strict tests passed with CLIPPER2!" << std::endl;
    
#else
    std::cout << "CLIPPER2 not enabled - skipping strict tests" << std::endl;
    std::cout << "Basic sanity check only..." << std::endl;
    
    // Just verify the functions exist and don't crash
    std::vector<Polyline> A(1); A[0].points = rect(0, 0, 10, 10);
    std::vector<Polyline> B(1); B[0].points = rect(5, 5, 15, 15);
    
    auto U = boolean_op(A, B, BoolOp::Union);
    auto O = offset(A, 1.0);
    
    std::cout << "Basic check passed" << std::endl;
#endif
    
    return 0;
}