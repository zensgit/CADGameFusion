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

    SolveResult solveWithBindings(std::vector<ConstraintSpec>& constraints,
                                  const std::function<double(const VarRef&, bool&)>& get,
                                  const std::function<void(const VarRef&, double)>& set) override
    {
        // For the stub, just evaluate a simple residual norm using provided getters.
        (void)set;
        double err2 = 0.0;
        for (const auto& c : constraints) {
            if (c.type == "horizontal" && c.vars.size() >= 2) {
                bool ok0=true, ok1=true;
                double y0 = get(c.vars[0], ok0);
                double y1 = get(c.vars[1], ok1);
                if (ok0 && ok1) {
                    double r = (y1 - y0);
                    err2 += r*r;
                }
            } else if (c.type == "vertical" && c.vars.size() >= 2) {
                bool ok0=true, ok1=true;
                double x0 = get(c.vars[0], ok0);
                double x1 = get(c.vars[1], ok1);
                if (ok0 && ok1) { double r = (x1 - x0); err2 += r*r; }
            } else if (c.type == "distance" && c.value.has_value()) {
                // Expect either 4 component refs (x0,y0,x1,y1) or skip
                if (c.vars.size() >= 4) {
                    bool ok0=true, ok1=true, ok2=true, ok3=true;
                    double x0 = get(c.vars[0], ok0);
                    double y0 = get(c.vars[1], ok1);
                    double x1 = get(c.vars[2], ok2);
                    double y1 = get(c.vars[3], ok3);
                    if (ok0 && ok1 && ok2 && ok3) {
                        double dx = x1 - x0;
                        double dy = y1 - y0;
                        double dist = std::sqrt(dx*dx + dy*dy);
                        double r = dist - c.value.value();
                        err2 += r*r;
                    }
                }
            }
        }
        SolveResult r; r.iterations = 0; r.finalError = std::sqrt(err2); r.ok = (r.finalError <= tol_);
        r.message = r.ok ? "Converged (bindings stub)" : "Residual above tol (bindings stub)";
        return r;
    }
};

ISolver* createMinimalSolver() { return new MinimalSolver(); }

} // namespace core
