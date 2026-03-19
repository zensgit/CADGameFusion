#include "core/plugin_abi_c_v1.h"

#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

#ifndef M_PI
#define M_PI 3.14159265358979323846
#endif

static cadgf_string_view sv(const char* s) {
    cadgf_string_view v;
    v.data = s;
    v.size = s ? static_cast<int32_t>(std::strlen(s)) : 0;
    return v;
}

static void set_error(cadgf_error_v1* err, int32_t code, const char* msg) {
    if (!err) return;
    err->code = code;
    if (!msg) { err->message[0] = 0; return; }
    std::snprintf(err->message, sizeof(err->message), "%s", msg);
    err->message[sizeof(err->message) - 1] = 0;
}

// --- Helpers: emit DXF group codes ---

static void emit(FILE* f, int code, const char* val) {
    std::fprintf(f, "%d\n%s\n", code, val);
}

static void emitd(FILE* f, int code, double val) {
    char buf[64];
    std::snprintf(buf, sizeof(buf), "%g", val);
    emit(f, code, buf);
}

static void emiti(FILE* f, int code, int val) {
    char buf[32];
    std::snprintf(buf, sizeof(buf), "%d", val);
    emit(f, code, buf);
}

// --- Helpers: query strings via two-call pattern ---

static std::string query_layer_name_utf8(const cadgf_document* doc, int layer_id) {
    int required = 0;
    if (!cadgf_document_get_layer_name(doc, layer_id, nullptr, 0, &required) || required <= 0) return {};
    std::vector<char> buf(static_cast<size_t>(required));
    if (!cadgf_document_get_layer_name(doc, layer_id, buf.data(), required, &required)) return {};
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return std::string(buf.begin(), buf.end());
}

static std::string query_entity_line_type(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    if (!cadgf_document_get_entity_line_type(doc, id, nullptr, 0, &required) || required <= 0) return {};
    std::vector<char> buf(static_cast<size_t>(required));
    if (!cadgf_document_get_entity_line_type(doc, id, buf.data(), required, &required)) return {};
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return std::string(buf.begin(), buf.end());
}

static std::string query_entity_color_source(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    if (!cadgf_document_get_entity_color_source(doc, id, nullptr, 0, &required) || required <= 0) return {};
    std::vector<char> buf(static_cast<size_t>(required));
    if (!cadgf_document_get_entity_color_source(doc, id, buf.data(), required, &required)) return {};
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return std::string(buf.begin(), buf.end());
}

static bool query_polyline_points(const cadgf_document* doc, cadgf_entity_id id, std::vector<cadgf_vec2>& out) {
    int required = 0;
    if (!cadgf_document_get_polyline_points(doc, id, nullptr, 0, &required) || required <= 0) return false;
    out.resize(static_cast<size_t>(required));
    int required2 = 0;
    if (!cadgf_document_get_polyline_points(doc, id, out.data(), required, &required2) || required2 <= 0) return false;
    if (required2 < required) out.resize(static_cast<size_t>(required2));
    return true;
}

// --- Emit entity style group codes (6=linetype, 48=ltscale, 62=color_aci, 370=lineweight, 420=truecolor) ---

static void emit_entity_style(FILE* f, const cadgf_document* doc, cadgf_entity_id id) {
    std::string lt = query_entity_line_type(doc, id);
    if (!lt.empty()) emit(f, 6, lt.c_str());

    double lts = 0.0;
    if (cadgf_document_get_entity_line_type_scale(doc, id, &lts) && std::fabs(lts - 1.0) > 1e-9) {
        emitd(f, 48, lts);
    }

    int aci = 0;
    if (cadgf_document_get_entity_color_aci(doc, id, &aci) && aci != 0) {
        emiti(f, 62, aci);
    } else {
        std::string cs = query_entity_color_source(doc, id);
        if (cs == "TRUECOLOR") {
            cadgf_entity_info_v2 info2{};
            if (cadgf_document_get_entity_info_v2(doc, id, &info2) && info2.color != 0) {
                emiti(f, 420, static_cast<int>(info2.color));
            }
        }
    }

    double lw = 0.0;
    if (cadgf_document_get_entity_line_weight(doc, id, &lw) && lw > 0.0) {
        emiti(f, 370, static_cast<int>(std::round(lw * 100.0)));
    }
}

