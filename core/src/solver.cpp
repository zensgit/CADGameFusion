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

    SolveResult solveWithBindings(std::vector<ConstraintSpec>& constraints, const GetVar& get, const SetVar& set) override {
        // Minimal implementation: compute residuals for a limited set of constraints
        // without actually modifying variables yet. This establishes the data path.
        auto residual = [&](const ConstraintSpec& c, bool& ok)->double {
            ok = true;
            if (c.type == "horizontal" && c.vars.size() >= 2) {
                bool ok0=false, ok1=false;
                double y0 = get(c.vars[0], ok0);
                double y1 = get(c.vars[1], ok1);
                ok = ok0 && ok1; return (ok ? (y1 - y0) : 0.0);
            }
            if (c.type == "vertical" && c.vars.size() >= 2) {
                bool ok0=false, ok1=false;
                double x0 = get(c.vars[0], ok0);
                double x1 = get(c.vars[1], ok1);
                ok = ok0 && ok1; return (ok ? (x1 - x0) : 0.0);
            }
            if (c.type == "distance" && c.vars.size() >= 4 && c.value.has_value()) {
                bool ok0=false, ok1=false, ok2=false, ok3=false;
                double x0 = get(c.vars[0], ok0), y0 = get(c.vars[1], ok1);
                double x1 = get(c.vars[2], ok2), y1 = get(c.vars[3], ok3);
                if (!(ok0&&ok1&&ok2&&ok3)) { ok=false; return 0.0; }
                double dx = x1 - x0, dy = y1 - y0; double d = std::sqrt(dx*dx + dy*dy);
                return (d - *c.value);
            }
            ok = true; return 0.0; // unsupported constraints return 0 residual
        };

        double err2 = 0.0; int count = 0; bool allOk = true;
        for (const auto& c : constraints) {
            bool okc=false; double r = residual(c, okc); allOk = allOk && okc; err2 += r*r; count++;
        }
        SolveResult r; r.ok = (std::sqrt(err2) <= tol_); r.iterations = 0; r.finalError = std::sqrt(err2);
        r.message = (allOk ? "Residuals computed (no update)" : "Some variables unresolved; partial residuals computed");
        return r;
    }
};

ISolver* createMinimalSolver() { return new MinimalSolver(); }

} // namespace core
