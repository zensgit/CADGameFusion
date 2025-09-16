// C++ normalization checks: orientation (outer CCW, holes CW) and lexicographic start
#include <iostream>
#include <fstream>
#include <vector>
#include <string>
#include <filesystem>
#include <cassert>

#include "../../tools/third_party/json.hpp"

namespace fs = std::filesystem;
using json = nlohmann::json;

struct Vec2 { double x; double y; };

static double signedArea(const std::vector<Vec2>& pts) {
    if (pts.size() < 3) return 0.0;
    double a = 0.0;
    for (size_t i = 0; i < pts.size(); ++i) {
        const auto& p0 = pts[i];
        const auto& p1 = pts[(i+1) % pts.size()];
        a += p0.x * p1.y - p1.x * p0.y;
    }
    return 0.5 * a;
}

static bool isLexiMinFirst(const std::vector<Vec2>& pts) {
    if (pts.empty()) return true;
    const auto& first = pts[0];
    for (const auto& p : pts) {
        if (p.x < first.x || (p.x == first.x && p.y < first.y)) return false;
    }
    return true;
}

static int check_group_file(const fs::path& json_path) {
    std::ifstream f(json_path);
    if (!f.is_open()) { std::cerr << "Open failed: " << json_path << "\n"; return 1; }
    json j; f >> j; f.close();

    // load points (object or array style)
    std::vector<Vec2> flat;
    if (!j.contains("flat_pts")) { std::cerr << json_path.filename() << ": missing flat_pts\n"; return 1; }
    for (const auto& p : j["flat_pts"]) {
        if (p.is_object()) flat.push_back({p.value("x",0.0), p.value("y",0.0)});
        else if (p.is_array() && p.size()>=2) flat.push_back({p[0].get<double>(), p[1].get<double>()});
    }

    if (!j.contains("ring_counts")) { std::cerr << json_path.filename() << ": missing ring_counts\n"; return 1; }
    std::vector<int> counts; for (const auto& c : j["ring_counts"]) counts.push_back(c.get<int>());

    std::vector<int> roles; if (j.contains("ring_roles")) for (const auto& r : j["ring_roles"]) roles.push_back(r.get<int>());
    if (roles.empty() && !counts.empty()) { roles.push_back(0); for (size_t i=1;i<counts.size();++i) roles.push_back(1); }

    // meta.normalize presence
    bool hasMeta = j.contains("meta") && j["meta"].contains("normalize");
    if (!hasMeta) {
        std::cerr << json_path.filename() << ": meta.normalize missing\n";
        return 1;
    }

    // split rings and check
    size_t off = 0;
    for (size_t ri = 0; ri < counts.size(); ++ri) {
        int cnt = counts[ri];
        if (off + static_cast<size_t>(cnt) > flat.size()) {
            std::cerr << json_path.filename() << ": count overflow\n"; return 1;
        }
        std::vector<Vec2> ring;
        ring.reserve(cnt);
        for (int i = 0; i < cnt; ++i) ring.push_back(flat[off + i]);
        off += static_cast<size_t>(cnt);

        double area = signedArea(ring);
        bool isHole = (ri < roles.size() ? roles[ri] == 1 : (ri > 0));
        if (!isHole && !(area > 0.0)) {
            std::cerr << json_path.filename() << ": ring " << ri << " expected CCW, area=" << area << "\n";
            return 1;
        }
        if (isHole && !(area < 0.0)) {
            std::cerr << json_path.filename() << ": ring " << ri << " expected CW, area=" << area << "\n";
            return 1;
        }
        if (!isLexiMinFirst(ring)) {
            std::cerr << json_path.filename() << ": ring " << ri << " start vertex not lexicographic min\n";
            return 1;
        }
    }
    return 0;
}

int main() {
    std::vector<fs::path> scenes = {
        fs::path("build/exports/scene_cli_scene_concave_spec"),
        fs::path("build/exports/scene_cli_scene_nested_holes_spec")
    };
    for (const auto& sd : scenes) {
        if (!fs::exists(sd)) {
            std::cerr << "Scene not found: " << sd << "\n";
            return 1;
        }
        bool any = false;
        for (auto& p : fs::directory_iterator(sd)) {
            if (p.path().filename().string().rfind("group_", 0) == 0 && p.path().extension() == ".json") {
                any = true;
                if (int rc = check_group_file(p.path()); rc != 0) return rc;
            }
        }
        if (!any) {
            std::cerr << "No group_*.json in " << sd << "\n";
            return 1;
        }
    }
    std::cout << "C++ normalization checks passed" << std::endl;
    return 0;
}

