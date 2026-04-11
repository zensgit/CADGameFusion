// Solver baseline harness (A0)
// Captures current solver behavior as a baseline: success/fail, residual, iteration count.
// Tests all 3 solver algorithms (LM, DogLeg, BFGS) across representative constraint scenarios.

#include <cassert>
#include <cmath>
#include <cstdlib>
#include <cstdio>
#include <functional>
#include <string>
#include <unordered_map>
#include <vector>

#include "../../core/include/core/solver.hpp"

using namespace core;

static std::string key_for(const VarRef& var) {
    return var.id + "." + var.key;
}

struct Scenario {
    const char* name;
    std::unordered_map<std::string, double> vars;
    std::vector<ConstraintSpec> constraints;
    bool expect_ok;
    double tol;
};

static std::vector<Scenario> build_scenarios() {
    std::vector<Scenario> scenarios;

    {
        Scenario s;
        s.name = "horizontal";
        s.vars = {{"p0.y", 0.0}, {"p1.y", 0.5}};
        ConstraintSpec c; c.type = "horizontal";
        c.vars = {VarRef{"p0","y"}, VarRef{"p1","y"}};
        s.constraints = {c};
        s.expect_ok = true;
        s.tol = 1e-4;
        scenarios.push_back(s);
    }

    {
        Scenario s;
        s.name = "vertical";
        s.vars = {{"p0.x", 0.0}, {"p1.x", 1.0}};
        ConstraintSpec c; c.type = "vertical";
        c.vars = {VarRef{"p0","x"}, VarRef{"p1","x"}};
        s.constraints = {c};
        s.expect_ok = true;
        s.tol = 1e-4;
        scenarios.push_back(s);
    }

    {
        Scenario s;
        s.name = "equal";
        s.vars = {{"p0.y", 0.3}, {"p1.y", 0.0}};
        ConstraintSpec c; c.type = "equal";
        c.vars = {VarRef{"p0","y"}, VarRef{"p1","y"}};
        s.constraints = {c};
        s.expect_ok = true;
        s.tol = 1e-4;
        scenarios.push_back(s);
    }

    {
        Scenario s;
        s.name = "distance";
        s.vars = {{"p0.x", 0.0}, {"p0.y", 0.0}, {"p1.x", 1.0}, {"p1.y", 0.0}};
        ConstraintSpec c; c.type = "distance"; c.value = 2.0;
        c.vars = {VarRef{"p0","x"}, VarRef{"p0","y"}, VarRef{"p1","x"}, VarRef{"p1","y"}};
        s.constraints = {c};
        s.expect_ok = true;
        s.tol = 5e-3;
        scenarios.push_back(s);
    }

    {
        Scenario s;
        s.name = "fixed_point";
        s.vars = {{"p0.x", 1.5}, {"p0.y", 0.0}};
        ConstraintSpec c; c.type = "fixed_point"; c.value = 3.0;
        c.vars = {VarRef{"p0","x"}, VarRef{"p0","y"}};
        s.constraints = {c};
        s.expect_ok = true;
        s.tol = 1e-4;
        scenarios.push_back(s);
    }

    {
        Scenario s;
        s.name = "coincident";
        s.vars = {{"p0.x", 0.0}, {"p0.y", 0.0}, {"p1.x", 1.0}, {"p1.y", 0.5}};
        ConstraintSpec cx; cx.type = "coincident";
        cx.vars = {VarRef{"p0","x"}, VarRef{"p0","y"}, VarRef{"p1","x"}, VarRef{"p1","y"}};
        s.constraints = {cx};
        s.expect_ok = true;
        s.tol = 1e-4;
        scenarios.push_back(s);
    }

    {
        Scenario s;
        s.name = "concentric";
        s.vars = {{"c0.x", 1.0}, {"c0.y", 2.0}, {"c1.x", 1.5}, {"c1.y", 2.3}};
        ConstraintSpec cx; cx.type = "concentric";
        cx.vars = {VarRef{"c0","x"}, VarRef{"c0","y"}, VarRef{"c1","x"}, VarRef{"c1","y"}};
        s.constraints = {cx};
        s.expect_ok = true;
        s.tol = 1e-4;
        scenarios.push_back(s);
    }

    {
        Scenario s;
        s.name = "midpoint";
        s.vars = {{"p.x", 0.6}, {"p.y", 0.4}, {"a.x", 0.0}, {"a.y", 0.0}, {"b.x", 1.0}, {"b.y", 1.0}};
        ConstraintSpec c; c.type = "midpoint";
        c.vars = {VarRef{"p","x"}, VarRef{"p","y"}, VarRef{"a","x"}, VarRef{"a","y"}, VarRef{"b","x"}, VarRef{"b","y"}};
        s.constraints = {c};
        s.expect_ok = true;
        s.tol = 1e-4;
        scenarios.push_back(s);
    }

    {
        Scenario s;
        s.name = "symmetric";
        s.vars = {{"p1.x", 1.0}, {"p1.y", 2.0}, {"p2.x", 3.0}, {"p2.y", 4.0},
                  {"c.x", 2.5}, {"c.y", 3.5}};
        ConstraintSpec c; c.type = "symmetric";
        c.vars = {VarRef{"p1","x"}, VarRef{"p1","y"}, VarRef{"p2","x"}, VarRef{"p2","y"},
                  VarRef{"c","x"}, VarRef{"c","y"}};
        s.constraints = {c};
        s.expect_ok = true;
        s.tol = 1e-4;
        scenarios.push_back(s);
    }

    {
        Scenario s;
        s.name = "parallel";
        s.vars = {{"p0.x", 0.0}, {"p0.y", 0.0}, {"p1.x", 1.0}, {"p1.y", 0.5},
                  {"q0.x", 0.0}, {"q0.y", 0.0}, {"q1.x", 1.0}, {"q1.y", 0.0}};
        ConstraintSpec c; c.type = "parallel";
        c.vars = {VarRef{"p0","x"}, VarRef{"p0","y"}, VarRef{"p1","x"}, VarRef{"p1","y"},
                  VarRef{"q0","x"}, VarRef{"q0","y"}, VarRef{"q1","x"}, VarRef{"q1","y"}};
        s.constraints = {c};
        s.expect_ok = true;
        s.tol = 5e-3;
        scenarios.push_back(s);
    }

    {
        Scenario s;
        s.name = "perpendicular";
        s.vars = {{"p0.x", 0.0}, {"p0.y", 0.0}, {"p1.x", 1.0}, {"p1.y", 0.2},
                  {"q0.x", 0.0}, {"q0.y", 0.0}, {"q1.x", 0.0}, {"q1.y", 1.0}};
        ConstraintSpec c; c.type = "perpendicular";
        c.vars = {VarRef{"p0","x"}, VarRef{"p0","y"}, VarRef{"p1","x"}, VarRef{"p1","y"},
                  VarRef{"q0","x"}, VarRef{"q0","y"}, VarRef{"q1","x"}, VarRef{"q1","y"}};
        s.constraints = {c};
        s.expect_ok = true;
        s.tol = 5e-2;
        scenarios.push_back(s);
    }

    {
        Scenario s;
        s.name = "horizontal+distance";
        s.vars = {{"p0.x", 0.0}, {"p0.y", 0.0}, {"p1.x", 1.0}, {"p1.y", 0.5}};
        ConstraintSpec h; h.type = "horizontal";
        h.vars = {VarRef{"p0","y"}, VarRef{"p1","y"}};
        ConstraintSpec d; d.type = "distance"; d.value = 3.0;
        d.vars = {VarRef{"p0","x"}, VarRef{"p0","y"}, VarRef{"p1","x"}, VarRef{"p1","y"}};
        s.constraints = {h, d};
        s.expect_ok = true;
        s.tol = 1e-3;
        scenarios.push_back(s);
    }

    {
        Scenario s;
        s.name = "angle_45deg";
        s.vars = {{"p0.x", 0.0}, {"p0.y", 0.0}, {"p1.x", 1.0}, {"p1.y", 0.2},
                  {"q0.x", 0.0}, {"q0.y", 0.0}, {"q1.x", 1.0}, {"q1.y", 0.0}};
        ConstraintSpec c; c.type = "angle";
        c.value = 3.14159265358979323846 / 4.0;
        c.vars = {VarRef{"p0","x"}, VarRef{"p0","y"}, VarRef{"p1","x"}, VarRef{"p1","y"},
                  VarRef{"q0","x"}, VarRef{"q0","y"}, VarRef{"q1","x"}, VarRef{"q1","y"}};
        s.constraints = {c};
        s.expect_ok = true;
        s.tol = 5e-2;
        scenarios.push_back(s);
    }

    return scenarios;
}

