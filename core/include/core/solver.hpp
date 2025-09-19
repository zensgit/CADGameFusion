#pragma once
#include <string>
#include <vector>
#include <optional>
#include <functional>

namespace core {

struct VarRef { std::string id; std::string key; }; // e.g., entity id + param key

struct ConstraintSpec {
    std::string type;                 // "horizontal", "distance", ...
    std::vector<VarRef> vars;         // referenced variables (entity param bindings)
    std::optional<double> value;      // numeric value if needed
};

struct SolveResult {
    bool ok{false};
    int iterations{0};
    double finalError{0.0};
    std::string message;
};

class ISolver {
public:
    virtual ~ISolver() = default;
    virtual void setMaxIterations(int iters) = 0;
    virtual void setTolerance(double tol) = 0;
    virtual SolveResult solve(std::vector<ConstraintSpec>& constraints) = 0;

    using GetVar = double(*)(const VarRef&, bool&);
    using SetVar = void(*)(const VarRef&, double);

    virtual SolveResult solveWithBindings(std::vector<ConstraintSpec>& constraints,
                                          const std::function<double(const VarRef&, bool&)>& get,
                                          const std::function<void(const VarRef&, double)>& set)
    {
        // Default fallback: call basic solve; derived solvers may override to use bindings.
        (void)get; (void)set;
        return solve(constraints);
    }
};

// Factory function for a minimal Gauss-Newton style solver
ISolver* createMinimalSolver();

} // namespace core
