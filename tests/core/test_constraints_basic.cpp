#include <cassert>
#include <cmath>
#include <iostream>
#include <string>
#include <unordered_map>
#include <vector>

#include "../../core/include/core/solver.hpp"

using namespace core;

static double length2(double dx, double dy) {
    return std::sqrt(dx * dx + dy * dy);
}

static std::string key_for(const VarRef& var) {
    return var.id + "." + var.key;
}

int main() {
    assert(classifyConstraintKind("horizontal") == ConstraintKind::Horizontal);
    assert(classifyConstraintKind("vertical") == ConstraintKind::Vertical);
    assert(classifyConstraintKind("parallel") == ConstraintKind::Parallel);
    assert(classifyConstraintKind("perpendicular") == ConstraintKind::Perpendicular);
    assert(classifyConstraintKind("equal") == ConstraintKind::Equal);
    assert(classifyConstraintKind("distance") == ConstraintKind::Distance);
    assert(classifyConstraintKind("coincident") == ConstraintKind::Coincident);
    assert(classifyConstraintKind("concentric") == ConstraintKind::Concentric);
    assert(classifyConstraintKind("angle") == ConstraintKind::Angle);
    assert(classifyConstraintKind("broken") == ConstraintKind::Unknown);

    assert(std::string(constraintKindName(ConstraintKind::Horizontal)) == "horizontal");
    assert(std::string(constraintKindName(ConstraintKind::Vertical)) == "vertical");
    assert(std::string(constraintKindName(ConstraintKind::Parallel)) == "parallel");
    assert(std::string(constraintKindName(ConstraintKind::Perpendicular)) == "perpendicular");
    assert(std::string(constraintKindName(ConstraintKind::Equal)) == "equal");
    assert(std::string(constraintKindName(ConstraintKind::Distance)) == "distance");
    assert(std::string(constraintKindName(ConstraintKind::Coincident)) == "coincident");
    assert(std::string(constraintKindName(ConstraintKind::Concentric)) == "concentric");
    assert(std::string(constraintKindName(ConstraintKind::Angle)) == "angle");
    assert(std::string(constraintKindName(ConstraintKind::Unknown)) == "unknown");

    ISolver* solver = createMinimalSolver();
    solver->setMaxIterations(60);
    solver->setTolerance(1e-7);

    std::unordered_map<std::string, double> vars{
        {"p0.x", 0.0}, {"p0.y", 0.0},
        {"p1.x", 1.0}, {"p1.y", 0.5},
        {"q0.x", 0.0}, {"q0.y", 0.0},
        {"q1.x", 1.0}, {"q1.y", 0.0},
        {"r0.x", 0.0}, {"r0.y", 0.0},
    };

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

    auto run_single = [&](const char* label,
                          const std::vector<ConstraintSpec>& specs,
                          const std::function<void()>& check) {
        std::vector<ConstraintSpec> constraints = specs;
        const SolveResult result = solver->solveWithBindings(constraints, get, set);
        assert(result.ok && "basic solve should succeed");
        assert(result.diagnostics.empty());
        assert(result.analysis.constraintCount == static_cast<int>(constraints.size()));
        assert(result.analysis.evaluableConstraintCount == static_cast<int>(constraints.size()));
        assert(result.analysis.wellFormedConstraintCount == static_cast<int>(constraints.size()));
        assert(result.analysis.uniqueConstraintCount == static_cast<int>(constraints.size()));
        assert(result.analysis.structuralState == ConstraintStructuralState::Underconstrained);
        assert(result.analysis.structuralGroupCount == 1);
        assert(result.analysis.problematicConstraintCount == 0);
        assert(result.analysis.conflictGroupCount == 0);
        assert(result.analysis.redundancySubsetCount == 0);
        assert(result.analysis.duplicateConstraintCount == 0);
        assert(result.analysis.boundVariableCount >= 2);
        check();
        std::cout << "basic constraint case passed: " << label << "\n";
    };

    vars["p0.x"] = 0.0; vars["p0.y"] = 0.0;
    vars["p1.x"] = 2.0; vars["p1.y"] = 3.0;
    run_single(
        "horizontal",
        {ConstraintSpec{"horizontal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt}},
        [&]() {
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 1e-4);
        });

    vars["p0.x"] = 1.0; vars["p0.y"] = -1.0;
    vars["p1.x"] = 4.0; vars["p1.y"] = 2.0;
    run_single(
        "vertical",
        {ConstraintSpec{"vertical", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt}},
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 1e-4);
        });

    vars["p0.x"] = 0.0; vars["p0.y"] = 0.3;
    vars["p1.x"] = 5.0; vars["p1.y"] = -2.0;
    run_single(
        "equal",
        {ConstraintSpec{"equal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt}},
        [&]() {
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 1e-4);
        });

    vars["p0.x"] = 0.0; vars["p0.y"] = 0.0;
    vars["p1.x"] = 1.0; vars["p1.y"] = 0.0;
    run_single(
        "distance",
        {ConstraintSpec{"distance",
                        {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                        2.0}},
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(length2(dx, dy) - 2.0) < 5e-3);
        });

    vars["q0.x"] = 0.0; vars["q0.y"] = 0.0;
    vars["q1.x"] = 5.0; vars["q1.y"] = 0.0;
    vars["p0.x"] = 0.0; vars["p0.y"] = 0.0;
    vars["p1.x"] = 1.0; vars["p1.y"] = 2.0;
    run_single(
        "parallel",
        {ConstraintSpec{"parallel",
                        {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                         VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                        std::nullopt}},
        [&]() {
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
        });

    vars["q0.x"] = 0.0; vars["q0.y"] = 0.0;
    vars["q1.x"] = 0.0; vars["q1.y"] = 4.0;
    vars["p0.x"] = 0.0; vars["p0.y"] = 0.0;
    vars["p1.x"] = 1.0; vars["p1.y"] = 0.2;
    run_single(
        "perpendicular",
        {ConstraintSpec{"perpendicular",
                        {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                         VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                        std::nullopt}},
        [&]() {
            const double v1x = vars["p1.x"] - vars["p0.x"];
            const double v1y = vars["p1.y"] - vars["p0.y"];
            const double v2x = vars["q1.x"] - vars["q0.x"];
            const double v2y = vars["q1.y"] - vars["q0.y"];
            const double n1 = length2(v1x, v1y);
            const double n2 = length2(v2x, v2y);
            assert(n1 > 1e-9 && n2 > 1e-9);
            const double cosAngle = (v1x * v2x + v1y * v2y) / (n1 * n2);
            assert(std::abs(cosAngle) < 5e-2);
        });

    vars["p0.x"] = 0.0; vars["p0.y"] = 0.0;
    vars["p1.x"] = 1.5; vars["p1.y"] = 2.0;
    run_single(
        "horizontal+distance",
        {
            ConstraintSpec{"horizontal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           3.0},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(dy) < 5e-3);
            assert(std::abs(length2(dx, dy) - 3.0) < 5e-3);
        });

    vars["p0.x"] = 1.0; vars["p0.y"] = 1.0;
    vars["p1.x"] = 4.0; vars["p1.y"] = 1.5;
    run_single(
        "vertical+distance",
        {
            ConstraintSpec{"vertical", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           2.5},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(dx) < 5e-3);
            assert(std::abs(length2(dx, dy) - 2.5) < 5e-3);
        });

    vars["q0.x"] = -1.0; vars["q0.y"] = 2.0;
    vars["q1.x"] = 3.0; vars["q1.y"] = 2.0;
    vars["p0.x"] = 0.0; vars["p0.y"] = -1.0;
    vars["p1.x"] = 0.5; vars["p1.y"] = 0.8;
    run_single(
        "parallel+distance",
        {
            ConstraintSpec{"parallel",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           1.75},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(dy) < 5e-3);
            assert(std::abs(length2(dx, dy) - 1.75) < 5e-3);
        });

    vars["p0.x"] = -2.0; vars["p0.y"] = 1.25;
    vars["p1.x"] = 4.0; vars["p1.y"] = -3.0;
    run_single(
        "equal+distance",
        {
            ConstraintSpec{"equal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           5.5},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(dy) < 5e-3);
            assert(std::abs(length2(dx, dy) - 5.5) < 5e-3);
        });

    vars["q0.x"] = -1.0; vars["q0.y"] = 1.0;
    vars["q1.x"] = -1.0; vars["q1.y"] = 5.0;
    vars["p0.x"] = 0.0; vars["p0.y"] = 0.0;
    vars["p1.x"] = 1.4; vars["p1.y"] = 0.6;
    run_single(
        "perpendicular+distance",
        {
            ConstraintSpec{"perpendicular",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           2.25},
        },
        [&]() {
            const double v1x = vars["p1.x"] - vars["p0.x"];
            const double v1y = vars["p1.y"] - vars["p0.y"];
            const double v2x = vars["q1.x"] - vars["q0.x"];
            const double v2y = vars["q1.y"] - vars["q0.y"];
            const double n1 = length2(v1x, v1y);
            const double n2 = length2(v2x, v2y);
            assert(n1 > 1e-9 && n2 > 1e-9);
            const double cosAngle = (v1x * v2x + v1y * v2y) / (n1 * n2);
            assert(std::abs(cosAngle) < 5e-2);
            assert(std::abs(n1 - 2.25) < 5e-3);
        });

    vars["p0.x"] = -3.0; vars["p0.y"] = 2.0;
    vars["p1.x"] = 1.0; vars["p1.y"] = -4.5;
    run_single(
        "equal_x+distance",
        {
            ConstraintSpec{"equal", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           3.25},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(dx) < 5e-3);
            assert(std::abs(length2(dx, dy) - 3.25) < 5e-3);
        });

    vars["q0.x"] = 2.0; vars["q0.y"] = -1.0;
    vars["q1.x"] = 2.0; vars["q1.y"] = 4.0;
    vars["p0.x"] = -2.0; vars["p0.y"] = 0.0;
    vars["p1.x"] = 1.1; vars["p1.y"] = 0.4;
    run_single(
        "parallel_vertical+distance",
        {
            ConstraintSpec{"parallel",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           2.8},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(dx) < 5e-3);
            assert(std::abs(length2(dx, dy) - 2.8) < 5e-3);
        });

    vars["q0.x"] = -4.0; vars["q0.y"] = 3.0;
    vars["q1.x"] = 1.0; vars["q1.y"] = 3.0;
    vars["p0.x"] = 0.0; vars["p0.y"] = 0.0;
    vars["p1.x"] = 1.2; vars["p1.y"] = 0.1;
    run_single(
        "perpendicular_horizontal+distance",
        {
            ConstraintSpec{"perpendicular",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           1.6},
        },
        [&]() {
            const double v1x = vars["p1.x"] - vars["p0.x"];
            const double v1y = vars["p1.y"] - vars["p0.y"];
            const double v2x = vars["q1.x"] - vars["q0.x"];
            const double v2y = vars["q1.y"] - vars["q0.y"];
            const double n1 = length2(v1x, v1y);
            const double n2 = length2(v2x, v2y);
            assert(n1 > 1e-9 && n2 > 1e-9);
            const double cosAngle = (v1x * v2x + v1y * v2y) / (n1 * n2);
            assert(std::abs(cosAngle) < 5e-2);
            assert(std::abs(n1 - 1.6) < 5e-3);
        });

    vars["p0.x"] = -5.0; vars["p0.y"] = 2.5;
    vars["p1.x"] = 3.0; vars["p1.y"] = -4.0;
    run_single(
        "equal_x+horizontal",
        {
            ConstraintSpec{"equal", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"horizontal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
        });

    vars["p0.x"] = 1.75; vars["p0.y"] = -2.5;
    vars["p1.x"] = -3.25; vars["p1.y"] = 6.0;
    run_single(
        "equal_y+vertical",
        {
            ConstraintSpec{"equal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"vertical", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
        });

    vars["p0.x"] = -2.5; vars["p0.y"] = 4.0;
    vars["p1.x"] = 6.5; vars["p1.y"] = -3.25;
    run_single(
        "equal_y+horizontal",
        {
            ConstraintSpec{"equal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"horizontal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
        });

    vars["p0.x"] = 1.25; vars["p0.y"] = -4.5;
    vars["p1.x"] = -5.75; vars["p1.y"] = 2.25;
    run_single(
        "equal_x+vertical",
        {
            ConstraintSpec{"equal", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"vertical", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
        });

    vars["q0.x"] = -3.0; vars["q0.y"] = 4.5;
    vars["q1.x"] = 2.0; vars["q1.y"] = 4.5;
    vars["p0.x"] = 1.0; vars["p0.y"] = -3.5;
    vars["p1.x"] = 2.5; vars["p1.y"] = 0.5;
    run_single(
        "parallel_horizontal+vertical",
        {
            ConstraintSpec{"parallel",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"vertical", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
        });

    vars["q0.x"] = 5.5; vars["q0.y"] = -2.0;
    vars["q1.x"] = 5.5; vars["q1.y"] = 3.0;
    vars["p0.x"] = -4.0; vars["p0.y"] = 1.5;
    vars["p1.x"] = -2.0; vars["p1.y"] = 6.5;
    run_single(
        "parallel_vertical+horizontal",
        {
            ConstraintSpec{"parallel",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"horizontal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
        });

    vars["p0.x"] = -1.5; vars["p0.y"] = 2.25;
    vars["p1.x"] = 3.5; vars["p1.y"] = -4.75;
    run_single(
        "horizontal+vertical",
        {
            ConstraintSpec{"horizontal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"vertical", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
        });

    vars["p0.x"] = 6.0; vars["p0.y"] = -3.25;
    vars["p1.x"] = -2.5; vars["p1.y"] = 7.5;
    run_single(
        "equal_x+equal_y",
        {
            ConstraintSpec{"equal", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
        });

    vars["p0.x"] = 2.0; vars["p0.y"] = -3.0;
    vars["p1.x"] = 4.5; vars["p1.y"] = 6.0;
    run_single(
        "equal_y+distance",
        {
            ConstraintSpec{"equal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           4.75},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(dy) < 5e-3);
            assert(std::abs(length2(dx, dy) - 4.75) < 5e-3);
        });

    vars["q0.x"] = 6.5; vars["q0.y"] = -1.5;
    vars["p0.x"] = 1.25; vars["p0.y"] = -2.0;
    vars["p1.x"] = -4.0; vars["p1.y"] = 8.0;
    run_single(
        "horizontal+equal_anchor_x",
        {
            ConstraintSpec{"horizontal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"q0", "x"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["q0.x"]) < 5e-3);
        });

    vars["q0.x"] = -7.25; vars["q0.y"] = 4.0;
    vars["p0.x"] = 3.5; vars["p0.y"] = -6.0;
    vars["p1.x"] = 2.0; vars["p1.y"] = 1.25;
    run_single(
        "vertical+equal_anchor_x",
        {
            ConstraintSpec{"vertical", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"q0", "x"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["q0.x"]) < 5e-3);
        });

    vars["q0.x"] = 5.5; vars["q0.y"] = -7.75;
    vars["p0.x"] = -2.0; vars["p0.y"] = 4.0;
    vars["p1.x"] = 9.0; vars["p1.y"] = -1.0;
    run_single(
        "horizontal+equal_anchor_y",
        {
            ConstraintSpec{"horizontal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"q0", "y"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["q0.y"]) < 5e-3);
        });

    vars["q0.x"] = -6.25; vars["q0.y"] = 2.5;
    vars["p0.x"] = 4.0; vars["p0.y"] = -3.5;
    vars["p1.x"] = -1.5; vars["p1.y"] = 8.0;
    run_single(
        "vertical+equal_anchor_y",
        {
            ConstraintSpec{"vertical", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"q0", "y"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["q0.y"]) < 5e-3);
        });

    vars["q0.x"] = -2.75; vars["q0.y"] = 6.5;
    vars["p0.x"] = 1.5; vars["p0.y"] = -1.0;
    vars["p1.x"] = 7.25; vars["p1.y"] = 4.0;
    run_single(
        "distance+equal_anchor_x",
        {
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           3.5},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"q0", "x"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.x"] - vars["q0.x"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 3.5) < 5e-3);
        });

    vars["q0.x"] = 4.25; vars["q0.y"] = -3.75;
    vars["p0.x"] = -2.5; vars["p0.y"] = 1.25;
    vars["p1.x"] = 6.0; vars["p1.y"] = 5.5;
    run_single(
        "distance+equal_anchor_y",
        {
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           4.25},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"q0", "y"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.y"] - vars["q0.y"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 4.25) < 5e-3);
        });

    vars["q0.x"] = -1.0; vars["q0.y"] = 5.25;
    vars["q1.x"] = 4.0; vars["q1.y"] = 5.25;
    vars["r0.x"] = 8.5; vars["r0.y"] = -6.75;
    vars["p0.x"] = -3.0; vars["p0.y"] = 2.0;
    vars["p1.x"] = 6.0; vars["p1.y"] = -4.0;
    run_single(
        "parallel_horizontal+equal_anchor_y",
        {
            ConstraintSpec{"parallel",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"r0", "y"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["r0.y"]) < 5e-3);
        });

    vars["q0.x"] = 2.25; vars["q0.y"] = -3.0;
    vars["q1.x"] = 2.25; vars["q1.y"] = 4.5;
    vars["r0.x"] = -7.5; vars["r0.y"] = 1.0;
    vars["p0.x"] = 0.5; vars["p0.y"] = -1.25;
    vars["p1.x"] = 4.0; vars["p1.y"] = 3.5;
    run_single(
        "perpendicular_vertical+equal_anchor_x",
        {
            ConstraintSpec{"perpendicular",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"r0", "x"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["r0.x"]) < 5e-3);
        });

    vars["q0.x"] = 3.25; vars["q0.y"] = -4.5;
    vars["q1.x"] = 3.25; vars["q1.y"] = 2.0;
    vars["r0.x"] = 1.5; vars["r0.y"] = 6.75;
    vars["p0.x"] = -2.0; vars["p0.y"] = -1.5;
    vars["p1.x"] = 4.5; vars["p1.y"] = -3.25;
    run_single(
        "parallel_vertical+equal_anchor_y",
        {
            ConstraintSpec{"parallel",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"r0", "y"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["r0.y"]) < 5e-3);
        });

    vars["q0.x"] = -4.5; vars["q0.y"] = 1.5;
    vars["q1.x"] = 2.5; vars["q1.y"] = 1.5;
    vars["r0.x"] = 7.25; vars["r0.y"] = -2.0;
    vars["p0.x"] = -1.0; vars["p0.y"] = 4.0;
    vars["p1.x"] = 3.5; vars["p1.y"] = -6.5;
    run_single(
        "parallel_horizontal+equal_anchor_x",
        {
            ConstraintSpec{"parallel",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"r0", "x"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["r0.x"]) < 5e-3);
        });

    vars["q0.x"] = -6.0; vars["q0.y"] = 2.25;
    vars["q1.x"] = 1.5; vars["q1.y"] = 2.25;
    vars["r0.x"] = -4.75; vars["r0.y"] = -5.5;
    vars["p0.x"] = 2.0; vars["p0.y"] = 3.0;
    vars["p1.x"] = 3.0; vars["p1.y"] = 7.5;
    run_single(
        "perpendicular_horizontal+equal_anchor_y",
        {
            ConstraintSpec{"perpendicular",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"r0", "y"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["r0.y"]) < 5e-3);
        });

    vars["q0.x"] = -3.25; vars["q0.y"] = 7.0;
    vars["q1.x"] = 4.0; vars["q1.y"] = 7.0;
    vars["r0.x"] = 8.5; vars["r0.y"] = -1.75;
    vars["p0.x"] = -1.5; vars["p0.y"] = 0.5;
    vars["p1.x"] = 5.0; vars["p1.y"] = -6.25;
    run_single(
        "perpendicular_horizontal+equal_anchor_x",
        {
            ConstraintSpec{"perpendicular",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"r0", "x"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["r0.x"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
        });

    vars["q0.x"] = 6.0; vars["q0.y"] = -2.5;
    vars["q1.x"] = 6.0; vars["q1.y"] = 4.0;
    vars["r0.x"] = -1.25; vars["r0.y"] = 8.75;
    vars["p0.x"] = -3.5; vars["p0.y"] = 1.0;
    vars["p1.x"] = 5.0; vars["p1.y"] = -4.5;
    run_single(
        "perpendicular_vertical+equal_anchor_y",
        {
            ConstraintSpec{"perpendicular",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"r0", "y"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["r0.y"]) < 5e-3);
        });

    vars["q0.x"] = 4.25; vars["q0.y"] = -6.5;
    vars["p0.x"] = -2.75; vars["p0.y"] = 3.0;
    vars["p1.x"] = 7.5; vars["p1.y"] = 1.25;
    run_single(
        "equal_x+equal_anchor_y",
        {
            ConstraintSpec{"equal", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"q0", "y"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["q0.y"]) < 5e-3);
        });

    vars["q0.x"] = -5.5; vars["q0.y"] = 2.75;
    vars["p0.x"] = 6.0; vars["p0.y"] = -4.25;
    vars["p1.x"] = -1.5; vars["p1.y"] = 8.5;
    run_single(
        "equal_y+equal_anchor_x",
        {
            ConstraintSpec{"equal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"q0", "x"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["q0.x"]) < 5e-3);
        });

    vars["q0.x"] = 8.25; vars["q0.y"] = -1.5;
    vars["p0.x"] = -4.0; vars["p0.y"] = 2.5;
    vars["p1.x"] = 3.0; vars["p1.y"] = -6.5;
    run_single(
        "horizontal+distance+equal_anchor_x",
        {
            ConstraintSpec{"horizontal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           5.25},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"q0", "x"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["q0.x"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 5.25) < 5e-3);
        });

    vars["q0.x"] = -3.75; vars["q0.y"] = 7.0;
    vars["p0.x"] = 1.5; vars["p0.y"] = -5.0;
    vars["p1.x"] = 4.5; vars["p1.y"] = 3.5;
    run_single(
        "vertical+distance+equal_anchor_y",
        {
            ConstraintSpec{"vertical", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           6.75},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"q0", "y"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["q0.y"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 6.75) < 5e-3);
        });

    vars["q0.x"] = -2.5; vars["q0.y"] = 4.5;
    vars["q1.x"] = 3.5; vars["q1.y"] = 4.5;
    vars["r0.x"] = 4.75; vars["r0.y"] = -1.0;
    vars["p0.x"] = -0.5; vars["p0.y"] = 1.25;
    vars["p1.x"] = 2.0; vars["p1.y"] = -3.5;
    run_single(
        "parallel_horizontal+distance+equal_anchor_x",
        {
            ConstraintSpec{"parallel",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           5.25},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"r0", "x"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["r0.x"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 5.25) < 5e-3);
        });

    vars["q0.x"] = 6.5; vars["q0.y"] = -3.0;
    vars["q1.x"] = 6.5; vars["q1.y"] = 5.0;
    vars["r0.x"] = -1.25; vars["r0.y"] = 6.75;
    vars["p0.x"] = 2.5; vars["p0.y"] = 1.5;
    vars["p1.x"] = -4.0; vars["p1.y"] = 2.0;
    run_single(
        "parallel_vertical+distance+equal_anchor_y",
        {
            ConstraintSpec{"parallel",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           5.25},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"r0", "y"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["r0.y"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 5.25) < 5e-3);
        });

    vars["q0.x"] = 3.0; vars["q0.y"] = -2.0;
    vars["q1.x"] = 3.0; vars["q1.y"] = 6.0;
    vars["r0.x"] = 8.25; vars["r0.y"] = -1.5;
    vars["p0.x"] = -2.0; vars["p0.y"] = 4.0;
    vars["p1.x"] = 1.0; vars["p1.y"] = 0.5;
    run_single(
        "perpendicular_horizontal+distance+equal_anchor_x",
        {
            ConstraintSpec{"perpendicular",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           4.75},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"r0", "x"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["r0.x"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 4.75) < 5e-3);
        });

    vars["q0.x"] = -5.0; vars["q0.y"] = 1.25;
    vars["q1.x"] = 2.0; vars["q1.y"] = 1.25;
    vars["r0.x"] = -3.0; vars["r0.y"] = 9.5;
    vars["p0.x"] = 6.0; vars["p0.y"] = -1.0;
    vars["p1.x"] = 4.0; vars["p1.y"] = 2.0;
    run_single(
        "perpendicular_vertical+distance+equal_anchor_y",
        {
            ConstraintSpec{"perpendicular",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           4.75},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"r0", "y"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["r0.y"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 4.75) < 5e-3);
        });

    vars["r0.x"] = -2.5; vars["r0.y"] = 8.0;
    vars["p0.x"] = 1.75; vars["p0.y"] = -1.5;
    vars["p1.x"] = 6.25; vars["p1.y"] = 3.0;
    run_single(
        "equal_x+distance+equal_anchor_y",
        {
            ConstraintSpec{"equal", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           6.0},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"r0", "y"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["r0.y"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 6.0) < 5e-3);
        });

    vars["r0.x"] = 9.0; vars["r0.y"] = -4.5;
    vars["p0.x"] = -3.0; vars["p0.y"] = 2.25;
    vars["p1.x"] = 2.0; vars["p1.y"] = 6.5;
    run_single(
        "equal_y+distance+equal_anchor_x",
        {
            ConstraintSpec{"equal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           6.0},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"r0", "x"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["r0.x"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 6.0) < 5e-3);
        });

    vars["r0.x"] = 4.0; vars["r0.y"] = -7.25;
    vars["p0.x"] = -6.0; vars["p0.y"] = 1.5;
    vars["p1.x"] = 3.0; vars["p1.y"] = -2.0;
    run_single(
        "horizontal+distance+equal_anchor_y",
        {
            ConstraintSpec{"horizontal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           7.5},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"r0", "y"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["r0.y"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 7.5) < 5e-3);
        });

    vars["r0.x"] = 8.75; vars["r0.y"] = 2.0;
    vars["p0.x"] = -2.5; vars["p0.y"] = -3.0;
    vars["p1.x"] = 1.0; vars["p1.y"] = 6.5;
    run_single(
        "vertical+distance+equal_anchor_x",
        {
            ConstraintSpec{"vertical", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           7.0},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"r0", "x"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["r0.x"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 7.0) < 5e-3);
        });

    vars["q0.x"] = -4.0; vars["q0.y"] = 6.25;
    vars["q1.x"] = 3.0; vars["q1.y"] = 6.25;
    vars["r0.x"] = 1.0; vars["r0.y"] = -8.5;
    vars["p0.x"] = -6.0; vars["p0.y"] = 2.0;
    vars["p1.x"] = -1.0; vars["p1.y"] = -4.0;
    run_single(
        "parallel_horizontal+distance+equal_anchor_y",
        {
            ConstraintSpec{"parallel",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           6.5},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"r0", "y"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["r0.y"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 6.5) < 5e-3);
        });

    vars["q0.x"] = 7.25; vars["q0.y"] = -3.0;
    vars["q1.x"] = 7.25; vars["q1.y"] = 4.0;
    vars["r0.x"] = -9.0; vars["r0.y"] = 1.0;
    vars["p0.x"] = 2.0; vars["p0.y"] = -5.5;
    vars["p1.x"] = -4.0; vars["p1.y"] = 0.5;
    run_single(
        "parallel_vertical+distance+equal_anchor_x",
        {
            ConstraintSpec{"parallel",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           5.25},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"r0", "x"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["r0.x"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 5.25) < 5e-3);
        });

    vars["q0.x"] = -3.0; vars["q0.y"] = 0.0;
    vars["q1.x"] = 4.0; vars["q1.y"] = 0.0;
    vars["r0.x"] = 5.0; vars["r0.y"] = 8.0;
    vars["p0.x"] = 7.0; vars["p0.y"] = -2.0;
    vars["p1.x"] = 1.0; vars["p1.y"] = 3.0;
    run_single(
        "perpendicular_horizontal+distance+equal_anchor_y",
        {
            ConstraintSpec{"perpendicular",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           5.5},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"r0", "y"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["r0.y"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 5.5) < 5e-3);
        });

    vars["q0.x"] = 0.0; vars["q0.y"] = -4.0;
    vars["q1.x"] = 0.0; vars["q1.y"] = 5.0;
    vars["r0.x"] = -7.5; vars["r0.y"] = 2.0;
    vars["p0.x"] = -1.0; vars["p0.y"] = 7.0;
    vars["p1.x"] = 2.5; vars["p1.y"] = -3.0;
    run_single(
        "perpendicular_vertical+distance+equal_anchor_x",
        {
            ConstraintSpec{"perpendicular",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           4.25},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"r0", "x"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["r0.x"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 4.25) < 5e-3);
        });

    vars["r0.x"] = 8.0; vars["r0.y"] = 1.0;
    vars["p0.x"] = 1.5; vars["p0.y"] = -2.0;
    vars["p1.x"] = -3.0; vars["p1.y"] = 6.0;
    run_single(
        "horizontal+distance+equal_anchor_x",
        {
            ConstraintSpec{"horizontal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           6.5},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"r0", "x"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["r0.x"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 6.5) < 5e-3);
        });

    vars["r0.x"] = -4.0; vars["r0.y"] = 5.5;
    vars["p0.x"] = -4.0; vars["p0.y"] = -1.5;
    vars["p1.x"] = 2.0; vars["p1.y"] = 3.0;
    run_single(
        "vertical+distance+equal_anchor_y",
        {
            ConstraintSpec{"vertical", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           7.0},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"r0", "y"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["r0.y"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 7.0) < 5e-3);
        });

    vars["r0.x"] = 9.25; vars["r0.y"] = -6.0;
    vars["p0.x"] = 3.25; vars["p0.y"] = -6.0;
    vars["p1.x"] = -1.0; vars["p1.y"] = 1.5;
    run_single(
        "equal_x+horizontal+distance",
        {
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"r0", "x"}}, std::nullopt},
            ConstraintSpec{"horizontal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           6.0},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.x"] - vars["r0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 6.0) < 5e-3);
        });

    vars["r0.x"] = 2.0; vars["r0.y"] = 11.5;
    vars["p0.x"] = 2.0; vars["p0.y"] = 4.0;
    vars["p1.x"] = -3.0; vars["p1.y"] = -2.0;
    run_single(
        "equal_y+vertical+distance",
        {
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"r0", "y"}}, std::nullopt},
            ConstraintSpec{"vertical", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           7.5},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.y"] - vars["r0.y"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 7.5) < 5e-3);
        });

    vars["r0.x"] = -5.75; vars["r0.y"] = 2.0;
    vars["p0.x"] = 4.5; vars["p0.y"] = -1.5;
    vars["p1.x"] = 1.0; vars["p1.y"] = 6.0;
    run_single(
        "horizontal+distance+equal_anchor_y",
        {
            ConstraintSpec{"horizontal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           10.25},
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"r0", "y"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["r0.y"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 10.25) < 5e-3);
        });

    vars["r0.x"] = 6.25; vars["r0.y"] = -4.0;
    vars["p0.x"] = -3.5; vars["p0.y"] = 8.5;
    vars["p1.x"] = 0.0; vars["p1.y"] = 2.0;
    run_single(
        "vertical+distance+equal_anchor_x",
        {
            ConstraintSpec{"vertical", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           9.75},
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"r0", "x"}}, std::nullopt},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["r0.x"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 9.75) < 5e-3);
        });

    vars["r0.x"] = 12.0; vars["r0.y"] = 4.5;
    vars["p0.x"] = -2.0; vars["p0.y"] = -6.0;
    vars["p1.x"] = 1.5; vars["p1.y"] = 3.0;
    run_single(
        "equal_x+vertical+distance",
        {
            ConstraintSpec{"equal", {VarRef{"p1", "x"}, VarRef{"r0", "x"}}, std::nullopt},
            ConstraintSpec{"vertical", {VarRef{"p0", "x"}, VarRef{"p1", "x"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           10.5},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.x"] - vars["r0.x"]) < 5e-3);
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 10.5) < 5e-3);
        });

    vars["r0.x"] = -8.0; vars["r0.y"] = 7.75;
    vars["p0.x"] = 5.0; vars["p0.y"] = -3.0;
    vars["p1.x"] = -1.0; vars["p1.y"] = 2.0;
    run_single(
        "equal_y+horizontal+distance",
        {
            ConstraintSpec{"equal", {VarRef{"p1", "y"}, VarRef{"r0", "y"}}, std::nullopt},
            ConstraintSpec{"horizontal", {VarRef{"p0", "y"}, VarRef{"p1", "y"}}, std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           13.0},
        },
        [&]() {
            const double dx = vars["p1.x"] - vars["p0.x"];
            const double dy = vars["p1.y"] - vars["p0.y"];
            assert(std::abs(vars["p1.y"] - vars["r0.y"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            assert(std::abs(length2(dx, dy) - 13.0) < 5e-3);
        });


    // =========================================================================
    // Coincident, Concentric, Angle constraint tests
    // =========================================================================

    // --- Coincident: single-constraint success path ---
    // Semantics: two points coincide.
    // Vars: [{id1, "x"}, {id1, "y"}, {id2, "x"}, {id2, "y"}], no value.
    vars["p0.x"] = 1.0; vars["p0.y"] = 2.0;
    vars["p1.x"] = 3.0; vars["p1.y"] = 4.5;
    run_single(
        "coincident",
        {ConstraintSpec{"coincident",
                        {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                        std::nullopt}},
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
        });

    // --- Coincident: composed with distance on a third point ---
    vars["p0.x"] = 1.0; vars["p0.y"] = 2.0;
    vars["p1.x"] = 3.0; vars["p1.y"] = 4.5;
    vars["r0.x"] = 6.0; vars["r0.y"] = -1.0;
    run_single(
        "coincident+distance",
        {
            ConstraintSpec{"coincident",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           std::nullopt},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"r0", "x"}, VarRef{"r0", "y"}},
                           3.5},
        },
        [&]() {
            assert(std::abs(vars["p1.x"] - vars["p0.x"]) < 5e-3);
            assert(std::abs(vars["p1.y"] - vars["p0.y"]) < 5e-3);
            const double dx = vars["r0.x"] - vars["p0.x"];
            const double dy = vars["r0.y"] - vars["p0.y"];
            assert(std::abs(length2(dx, dy) - 3.5) < 5e-3);
        });

    // --- Concentric: single-constraint success path ---
    // Semantics: two circles share the same center.
    // Vars: [{id1, "cx"}, {id1, "cy"}, {id2, "cx"}, {id2, "cy"}], no value.
    vars["p0.cx"] = 1.0; vars["p0.cy"] = 2.0;
    vars["p1.cx"] = 4.0; vars["p1.cy"] = -1.5;
    run_single(
        "concentric",
        {ConstraintSpec{"concentric",
                        {VarRef{"p0", "cx"}, VarRef{"p0", "cy"}, VarRef{"p1", "cx"}, VarRef{"p1", "cy"}},
                        std::nullopt}},
        [&]() {
            assert(std::abs(vars["p1.cx"] - vars["p0.cx"]) < 5e-3);
            assert(std::abs(vars["p1.cy"] - vars["p0.cy"]) < 5e-3);
        });

    // --- Concentric: composed with equal (radii) ---
    vars["p0.cx"] = 1.0; vars["p0.cy"] = 2.0; vars["p0.r"] = 3.0;
    vars["p1.cx"] = 4.0; vars["p1.cy"] = -1.5; vars["p1.r"] = 5.0;
    run_single(
        "concentric+equal_radius",
        {
            ConstraintSpec{"concentric",
                           {VarRef{"p0", "cx"}, VarRef{"p0", "cy"}, VarRef{"p1", "cx"}, VarRef{"p1", "cy"}},
                           std::nullopt},
            ConstraintSpec{"equal", {VarRef{"p0", "r"}, VarRef{"p1", "r"}}, std::nullopt},
        },
        [&]() {
            assert(std::abs(vars["p1.cx"] - vars["p0.cx"]) < 5e-3);
            assert(std::abs(vars["p1.cy"] - vars["p0.cy"]) < 5e-3);
            assert(std::abs(vars["p1.r"] - vars["p0.r"]) < 5e-3);
        });

    // --- Angle: single-constraint success path ---
    // Semantics: angle between two lines.
    // Vars: 8 VarRefs (same layout as parallel/perpendicular), requires a value in radians.
    // Example: 45 degrees = M_PI / 4.
    vars["p0.x"] = 0.0; vars["p0.y"] = 0.0;
    vars["p1.x"] = 3.0; vars["p1.y"] = 0.0;
    vars["q0.x"] = 0.0; vars["q0.y"] = 0.0;
    vars["q1.x"] = 2.0; vars["q1.y"] = 2.5;
    run_single(
        "angle_45deg",
        {ConstraintSpec{"angle",
                        {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                         VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                        M_PI / 4.0}},
        [&]() {
            const double v1x = vars["p1.x"] - vars["p0.x"];
            const double v1y = vars["p1.y"] - vars["p0.y"];
            const double v2x = vars["q1.x"] - vars["q0.x"];
            const double v2y = vars["q1.y"] - vars["q0.y"];
            const double n1 = length2(v1x, v1y);
            const double n2 = length2(v2x, v2y);
            assert(n1 > 1e-9 && n2 > 1e-9);
            const double cosAngle = (v1x * v2x + v1y * v2y) / (n1 * n2);
            assert(std::abs(cosAngle - std::cos(M_PI / 4.0)) < 5e-2);
        });

    // --- Angle: composed with distance ---
    vars["p0.x"] = 0.0; vars["p0.y"] = 0.0;
    vars["p1.x"] = 3.0; vars["p1.y"] = 0.0;
    vars["q0.x"] = 0.0; vars["q0.y"] = 0.0;
    vars["q1.x"] = 1.5; vars["q1.y"] = 2.0;
    run_single(
        "angle_45deg+distance",
        {
            ConstraintSpec{"angle",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"},
                            VarRef{"q0", "x"}, VarRef{"q0", "y"}, VarRef{"q1", "x"}, VarRef{"q1", "y"}},
                           M_PI / 4.0},
            ConstraintSpec{"distance",
                           {VarRef{"p0", "x"}, VarRef{"p0", "y"}, VarRef{"p1", "x"}, VarRef{"p1", "y"}},
                           4.0},
        },
        [&]() {
            const double v1x = vars["p1.x"] - vars["p0.x"];
            const double v1y = vars["p1.y"] - vars["p0.y"];
            const double v2x = vars["q1.x"] - vars["q0.x"];
            const double v2y = vars["q1.y"] - vars["q0.y"];
            const double n1 = length2(v1x, v1y);
            const double n2 = length2(v2x, v2y);
            assert(n1 > 1e-9 && n2 > 1e-9);
            const double cosAngle = (v1x * v2x + v1y * v2y) / (n1 * n2);
            assert(std::abs(cosAngle - std::cos(M_PI / 4.0)) < 5e-2);
            assert(std::abs(n1 - 4.0) < 5e-3);
        });

    std::cout << "solver basic constraints regression passed\n";
    delete solver;
    return 0;
}
