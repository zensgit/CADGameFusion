#include <cassert>
#include <iostream>
#include <vector>
#include "../../core/include/core/solver.hpp"

int main() {
    core::ISolver* s = core::createMinimalSolver();
    s->setMaxIterations(10);
    s->setTolerance(1e-6);

    // Since this is a no-op stub, we only check API stability and return code.
    std::vector<core::ConstraintSpec> cs;
    core::SolveResult r = s->solve(cs);
    assert(r.ok && "Empty constraint set should be trivially OK in stub");

    // Test bindings path with a simple horizontal constraint between y0 and y1
    double y0 = 1.0, y1 = 1.0; // already satisfied
    core::ConstraintSpec hc; hc.type = "horizontal";
    hc.vars = { core::VarRef{"p0","y"}, core::VarRef{"p1","y"} };
    std::vector<core::ConstraintSpec> v{hc};
    auto get = [&](const core::VarRef& v, bool& ok)->double {
        ok = true; if (v.key == "y") return (v.id == "p0" ? y0 : y1); ok=false; return 0.0; };
    auto set = [&](const core::VarRef& v, double val){ if (v.key == "y") { if (v.id=="p0") y0=val; else y1=val; } };
    core::SolveResult rb = s->solveWithBindings(v, get, set);
    assert(rb.ok && "Horizontal residual should be zero when y1==y0");
    std::cout << "Solver PoC stub ran: iterations=" << r.iterations << ", err=" << r.finalError << "\n";
    delete s;
    return 0;
}
