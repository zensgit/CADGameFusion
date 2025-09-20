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
    std::cout << "Solver PoC stub ran: iterations=" << r.iterations << ", err=" << r.finalError << "\n";
    delete s;
    return 0;
}

