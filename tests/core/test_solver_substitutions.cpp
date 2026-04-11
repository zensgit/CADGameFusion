#include <cassert>
#include <cmath>
#include <iostream>
#include <string>
#include <unordered_map>
#include <vector>

#include "../../core/include/core/solver.hpp"

using namespace core;

static std::string key_for(const VarRef& var) {
    return var.id + "." + var.key;
}

static SolveResult run_minimal(std::unordered_map<std::string, double>& vars,
                               const std::vector<ConstraintSpec>& specs) {
    ISolver* solver = createMinimalSolver();
    solver->setMaxIterations(80);
    solver->setTolerance(1e-6);

    auto get = [&](const VarRef& var, bool& ok) -> double {
        const auto it = vars.find(key_for(var));
        if (it == vars.end()) {
            ok = false;
            return 0.0;
        }
        ok = true;
        return it->second;
    };
    auto set = [&](const VarRef& var, double value) {
        vars[key_for(var)] = value;
    };

    std::vector<ConstraintSpec> constraints = specs;
    SolveResult result = solver->solveWithBindings(constraints, get, set);
    delete solver;
    return result;
}

int main() {
    {
        std::unordered_map<std::string, double> vars{
            {"a.x", 1.0},
            {"b.x", 2.0},
            {"c.x", 3.0},
        };
        const std::vector<ConstraintSpec> constraints{
            ConstraintSpec{"equal", {VarRef{"a", "x"}, VarRef{"b", "x"}}, std::nullopt},
            ConstraintSpec{"equal", {VarRef{"b", "x"}, VarRef{"c", "x"}}, std::nullopt},
        };
        const SolveResult result = run_minimal(vars, constraints);
        assert(result.ok);
        assert(std::abs(vars["a.x"] - vars["b.x"]) < 1e-9);
        assert(std::abs(vars["a.x"] - vars["c.x"]) < 1e-9);
    }

    {
        std::unordered_map<std::string, double> vars{
            {"p0.x", 0.0}, {"p0.y", 0.0},
            {"p1.x", 1.0}, {"p1.y", 2.0},
        };
        const std::vector<ConstraintSpec> constraints{
            ConstraintSpec{"coincident",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"},
                            VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           std::nullopt},
        };
        const SolveResult result = run_minimal(vars, constraints);
        assert(result.ok);
        assert(std::abs(vars["p0.x"] - vars["p1.x"]) < 1e-9);
        assert(std::abs(vars["p0.y"] - vars["p1.y"]) < 1e-9);
    }

    {
        std::unordered_map<std::string, double> vars{
            {"c0.x", 1.0}, {"c0.y", 2.0},
            {"c1.x", 4.0}, {"c1.y", 5.0},
        };
        const std::vector<ConstraintSpec> constraints{
            ConstraintSpec{"concentric",
                           {VarRef{"c0", "x"}, VarRef{"c0", "y"},
                            VarRef{"c1", "x"}, VarRef{"c1", "y"}},
                           std::nullopt},
        };
        const SolveResult result = run_minimal(vars, constraints);
        assert(result.ok);
        assert(std::abs(vars["c0.x"] - vars["c1.x"]) < 1e-9);
        assert(std::abs(vars["c0.y"] - vars["c1.y"]) < 1e-9);
    }

    std::cout << "Solver substitution tests passed\n";
    return 0;
}