// --- Write TABLES section (layers) ---

static void write_tables_section(FILE* f, const cadgf_document* doc) {
    emit(f, 0, "SECTION");
    emit(f, 2, "TABLES");
    emit(f, 0, "TABLE");
    emit(f, 2, "LAYER");

    int layer_count = 0;
    cadgf_document_get_layer_count(doc, &layer_count);
    emiti(f, 70, layer_count);

    for (int i = 0; i < layer_count; ++i) {
        int layer_id = 0;
        if (!cadgf_document_get_layer_id_at(doc, i, &layer_id)) continue;

        cadgf_layer_info_v2 info{};
        cadgf_document_get_layer_info_v2(doc, layer_id, &info);
        std::string name = query_layer_name_utf8(doc, layer_id);
        if (name.empty()) name = "0";

        emit(f, 0, "LAYER");
        emit(f, 2, name.c_str());

        // Layer flags: 1=frozen, 4=locked
        int flags = 0;
        if (info.frozen) flags |= 1;
        if (info.locked) flags |= 4;
        emiti(f, 70, flags);

        // Color: negative ACI = layer off (not visible)
        int aci = 7; // default white
        if (!info.visible) aci = -std::abs(aci);
        emiti(f, 62, aci);
    }

    emit(f, 0, "ENDTAB");
    emit(f, 0, "ENDSEC");
}

// --- Resolve layer name for entity ---

static std::string resolve_layer_name(const cadgf_document* doc, int entity_layer_id) {
    std::string name = query_layer_name_utf8(doc, entity_layer_id);
    return name.empty() ? "0" : name;
}

// --- Write ENTITIES section ---

