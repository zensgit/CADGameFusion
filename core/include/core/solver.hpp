#pragma once
#include <string>
#include <vector>
#include <optional>

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
};

// Factory function for a minimal Gauss-Newton style solver
ISolver* createMinimalSolver();

} // namespace core

