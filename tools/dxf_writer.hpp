#pragma once
#include <string>
#include <vector>
#include <sstream>
#include <cmath>
#include "third_party/json.hpp"

namespace dxf_writer {

using json = nlohmann::json;

inline std::string writeDxf(const json& doc) {
    std::ostringstream out;
    auto emit = [&](int code, const std::string& val) {
        out << code << "\n" << val << "\n";
    };
    auto emitd = [&](int code, double val) {
        std::ostringstream s;
        s << val;
        emit(code, s.str());
    };
    auto emiti = [&](int code, int val) {
        emit(code, std::to_string(val));
    };

    // --- TABLES section (layers) ---
    emit(0, "SECTION");
    emit(2, "TABLES");
    emit(0, "TABLE");
    emit(2, "LAYER");

    const auto& layers = doc.value("layers", json::array());
    emiti(70, static_cast<int>(layers.size()));

    for (const auto& layer : layers) {
        emit(0, "LAYER");
        emit(2, layer.value("name", "0"));
        emiti(70, 0);
        emiti(62, layer.value("color_aci", 7));
    }

    emit(0, "ENDTAB");
    emit(0, "ENDSEC");

    // --- ENTITIES section ---
    emit(0, "SECTION");
    emit(2, "ENTITIES");

    const auto& entities = doc.value("entities", json::array());
    for (const auto& ent : entities) {
        int type = ent.value("type", -1);
        std::string layerName = "0";
        int layerId = ent.value("layer_id", 0);
        for (const auto& ly : layers) {
            if (ly.value("id", -1) == layerId) {
                layerName = ly.value("name", "0");
                break;
            }
        }

        if (type == 2 && ent.contains("line")) {
            // LINE: line = [[x0,y0],[x1,y1]]
            const auto& l = ent["line"];
            if (l.is_array() && l.size() >= 2) {
                emit(0, "LINE");
                emit(8, layerName);
                emitd(10, l[0][0].get<double>());
                emitd(20, l[0][1].get<double>());
                emitd(11, l[1][0].get<double>());
                emitd(21, l[1][1].get<double>());
            }
        }
        else if (type == 0 && ent.contains("polyline")) {
            // LWPOLYLINE: polyline = [[x,y], ...]
            const auto& pts = ent["polyline"];
            if (pts.is_array() && pts.size() >= 2) {
                emit(0, "LWPOLYLINE");
                emit(8, layerName);
                // Check closed: first point == last point
                bool closed = false;
                if (pts.size() >= 3) {
                    double x0 = pts[0][0].get<double>(), y0 = pts[0][1].get<double>();
                    double xn = pts.back()[0].get<double>(), yn = pts.back()[1].get<double>();
                    if (std::abs(x0 - xn) < 1e-9 && std::abs(y0 - yn) < 1e-9) {
                        closed = true;
                    }
                }
                emiti(70, closed ? 1 : 0);
                // If closed, the DXF convention is to NOT repeat the last point
                size_t count = closed ? pts.size() - 1 : pts.size();
                for (size_t i = 0; i < count; ++i) {
                    emitd(10, pts[i][0].get<double>());
                    emitd(20, pts[i][1].get<double>());
                }
            }
        }
        else if (type == 4 && ent.contains("circle")) {
            // CIRCLE: circle = {c:[x,y], r}
            const auto& c = ent["circle"];
            emit(0, "CIRCLE");
            emit(8, layerName);
            emitd(10, c["c"][0].get<double>());
            emitd(20, c["c"][1].get<double>());
            emitd(40, c["r"].get<double>());
        }
        else if (type == 3 && ent.contains("arc")) {
            // ARC: arc = {c:[x,y], r, a0, a1, cw}
            const auto& a = ent["arc"];
            emit(0, "ARC");
            emit(8, layerName);
            emitd(10, a["c"][0].get<double>());
            emitd(20, a["c"][1].get<double>());
            emitd(40, a["r"].get<double>());
            // DXF ARC uses degrees; internal model uses radians
            double a0 = a.value("a0", 0.0) * 180.0 / M_PI;
            double a1 = a.value("a1", 0.0) * 180.0 / M_PI;
            emitd(50, a0);
            emitd(51, a1);
        }
        else if (type == 7 && ent.contains("text")) {
            // TEXT: text = {pos:[x,y], h, rot, value}
            const auto& t = ent["text"];
            emit(0, "TEXT");
            emit(8, layerName);
            emitd(10, t["pos"][0].get<double>());
            emitd(20, t["pos"][1].get<double>());
            emitd(40, t.value("h", 2.5));
            double rot = t.value("rot", 0.0) * 180.0 / M_PI;
            if (std::abs(rot) > 1e-9) {
                emitd(50, rot);
            }
            emit(1, t.value("value", ""));
        }
        // Types 5 (ellipse) and 6 (spline) are skipped for now
    }

    emit(0, "ENDSEC");
    emit(0, "EOF");
    return out.str();
}

} // namespace dxf_writer