static void write_entities_section(FILE* f, const cadgf_document* doc) {
    emit(f, 0, "SECTION");
    emit(f, 2, "ENTITIES");

    int entity_count = 0;
    cadgf_document_get_entity_count(doc, &entity_count);

    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id eid = 0;
        if (!cadgf_document_get_entity_id_at(doc, i, &eid)) continue;

        cadgf_entity_info info{};
        if (!cadgf_document_get_entity_info(doc, eid, &info)) continue;

        std::string layer = resolve_layer_name(doc, info.layer_id);

        switch (info.type) {
        case CADGF_ENTITY_TYPE_POINT: {
            cadgf_point pt{};
            if (!cadgf_document_get_point(doc, eid, &pt)) break;
            emit(f, 0, "POINT");
            emit(f, 8, layer.c_str());
            emit_entity_style(f, doc, eid);
            emitd(f, 10, pt.p.x);
            emitd(f, 20, pt.p.y);
            break;
        }
        case CADGF_ENTITY_TYPE_LINE: {
            cadgf_line ld{};
            if (!cadgf_document_get_line(doc, eid, &ld)) break;
            emit(f, 0, "LINE");
            emit(f, 8, layer.c_str());
            emit_entity_style(f, doc, eid);
            emitd(f, 10, ld.a.x);
            emitd(f, 20, ld.a.y);
            emitd(f, 11, ld.b.x);
            emitd(f, 21, ld.b.y);
            break;
        }
        case CADGF_ENTITY_TYPE_ARC: {
            cadgf_arc ad{};
            if (!cadgf_document_get_arc(doc, eid, &ad)) break;
            emit(f, 0, "ARC");
            emit(f, 8, layer.c_str());
            emit_entity_style(f, doc, eid);
            emitd(f, 10, ad.center.x);
            emitd(f, 20, ad.center.y);
            emitd(f, 40, ad.radius);
            emitd(f, 50, ad.start_angle * 180.0 / M_PI);
            emitd(f, 51, ad.end_angle * 180.0 / M_PI);
            break;
        }
        case CADGF_ENTITY_TYPE_CIRCLE: {
            cadgf_circle cd{};
            if (!cadgf_document_get_circle(doc, eid, &cd)) break;
            emit(f, 0, "CIRCLE");
            emit(f, 8, layer.c_str());
            emit_entity_style(f, doc, eid);
            emitd(f, 10, cd.center.x);
            emitd(f, 20, cd.center.y);
            emitd(f, 40, cd.radius);
            break;
        }
        case CADGF_ENTITY_TYPE_ELLIPSE: {
            cadgf_ellipse ed{};
            if (!cadgf_document_get_ellipse(doc, eid, &ed)) break;
            double rx = ed.rx > 0.0 ? ed.rx : 1.0;
            emit(f, 0, "ELLIPSE");
            emit(f, 8, layer.c_str());
            emit_entity_style(f, doc, eid);
            emitd(f, 10, ed.center.x);
            emitd(f, 20, ed.center.y);
            emitd(f, 11, rx * std::cos(ed.rotation));
            emitd(f, 21, rx * std::sin(ed.rotation));
            emitd(f, 40, ed.ry / rx);
            emitd(f, 41, ed.start_angle);
            emitd(f, 42, ed.end_angle);
            break;
        }
        case CADGF_ENTITY_TYPE_SPLINE: {
            int ctrl_count = 0, knot_count = 0, degree = 0;
            if (!cadgf_document_get_spline(doc, eid, nullptr, 0, &ctrl_count,
                                            nullptr, 0, &knot_count, &degree)) break;
            if (ctrl_count < 2) break;
            std::vector<cadgf_vec2> ctrl(static_cast<size_t>(ctrl_count));
            std::vector<double> knots(static_cast<size_t>(knot_count));
            int rc = 0, rk = 0, rd = 0;
            if (!cadgf_document_get_spline(doc, eid, ctrl.data(), ctrl_count, &rc,
                                            knots.data(), knot_count, &rk, &rd)) break;
            emit(f, 0, "SPLINE");
            emit(f, 8, layer.c_str());
            emit_entity_style(f, doc, eid);
            emiti(f, 71, degree);
            emiti(f, 74, ctrl_count);
            emiti(f, 72, knot_count);
            for (int k = 0; k < knot_count; ++k) emitd(f, 40, knots[static_cast<size_t>(k)]);
            for (int c = 0; c < ctrl_count; ++c) {
                emitd(f, 10, ctrl[static_cast<size_t>(c)].x);
                emitd(f, 20, ctrl[static_cast<size_t>(c)].y);
            }
            break;
        }
        case CADGF_ENTITY_TYPE_TEXT: {
            cadgf_vec2 pos{};
            double height = 0, rotation = 0;
            char text_buf[4096] = {};
            int req = 0;
            if (!cadgf_document_get_text(doc, eid, &pos, &height, &rotation,
                                          text_buf, sizeof(text_buf), &req)) break;
            emit(f, 0, "TEXT");
            emit(f, 8, layer.c_str());
            emit_entity_style(f, doc, eid);
            emitd(f, 10, pos.x);
            emitd(f, 20, pos.y);
            emitd(f, 40, height);
            double rot_deg = rotation * 180.0 / M_PI;
            if (std::fabs(rot_deg) > 1e-9) emitd(f, 50, rot_deg);
            emit(f, 1, text_buf);
            break;
        }
        case CADGF_ENTITY_TYPE_POLYLINE: {
            std::vector<cadgf_vec2> pts;
            if (!query_polyline_points(doc, eid, pts) || pts.empty()) break;
            // Single-point polyline → emit as DXF POINT
            if (pts.size() == 1) {
                emit(f, 0, "POINT");
                emit(f, 8, layer.c_str());
                emit_entity_style(f, doc, eid);
                emitd(f, 10, pts[0].x);
                emitd(f, 20, pts[0].y);
                break;
            }
            emit(f, 0, "LWPOLYLINE");
            emit(f, 8, layer.c_str());
            emit_entity_style(f, doc, eid);
            // Check closed: first point == last point
            bool closed = false;
            if (pts.size() >= 3) {
                double dx = pts.front().x - pts.back().x;
                double dy = pts.front().y - pts.back().y;
                if (std::fabs(dx) < 1e-9 && std::fabs(dy) < 1e-9) closed = true;
            }
            emiti(f, 70, closed ? 1 : 0);
            size_t count = closed ? pts.size() - 1 : pts.size();
            for (size_t j = 0; j < count; ++j) {
                emitd(f, 10, pts[j].x);
                emitd(f, 20, pts[j].y);
            }
            break;
        }
        default:
            break;
        }
    }

    emit(f, 0, "ENDSEC");
}