struct RunResult {
    const char* scenario_name;
    const char* algorithm_name;
    bool ok;
    bool expected_ok;
    int iterations;
    double finalError;
};

static RunResult run_scenario(Scenario& scenario, SolverAlgorithm algo, const char* algo_name) {
    ISolver* solver = createSolver(algo);
    solver->setMaxIterations(80);
    solver->setTolerance(1e-6);

    auto vars = scenario.vars;

    auto get = [&](const VarRef& var, bool& ok) -> double {
        const auto it = vars.find(key_for(var));
        if (it == vars.end()) { ok = false; return 0.0; }
        ok = true;
        return it->second;
    };
    auto set = [&](const VarRef& var, double value) {
        vars[key_for(var)] = value;
    };

    std::vector<ConstraintSpec> cs = scenario.constraints;
    SolveResult result = solver->solveWithBindings(cs, get, set);
    delete solver;

    RunResult rr;
    rr.scenario_name = scenario.name;
    rr.algorithm_name = algo_name;
    rr.ok = result.ok;
    rr.expected_ok = scenario.expect_ok;
    rr.iterations = result.iterations;
    rr.finalError = result.finalError;
    return rr;
}

int main() {
    auto scenarios = build_scenarios();

    struct AlgoEntry {
        SolverAlgorithm algo;
        const char* name;
    };
    AlgoEntry algos[] = {
        {SolverAlgorithm::LM, "LM"},
        {SolverAlgorithm::DogLeg, "DogLeg"},
        {SolverAlgorithm::BFGS, "BFGS"},
    };

    std::vector<RunResult> results;
    for (auto& scenario : scenarios) {
        for (const auto& ae : algos) {
            results.push_back(run_scenario(scenario, ae.algo, ae.name));
        }
    }

    std::printf("\n%-25s %-8s %-6s %-6s %6s %12s\n",
                "Scenario", "Algo", "OK", "Expect", "Iters", "FinalErr");
    std::printf("%-25s %-8s %-6s %-6s %6s %12s\n",
                "-------------------------", "--------", "------", "------", "------", "------------");

    int pass = 0, fail = 0;
    for (const auto& r : results) {
        std::printf("%-25s %-8s %-6s %-6s %6d %12.2e\n",
                    r.scenario_name, r.algorithm_name,
                    r.ok ? "PASS" : "FAIL",
                    r.expected_ok ? "true" : "false",
                    r.iterations, r.finalError);
        if (r.ok == r.expected_ok) {
            ++pass;
        } else {
            ++fail;
        }
    }

    std::printf("\n=== Baseline Summary: %d passed, %d unexpected ===\n\n", pass, fail);

    if (const char* json_path = std::getenv("CADGF_SOLVER_BASELINE_JSON")) {
        if (std::FILE* fp = std::fopen(json_path, "w")) {
            std::fprintf(fp, "{\n");
            std::fprintf(fp, "  \"summary\": {\"passed\": %d, \"unexpected\": %d},\n", pass, fail);
            std::fprintf(fp, "  \"results\": [\n");
            for (size_t i = 0; i < results.size(); ++i) {
                const auto& r = results[i];
                std::fprintf(
                    fp,
                    "    {\"scenario\":\"%s\",\"algorithm\":\"%s\",\"ok\":%s,\"expected_ok\":%s,\"iterations\":%d,\"final_error\":%.17g}%s\n",
                    r.scenario_name,
                    r.algorithm_name,
                    r.ok ? "true" : "false",
                    r.expected_ok ? "true" : "false",
                    r.iterations,
                    r.finalError,
                    (i + 1 < results.size()) ? "," : "");
            }
            std::fprintf(fp, "  ]\n");
            std::fprintf(fp, "}\n");
            std::fclose(fp);
            std::printf("Baseline JSON written: %s\n", json_path);
        } else {
            std::fprintf(stderr, "Failed to write baseline JSON: %s\n", json_path);
            return 1;
        }
    }

    for (const auto& r : results) {
        if (r.expected_ok) {
            assert(r.ok && "Expected convergence but solver failed");
        }
    }

    std::printf("All baseline assertions passed.\n");
    return 0;
}
