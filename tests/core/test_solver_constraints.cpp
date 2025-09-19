#include <cassert>
#include <cmath>
#include <iostream>
#include <vector>

#include "../../core/include/core/solver.hpp"

static double norm2(double a, double b){ return std::sqrt(a*a + b*b); }

int main(){
    using namespace core;
    ISolver* s = createMinimalSolver();
    s->setMaxIterations(50);
    s->setTolerance(1e-6);

    // Variables: two points p0(x0,y0), p1(x1,y1)
    double x0=0.0, y0=0.0, x1=1.0, y1=0.5;

    auto get = [&](const VarRef& v, bool& ok)->double{
        ok = true;
        if (v.id=="p0" && v.key=="x") return x0;
        if (v.id=="p0" && v.key=="y") return y0;
        if (v.id=="p1" && v.key=="x") return x1;
        if (v.id=="p1" && v.key=="y") return y1;
        ok = false; return 0.0;
    };
    auto set = [&](const VarRef& v, double val){
        if (v.id=="p0" && v.key=="x") x0=val;
        if (v.id=="p0" && v.key=="y") y0=val;
        if (v.id=="p1" && v.key=="x") x1=val;
        if (v.id=="p1" && v.key=="y") y1=val;
    };

    // 1) Horizontal: y1 == y0
    ConstraintSpec hc; hc.type = "horizontal"; hc.vars = { VarRef{"p0","y"}, VarRef{"p1","y"} };
    std::vector<ConstraintSpec> cs1{hc};
    auto r1 = s->solveWithBindings(cs1, get, set);
    assert(r1.ok);
    assert(std::abs(y1 - y0) < 1e-4);

    // 2) Vertical: x1 == x0
    x0=0.0; x1=1.0; // reset X
    ConstraintSpec vc; vc.type = "vertical"; vc.vars = { VarRef{"p0","x"}, VarRef{"p1","x"} };
    std::vector<ConstraintSpec> cs2{vc};
    auto r2 = s->solveWithBindings(cs2, get, set);
    assert(r2.ok);
    assert(std::abs(x1 - x0) < 1e-4);

    // 3) Distance: |p1 - p0| = 2.0
    x0=0.0; y0=0.0; x1=1.0; y1=0.0;
    ConstraintSpec dc; dc.type = "distance"; dc.value = 2.0;
    dc.vars = { VarRef{"p0","x"}, VarRef{"p0","y"}, VarRef{"p1","x"}, VarRef{"p1","y"} };
    std::vector<ConstraintSpec> cs3{dc};
    auto r3 = s->solveWithBindings(cs3, get, set);
    assert(r3.ok);
    assert(std::abs(norm2(x1-x0,y1-y0) - 2.0) < 1e-3);

    // 4) Parallel: (p0->p1) || (q0->q1)
    double q0x=0.0, q0y=0.0, q1x=1.0, q1y=0.0; // reference horizontal
    auto get2 = [&](const VarRef& v, bool& ok)->double{
        if (v.id=="q0" && v.key=="x") { ok=true; return q0x; }
        if (v.id=="q0" && v.key=="y") { ok=true; return q0y; }
        if (v.id=="q1" && v.key=="x") { ok=true; return q1x; }
        if (v.id=="q1" && v.key=="y") { ok=true; return q1y; }
        return get(v, ok);
    };
    x0=0.0; y0=0.0; x1=1.0; y1=0.5; // not parallel initially
    ConstraintSpec pc; pc.type = "parallel";
    pc.vars = { VarRef{"p0","x"}, VarRef{"p0","y"}, VarRef{"p1","x"}, VarRef{"p1","y"},
                VarRef{"q0","x"}, VarRef{"q0","y"}, VarRef{"q1","x"}, VarRef{"q1","y"} };
    std::vector<ConstraintSpec> cs4{pc};
    auto r4 = s->solveWithBindings(cs4, get2, set);
    assert(r4.ok);
    // y slope should be near 0 (becoming parallel to horizontal reference)
    assert(std::abs(y1 - y0) < 1e-3);

    // 5) Perpendicular: (p0->p1) ⟂ (q0->q1)
    q0x=0.0; q0y=0.0; q1x=0.0; q1y=1.0; // vertical reference
    x0=0.0; y0=0.0; x1=1.0; y1=0.2; // roughly horizontal
    ConstraintSpec kc; kc.type = "perpendicular";
    kc.vars = { VarRef{"p0","x"}, VarRef{"p0","y"}, VarRef{"p1","x"}, VarRef{"p1","y"},
                VarRef{"q0","x"}, VarRef{"q0","y"}, VarRef{"q1","x"}, VarRef{"q1","y"} };
    std::vector<ConstraintSpec> cs5{kc};
    auto r5 = s->solveWithBindings(cs5, get2, set);
    assert(r5.ok);
    // nearest to perpendicular: dot ~ 0 → check angle close to 90 deg
    double v1x = x1-x0, v1y = y1-y0; double v2x = q1x-q0x, v2y = q1y-q0y;
    double dot = v1x*v2x + v1y*v2y; double n1 = norm2(v1x,v1y), n2 = norm2(v2x,v2y);
    if (n1>1e-9 && n2>1e-9) {
        double cosang = dot/(n1*n2);
        assert(std::abs(cosang) < 5e-2);
    }

    // 6) Equal: enforce y0 == y1
    y0=0.3; y1=0.0;
    ConstraintSpec ec; ec.type = "equal"; ec.vars = { VarRef{"p0","y"}, VarRef{"p1","y"} };
    std::vector<ConstraintSpec> cs6{ec};
    auto r6 = s->solveWithBindings(cs6, get, set);
    assert(r6.ok);
    assert(std::abs(y1 - y0) < 1e-3);

    std::cout << "Solver constraints tests passed\n";
    delete s; return 0;
}
