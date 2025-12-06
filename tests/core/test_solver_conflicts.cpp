#include <cassert>
#include <iostream>
#include <cmath>
#include <map>
#include <string>
#include "../../core/include/core/solver.hpp"

// Test cases for conflicting or inconsistent constraints
// These should fail or report high residual errors

int main() {
    std::cout << "=== Solver Conflict/Inconsistency Tests ===\n";

    core::ISolver* solver = core::createMinimalSolver();
    solver->setMaxIterations(100);
    solver->setTolerance(1e-6);

    // Test 1: Conflicting horizontal constraints
    // Cannot have same points at different y-coordinates
    {
        std::cout << "\nTest 1: Conflicting horizontal constraints\n";
        std::vector<core::ConstraintSpec> conflicts;

        // p1.y = p2.y (horizontal)
        conflicts.push_back({
            "horizontal",
            {{"p1", "y"}, {"p2", "y"}},
            std::nullopt
        });

        // p1.y = p3.y (horizontal) - but if p2.y != p3.y, this conflicts
        conflicts.push_back({
            "horizontal",
            {{"p1", "y"}, {"p3", "y"}},
            std::nullopt
        });

        // Create conflicting bindings
        std::map<std::string, double> vars = {
            {"p1.y", 0.0},
            {"p2.y", 0.0},
            {"p3.y", 5.0}   // Conflict: p1.y = p2.y = 0, but p1.y = p3.y = 5
        };

        auto getter = [&](const core::VarRef& ref, bool& ok) -> double {
            std::string key = ref.id + "." + ref.key;
            auto it = vars.find(key);
            ok = (it != vars.end());
            return ok ? it->second : 0.0;
        };

        auto setter = [&](const core::VarRef& ref, double val) {
            std::string key = ref.id + "." + ref.key;
            vars[key] = val;
        };

        core::SolveResult result = solver->solveWithBindings(conflicts, getter, setter);

        std::cout << "  Result: " << (result.ok ? "CONVERGED" : "FAILED") << "\n";
        std::cout << "  Final error: " << result.finalError << "\n";
        std::cout << "  Expected: High residual due to conflicting constraints\n";

        // In a stub solver, this will likely show high error
        assert(!result.ok || result.finalError > 1.0);
    }

    // Test 2: Inconsistent distance constraints
    // Triangle inequality violation
    {
        std::cout << "\nTest 2: Inconsistent distance constraints (triangle inequality)\n";
        std::vector<core::ConstraintSpec> inconsistent;

        // Distance p1-p2 = 3
        inconsistent.push_back({
            "distance",
            {{"p1", "x"}, {"p1", "y"}, {"p2", "x"}, {"p2", "y"}},
            3.0
        });

        // Distance p2-p3 = 4
        inconsistent.push_back({
            "distance",
            {{"p2", "x"}, {"p2", "y"}, {"p3", "x"}, {"p3", "y"}},
            4.0
        });

        // Distance p1-p3 = 10 (violates triangle inequality: 3 + 4 < 10)
        inconsistent.push_back({
            "distance",
            {{"p1", "x"}, {"p1", "y"}, {"p3", "x"}, {"p3", "y"}},
            10.0
        });

        // Set up initial positions that violate constraints
        std::map<std::string, double> vars = {
            {"p1.x", 0.0}, {"p1.y", 0.0},
            {"p2.x", 3.0}, {"p2.y", 0.0},
            {"p3.x", 7.0}, {"p3.y", 0.0}   // p1-p3 distance is 7, not 10
        };

        auto getter = [&](const core::VarRef& ref, bool& ok) -> double {
            std::string key = ref.id + "." + ref.key;
            auto it = vars.find(key);
            ok = (it != vars.end());
            return ok ? it->second : 0.0;
        };

        auto setter = [&](const core::VarRef& ref, double val) {
            std::string key = ref.id + "." + ref.key;
            vars[key] = val;
        };

        core::SolveResult result = solver->solveWithBindings(inconsistent, getter, setter);

        std::cout << "  Result: " << (result.ok ? "CONVERGED" : "FAILED") << "\n";
        std::cout << "  Final error: " << result.finalError << "\n";
        std::cout << "  Expected: Cannot satisfy all distance constraints simultaneously\n";

        // Check actual distances after solve attempt
        double d13 = std::sqrt(
            std::pow(vars["p3.x"] - vars["p1.x"], 2) +
            std::pow(vars["p3.y"] - vars["p1.y"], 2)
        );
        std::cout << "  Actual p1-p3 distance: " << d13 << " (target was 10.0)\n";

        // Stub solver won't modify positions, so error should be high
        assert(!result.ok || result.finalError > 0.1);
    }

    // Test 3: Overdetermined system
    // Too many constraints for degrees of freedom
    {
        std::cout << "\nTest 3: Overdetermined system\n";
        std::vector<core::ConstraintSpec> overdetermined;

        // Fix p1 and p2 horizontally
        overdetermined.push_back({
            "horizontal",
            {{"p1", "y"}, {"p2", "y"}},
            std::nullopt
        });

        // Fix p1 and p2 vertically (overdetermined if they're not at same position)
        overdetermined.push_back({
            "vertical",
            {{"p1", "x"}, {"p2", "x"}},
            std::nullopt
        });

        // Also set a specific distance (likely incompatible)
        overdetermined.push_back({
            "distance",
            {{"p1", "x"}, {"p1", "y"}, {"p2", "x"}, {"p2", "y"}},
            5.0
        });

        std::map<std::string, double> vars = {
            {"p1.x", 0.0}, {"p1.y", 0.0},
            {"p2.x", 3.0}, {"p2.y", 4.0}  // Distance is 5, but not aligned
        };

        auto getter = [&](const core::VarRef& ref, bool& ok) -> double {
            std::string key = ref.id + "." + ref.key;
            auto it = vars.find(key);
            ok = (it != vars.end());
            return ok ? it->second : 0.0;
        };

        auto setter = [&](const core::VarRef& ref, double val) {
            std::string key = ref.id + "." + ref.key;
            vars[key] = val;
        };

        core::SolveResult result = solver->solveWithBindings(overdetermined, getter, setter);

        std::cout << "  Result: " << (result.ok ? "CONVERGED" : "FAILED") << "\n";
        std::cout << "  Final error: " << result.finalError << "\n";
        std::cout << "  Expected: High residual due to overdetermined constraints\n";

        // Should have significant residual
        assert(!result.ok || result.finalError > 0.01);
    }

    delete solver;

    std::cout << "\n=== All conflict/inconsistency tests completed ===\n";
    std::cout << "Note: These tests verify that conflicting constraints are properly detected.\n";
    std::cout << "High residuals or failures are expected and correct behavior.\n";

    return 0;
}