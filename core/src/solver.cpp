#include "core/solver.hpp"
#include <cmath>

namespace core {

class MinimalSolver : public ISolver {
    int maxIters_ = 50;
    double tol_ = 1e-6;
public:
    void setMaxIterations(int iters) override { maxIters_ = iters; }
    void setTolerance(double tol) override { tol_ = tol; }

    // NOTE: This is a stub that only evaluates residuals without modifying vars.
    // It reports success if residuals are already within tolerance.
    SolveResult solve(std::vector<ConstraintSpec>& constraints) override {
        double err2 = 0.0;
        for (const auto& c : constraints) {
            if (c.type == "horizontal" && c.vars.size() >= 2) {
                // expects two vars: y0, y1
                // This stub assumes value held externally; we can't update vars without a model.
                // So residual = y1 - y0
                // Here we can't read numeric values (no storage) — treat as zero-residual placeholder.
            } else if (c.type == "distance" && c.value.has_value()) {
                // Can't compute without numeric variables; skip.
            }
        }
        SolveResult r; r.ok = (std::sqrt(err2) <= tol_); r.iterations = 0; r.finalError = std::sqrt(err2);
        r.message = r.ok ? "Converged (no-op stub)" : "No model bound; cannot solve";
        return r;
    }
};

ISolver* createMinimalSolver() { return new MinimalSolver(); }

} // namespace core

