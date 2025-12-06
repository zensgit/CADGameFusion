#include <iostream>
#include <fstream>
#include <string>
#include <unordered_map>
#include <vector>
#include <cmath>

#include "third_party/json.hpp"
#include "core/solver.hpp"

using json = nlohmann::json;
using namespace core;

struct VarStore {
    // key: id.key (e.g., p0.x)
    std::unordered_map<std::string,double> vars;
    static std::string key(const VarRef& v){ return v.id + "." + v.key; }
};

int main(int argc, char** argv){
    if (argc < 2) {
        std::cerr << "Usage: solve_demo <project.json>\n";
        return 2;
    }
    std::ifstream f(argv[1]);
    if (!f.is_open()) { std::cerr << "Open failed: " << argv[1] << "\n"; return 2; }
    json proj; f >> proj;

    // Minimal parse: expect points p0, p1 under scene.entities
    VarStore store;
    std::vector<ConstraintSpec> specs;
    if (proj.contains("scene") && proj["scene"].contains("entities")){
        for (const auto& e : proj["scene"]["entities"]) {
            std::string id = e.value("id", "");
            std::string type = e.value("type", "");
            if (type == "point") {
                auto p = e["params"];
                store.vars[id+".x"] = p.value("x", 0.0);
                store.vars[id+".y"] = p.value("y", 0.0);
            }
        }
    }
    // Minimal constraints: if there are two points p1/p2, enforce horizontal + distance=10
    if (store.vars.find("p1.x")!=store.vars.end() && store.vars.find("p2.x")!=store.vars.end()){
        ConstraintSpec hc; hc.type = "horizontal"; hc.vars = { VarRef{"p1","y"}, VarRef{"p2","y"} };
        ConstraintSpec dc; dc.type = "distance"; dc.value = 10.0; dc.vars = { VarRef{"p1","x"}, VarRef{"p1","y"}, VarRef{"p2","x"}, VarRef{"p2","y"} };
        specs.push_back(hc); specs.push_back(dc);
    }

    auto get = [&](const VarRef& v, bool& ok)->double{
        auto it = store.vars.find(VarStore::key(v));
        if (it == store.vars.end()) { ok=false; return 0.0; }
        ok=true; return it->second;
    };
    auto set = [&](const VarRef& v, double val){ store.vars[VarStore::key(v)] = val; };

    ISolver* solver = createMinimalSolver();
    solver->setMaxIterations(50);
    solver->setTolerance(1e-6);
    SolveResult res = solver->solveWithBindings(specs, get, set);
    std::cout << "SolveResult: ok=" << res.ok << ", iters=" << res.iterations << ", err=" << res.finalError << "\n";
    for (auto& kv : store.vars) std::cout << kv.first << " = " << kv.second << "\n";
    delete solver; return res.ok ? 0 : 1;
}

