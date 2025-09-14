#include "core/ops2d.hpp"
#include <cassert>
#include <vector>
#include <cmath>

using namespace core;

static std::vector<Vec2> rect(double x0, double y0, double x1, double y1) {
    return {{x0,y0},{x1,y0},{x1,y1},{x0,y1},{x0,y0}}; // closed
}

int main() {
    // Boolean basics (if CLIPPER2 available, expect non-empty)
    {
        std::vector<Polyline> A{{0,core::EntityType::Polyline,"A",nullptr}}; A[0].points = rect(0,0,10,10);
        std::vector<Polyline> B{{0,core::EntityType::Polyline,"B",nullptr}}; B[0].points = rect(5,5,15,15);
        auto U = boolean_op(A,B,BoolOp::Union);
        auto I = boolean_op(A,B,BoolOp::Intersection);
        auto D = boolean_op(A,B,BoolOp::Difference);
        auto X = boolean_op(A,B,BoolOp::Xor);
#if defined(USE_CLIPPER2)
        auto area_sum = [](const std::vector<Polyline>& polys){
            auto area_ring = [](const Polyline& pl){
                double a=0.0; size_t n=pl.points.size(); if(n<3) return 0.0; size_t end=n;
                if (std::abs(pl.points.front().x - pl.points.back().x) < 1e-12 && std::abs(pl.points.front().y - pl.points.back().y) < 1e-12) end=n-1;
                if (end<3) return 0.0;
                for (size_t i=0,j=end-1;i<end;j=i++) a += pl.points[j].x*pl.points[i].y - pl.points[i].x*pl.points[j].y;
                return 0.5*std::abs(a);
            };
            double s=0.0; for (auto& p:polys) s+=area_ring(p); return s;
        };
        const double areaA=100.0, areaB=100.0, areaI=25.0;
        const double areaU=area_sum(U);
        const double areaInt=area_sum(I);
        const double areaDiff=area_sum(D);
        const double areaX=area_sum(X);
        auto near = [](double a,double b){ return std::abs(a-b) < 1e-6; };
        assert(near(areaInt, areaI));
        assert(areaU > std::max(areaA, areaB) && areaU < (areaA+areaB));
        assert(areaDiff > 0.0 && areaDiff < areaA);
        assert(near(areaX, areaA + areaB - 2*areaI));
#else
        // In absence of CLIPPER2 these may be empty; just ensure no crash
        (void)U; (void)I; (void)D; (void)X;
#endif
    }

    // Offset basics (if CLIPPER2 available)
    {
        std::vector<Polyline> A{{0,core::EntityType::Polyline,"A",nullptr}}; A[0].points = rect(0,0,10,10);
        auto O = offset(A, 1.0);
#if defined(USE_CLIPPER2)
        // Area after positive offset should be larger than original
        auto area_sum = [](const std::vector<Polyline>& polys){
            auto area_ring = [](const Polyline& pl){
                double a=0.0; size_t n=pl.points.size(); if(n<3) return 0.0; size_t end=n;
                if (std::abs(pl.points.front().x - pl.points.back().x) < 1e-12 && std::abs(pl.points.front().y - pl.points.back().y) < 1e-12) end=n-1;
                if (end<3) return 0.0;
                for (size_t i=0,j=end-1;i<end;j=i++) a += pl.points[j].x*pl.points[i].y - pl.points[i].x*pl.points[j].y;
                return 0.5*std::abs(a);
            };
            double s=0.0; for (auto& p:polys) s+=area_ring(p); return s;
        };
        assert(area_sum(O) > 100.0);
#else
        (void)O;
#endif
    }

    return 0;
}