// --- Plugin export function ---

static int32_t exporter_export_document(const cadgf_document* doc,
                                        const char* path_utf8,
                                        const cadgf_export_options_v1* options,
                                        cadgf_error_v1* out_err) {
    (void)options;
    if (!doc || !path_utf8 || !*path_utf8) {
        set_error(out_err, 1, "invalid args");
        return 0;
    }

    try {
        FILE* f = std::fopen(path_utf8, "wb");
        if (!f) {
            set_error(out_err, 2, "failed to open output file");
            return 0;
        }

        write_tables_section(f, doc);
        write_entities_section(f, doc);
        emit(f, 0, "EOF");

        std::fclose(f);
        set_error(out_err, 0, "");
        return 1;
    } catch (...) {
        set_error(out_err, 3, "exception during export");
        return 0;
    }
}

// --- Plugin ABI boilerplate ---

static cadgf_string_view exporter_name(void) { return sv("DXF Exporter"); }
static cadgf_string_view exporter_extension(void) { return sv("dxf"); }
static cadgf_string_view exporter_filetype_desc(void) { return sv("DXF (*.dxf)"); }

static const cadgf_exporter_api_v1* get_exporter(int32_t index);
static const cadgf_importer_api_v1* get_importer(int32_t index);

static cadgf_exporter_api_v1 g_exporter = {
    static_cast<int32_t>(sizeof(cadgf_exporter_api_v1)),
    exporter_name,
    exporter_extension,
    exporter_filetype_desc,
    exporter_export_document,
};

static cadgf_plugin_desc_v1 plugin_describe_impl(void) {
    cadgf_plugin_desc_v1 d{};
    d.size = static_cast<int32_t>(sizeof(cadgf_plugin_desc_v1));
    d.name = sv("CADGameFusion DXF Exporter");
    d.version = sv("0.1.0");
    d.description = sv("DXF exporter plugin implementing cadgf_plugin_api_v1");
    return d;
}

static int32_t plugin_initialize(void) { return 1; }
static void plugin_shutdown(void) {}

static int32_t plugin_exporter_count(void) { return 1; }
static const cadgf_exporter_api_v1* get_exporter(int32_t index) { return (index == 0) ? &g_exporter : nullptr; }

static int32_t plugin_importer_count(void) { return 0; }
static const cadgf_importer_api_v1* get_importer(int32_t index) { (void)index; return nullptr; }

static cadgf_plugin_api_v1 g_api = {
    static_cast<int32_t>(sizeof(cadgf_plugin_api_v1)),
    CADGF_PLUGIN_ABI_V1,
    plugin_describe_impl,
    plugin_initialize,
    plugin_shutdown,
    plugin_exporter_count,
    get_exporter,
    plugin_importer_count,
    get_importer,
};

extern "C" CADGF_PLUGIN_EXPORT const cadgf_plugin_api_v1* cadgf_plugin_get_api_v1(void) {
    return &g_api;
}
