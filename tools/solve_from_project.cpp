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
    std::unordered_map<std::string,double> vars;
    static std::string key(const VarRef& v){ return v.id + "." + v.key; }
};

static void usage(){ std::cerr << "Usage: solve_from_project <project.json>\n"; }

int main(int argc, char** argv){
    if (argc < 2) { usage(); return 2; }
    std::ifstream f(argv[1]);
    if (!f.is_open()) { std::cerr << "Open failed: " << argv[1] << "\n"; return 2; }
    json proj; f >> proj;

    VarStore store;
    std::vector<ConstraintSpec> specs;

    // Map points
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

    // Map constraints
    if (proj.contains("scene") && proj["scene"].contains("constraints")){
        for (const auto& c : proj["scene"]["constraints"]) {
            ConstraintSpec s; s.type = c.value("type", "");
            if (c.contains("value") && !c["value"].is_null()) s.value = c["value"].get<double>();
            if (c.contains("refs") && c["refs"].is_array()){
                for (const auto& r : c["refs"]) {
                    // Expect refs as strings like "p1.x" or "p2.y"
                    if (r.is_string()) {
                        std::string sr = r.get<std::string>();
                        auto dot = sr.find('.');
                        if (dot!=std::string::npos){
                            s.vars.push_back(VarRef{ sr.substr(0,dot), sr.substr(dot+1) });
                        }
                    }
                }
            }
            specs.push_back(std::move(s));
        }
    }

    auto get = [&](const VarRef& v, bool& ok)->double{
        auto it = store.vars.find(VarStore::key(v));
        if (it == store.vars.end()) { ok=false; return 0.0; }
        ok=true; return it->second;
    };
    auto set = [&](const VarRef& v, double val){ store.vars[VarStore::key(v)] = val; };

    ISolver* solver = createMinimalSolver();
    solver->setMaxIterations(100);
    solver->setTolerance(1e-6);
    SolveResult res = solver->solveWithBindings(specs, get, set);
    std::cout << "SolveResult: ok=" << res.ok << ", iters=" << res.iterations << ", err=" << res.finalError << "\n";
    for (auto& kv : store.vars) std::cout << kv.first << " = " << kv.second << "\n";
    delete solver; return res.ok ? 0 : 1;
}

