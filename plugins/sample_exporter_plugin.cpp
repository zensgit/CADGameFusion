#include "core/plugin_abi_c_v1.h"

#include <cstdio>
#include <cstring>
#include <string>
#include <vector>

static cadgf_string_view sv(const char* s) {
    cadgf_string_view v;
    v.data = s;
    v.size = s ? static_cast<int32_t>(std::strlen(s)) : 0;
    return v;
}

static void set_error(cadgf_error_v1* err, int32_t code, const char* msg) {
    if (!err) return;
    err->code = code;
    if (!msg) {
        err->message[0] = 0;
        return;
    }
    std::snprintf(err->message, sizeof(err->message), "%s", msg);
    err->message[sizeof(err->message) - 1] = 0;
}

static void json_write_escaped(FILE* f, const char* s, size_t n) {
    std::fputc('"', f);
    for (size_t i = 0; i < n; ++i) {
        const unsigned char c = static_cast<unsigned char>(s[i]);
        switch (c) {
            case '\"': std::fputs("\\\"", f); break;
            case '\\': std::fputs("\\\\", f); break;
            case '\n': std::fputs("\\n", f); break;
            case '\r': std::fputs("\\r", f); break;
            case '\t': std::fputs("\\t", f); break;
            default:
                if (c < 0x20) {
                    std::fprintf(f, "\\u%04x", static_cast<unsigned int>(c));
                } else {
                    std::fputc(static_cast<int>(c), f);
                }
        }
    }
    std::fputc('"', f);
}

static std::string query_entity_name_utf8(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    if (!cadgf_document_get_entity_name(doc, id, nullptr, 0, &required) || required <= 0) return std::string();
    std::vector<char> buf(static_cast<size_t>(required));
    if (!cadgf_document_get_entity_name(doc, id, buf.data(), required, &required)) return std::string();
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return std::string(buf.begin(), buf.end());
}

static std::string query_layer_name_utf8(const cadgf_document* doc, int layer_id) {
    int required = 0;
    if (!cadgf_document_get_layer_name(doc, layer_id, nullptr, 0, &required) || required <= 0) return std::string();
    std::vector<char> buf(static_cast<size_t>(required));
    if (!cadgf_document_get_layer_name(doc, layer_id, buf.data(), required, &required)) return std::string();
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

        const unsigned int feats = cadgf_get_feature_flags();
        std::fprintf(f, "{\n");
        std::fprintf(f, "  \"cadgf_version\": ");
        json_write_escaped(f, cadgf_get_version(), std::strlen(cadgf_get_version()));
        std::fprintf(f, ",\n");
        std::fprintf(f, "  \"feature_flags\": {\"earcut\": %s, \"clipper2\": %s},\n",
                     (feats & CADGF_FEATURE_EARCUT) ? "true" : "false",
                     (feats & CADGF_FEATURE_CLIPPER2) ? "true" : "false");

        int layer_count = 0;
        (void)cadgf_document_get_layer_count(doc, &layer_count);
        std::fprintf(f, "  \"layers\": [\n");
        for (int i = 0; i < layer_count; ++i) {
            int layer_id = 0;
            if (!cadgf_document_get_layer_id_at(doc, i, &layer_id)) continue;
            cadgf_layer_info info{};
            (void)cadgf_document_get_layer_info(doc, layer_id, &info);
            const std::string name = query_layer_name_utf8(doc, layer_id);

            std::fprintf(f, "    {\"id\": %d, \"name\": ", layer_id);
            json_write_escaped(f, name.c_str(), name.size());
            std::fprintf(f, ", \"color\": %u, \"visible\": %d, \"locked\": %d}%s\n",
                         info.color, info.visible, info.locked,
                         (i + 1 < layer_count) ? "," : "");
        }
        std::fprintf(f, "  ],\n");

        int entity_count = 0;
        (void)cadgf_document_get_entity_count(doc, &entity_count);
        std::fprintf(f, "  \"entities\": [\n");
        for (int i = 0; i < entity_count; ++i) {
            cadgf_entity_id eid = 0;
            if (!cadgf_document_get_entity_id_at(doc, i, &eid)) continue;
            cadgf_entity_info info{};
            (void)cadgf_document_get_entity_info(doc, eid, &info);
            const std::string name = query_entity_name_utf8(doc, eid);

            std::fprintf(f, "    {\"id\": %llu, \"type\": %d, \"layer_id\": %d, \"name\": ",
                         static_cast<unsigned long long>(eid), info.type, info.layer_id);
            json_write_escaped(f, name.c_str(), name.size());

            if (info.type == CADGF_ENTITY_TYPE_POLYLINE) {
                std::vector<cadgf_vec2> pts;
                if (query_polyline_points(doc, eid, pts)) {
                    std::fprintf(f, ", \"polyline\": [");
                    for (size_t j = 0; j < pts.size(); ++j) {
                        const cadgf_vec2 p = pts[j];
                        std::fprintf(f, "%s[%.6f, %.6f]", (j ? "," : ""), p.x, p.y);
                    }
                    std::fprintf(f, "]");
                }
            }

            std::fprintf(f, "}%s\n", (i + 1 < entity_count) ? "," : "");
        }
        std::fprintf(f, "  ]\n");
        std::fprintf(f, "}\n");
        std::fclose(f);

        set_error(out_err, 0, "");
        return 1;
    } catch (...) {
        set_error(out_err, 3, "exception during export");
        return 0;
    }
}

static cadgf_string_view exporter_name(void) { return sv("Sample JSON Exporter"); }
static cadgf_string_view exporter_extension(void) { return sv("json"); }
static cadgf_string_view exporter_filetype_desc(void) { return sv("JSON (*.json)"); }

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
    d.name = sv("CADGameFusion Sample Plugin");
    d.version = sv("0.1.0");
    d.description = sv("Sample exporter plugin implementing cadgf_plugin_api_v1");
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
