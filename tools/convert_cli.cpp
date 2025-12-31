#include <algorithm>
#include <filesystem>
#include <iostream>
#include <limits>
#include <string>
#include <vector>
#include <utility>
#include <cstdio>
#include <cstring>

#include "core/core_c_api.h"
#include "plugin_registry.hpp"

#if defined(CADGF_HAS_TINYGLTF)
#define TINYGLTF_IMPLEMENTATION
#define STB_IMAGE_IMPLEMENTATION
#define STB_IMAGE_WRITE_IMPLEMENTATION
#include <tiny_gltf.h>
#endif

namespace fs = std::filesystem;

static constexpr int kDocumentSchemaVersion = 1;

struct ConvertOptions {
    std::string pluginPath;
    std::string inputPath;
    std::string outDir = "build/convert_out";
    bool emitJson = false;
    bool emitGltf = false;
};

struct MeshSlice {
    cadgf_entity_id id{};
    int layerId{};
    std::string name;
    std::string lineType;
    double lineWeight{};
    double lineTypeScale{};
    uint32_t baseVertex{};
    uint32_t vertexCount{};
    uint32_t indexOffset{};
    uint32_t indexCount{};
};

static void usage(const char* argv0) {
    std::cerr << "Usage: " << argv0 << " --plugin <path> --input <file> [--out <dir>] [--json] [--gltf]\n";
}

static bool parse_args(int argc, char** argv, ConvertOptions* opts) {
    if (!opts) return false;
    bool saw_format = false;
    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "--plugin" && i + 1 < argc) {
            opts->pluginPath = argv[++i];
        } else if (arg == "--input" && i + 1 < argc) {
            opts->inputPath = argv[++i];
        } else if (arg == "--out" && i + 1 < argc) {
            opts->outDir = argv[++i];
        } else if (arg == "--json") {
            opts->emitJson = true;
            saw_format = true;
        } else if (arg == "--gltf") {
            opts->emitGltf = true;
            saw_format = true;
        } else if (arg == "--help" || arg == "-h") {
            return false;
        } else {
            std::cerr << "Unknown arg: " << arg << "\n";
            return false;
        }
    }
    if (!saw_format) {
        opts->emitJson = true;
        opts->emitGltf = true;
    }
    return !(opts->pluginPath.empty() || opts->inputPath.empty());
}

static void json_write_escaped(FILE* f, const char* s, size_t n) {
    std::fputc('"', f);
    for (size_t i = 0; i < n; ++i) {
        const unsigned char c = static_cast<unsigned char>(s[i]);
        switch (c) {
            case '"': std::fputs("\\\"", f); break;
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

static std::string query_layer_name_utf8(const cadgf_document* doc, int layer_id) {
    int required = 0;
    if (!cadgf_document_get_layer_name(doc, layer_id, nullptr, 0, &required) || required <= 0) return {};
    std::vector<char> buf(static_cast<size_t>(required));
    if (!cadgf_document_get_layer_name(doc, layer_id, buf.data(), required, &required)) return {};
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return std::string(buf.begin(), buf.end());
}

static std::string query_entity_name_utf8(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    if (!cadgf_document_get_entity_name(doc, id, nullptr, 0, &required) || required <= 0) return {};
    std::vector<char> buf(static_cast<size_t>(required));
    if (!cadgf_document_get_entity_name(doc, id, buf.data(), required, &required)) return {};
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return std::string(buf.begin(), buf.end());
}

static std::string query_entity_line_type_utf8(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    if (!cadgf_document_get_entity_line_type(doc, id, nullptr, 0, &required) || required <= 0) return {};
    std::vector<char> buf(static_cast<size_t>(required));
    if (!cadgf_document_get_entity_line_type(doc, id, buf.data(), required, &required)) return {};
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return std::string(buf.begin(), buf.end());
}

static std::string query_entity_color_source_utf8(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    if (!cadgf_document_get_entity_color_source(doc, id, nullptr, 0, &required) || required <= 0) return {};
    std::vector<char> buf(static_cast<size_t>(required));
    if (!cadgf_document_get_entity_color_source(doc, id, buf.data(), required, &required)) return {};
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return std::string(buf.begin(), buf.end());
}

static bool query_entity_color_aci(const cadgf_document* doc, cadgf_entity_id id, int* out_aci) {
    if (!out_aci) return false;
    return cadgf_document_get_entity_color_aci(doc, id, out_aci) != 0;
}

using DocStringGetter = int (*)(const cadgf_document*, char*, int, int*);

static std::string query_doc_string_utf8(const cadgf_document* doc, DocStringGetter getter) {
    int required = 0;
    if (!getter || !getter(doc, nullptr, 0, &required) || required <= 0) return {};
    std::vector<char> buf(static_cast<size_t>(required));
    if (!getter(doc, buf.data(), required, &required)) return {};
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return std::string(buf.begin(), buf.end());
}

static std::vector<std::pair<std::string, std::string>> query_doc_meta_pairs(const cadgf_document* doc) {
    std::vector<std::pair<std::string, std::string>> out;
    int count = 0;
    if (!cadgf_document_get_meta_count(doc, &count) || count <= 0) return out;
    out.reserve(static_cast<size_t>(count));
    for (int i = 0; i < count; ++i) {
        int required = 0;
        if (!cadgf_document_get_meta_key_at(doc, i, nullptr, 0, &required) || required <= 0) continue;
        std::vector<char> key_buf(static_cast<size_t>(required));
        int required2 = 0;
        if (!cadgf_document_get_meta_key_at(doc, i, key_buf.data(), static_cast<int>(key_buf.size()), &required2)) continue;
        if (!key_buf.empty() && key_buf.back() == 0) key_buf.pop_back();
        std::string key(key_buf.begin(), key_buf.end());
        if (key.empty()) continue;

        int val_required = 0;
        if (!cadgf_document_get_meta_value(doc, key.c_str(), nullptr, 0, &val_required) || val_required <= 0) continue;
        std::vector<char> val_buf(static_cast<size_t>(val_required));
        int val_required2 = 0;
        if (!cadgf_document_get_meta_value(doc, key.c_str(), val_buf.data(), static_cast<int>(val_buf.size()), &val_required2)) continue;
        if (!val_buf.empty() && val_buf.back() == 0) val_buf.pop_back();
        out.emplace_back(std::move(key), std::string(val_buf.begin(), val_buf.end()));
    }
    return out;
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

static bool write_document_json(const cadgf_document* doc, const std::string& path, std::string* err) {
    FILE* f = std::fopen(path.c_str(), "wb");
    if (!f) {
        if (err) *err = "failed to open output JSON";
        return false;
    }

    const unsigned int feats = cadgf_get_feature_flags();
    std::fprintf(f, "{\n");
    std::fprintf(f, "  \"cadgf_version\": ");
    json_write_escaped(f, cadgf_get_version(), std::strlen(cadgf_get_version()));
    std::fprintf(f, ",\n");
    std::fprintf(f, "  \"schema_version\": %d,\n", kDocumentSchemaVersion);
    std::fprintf(f, "  \"feature_flags\": {\"earcut\": %s, \"clipper2\": %s},\n",
                 (feats & CADGF_FEATURE_EARCUT) ? "true" : "false",
                 (feats & CADGF_FEATURE_CLIPPER2) ? "true" : "false");

    const std::string label = query_doc_string_utf8(doc, cadgf_document_get_label);
    const std::string author = query_doc_string_utf8(doc, cadgf_document_get_author);
    const std::string company = query_doc_string_utf8(doc, cadgf_document_get_company);
    const std::string comment = query_doc_string_utf8(doc, cadgf_document_get_comment);
    const std::string created_at = query_doc_string_utf8(doc, cadgf_document_get_created_at);
    const std::string modified_at = query_doc_string_utf8(doc, cadgf_document_get_modified_at);
    const std::string unit_name = query_doc_string_utf8(doc, cadgf_document_get_unit_name);
    const auto meta_pairs = query_doc_meta_pairs(doc);
    const double unit_scale = cadgf_document_get_unit_scale(doc);

    std::fprintf(f, "  \"metadata\": {\n");
    std::fprintf(f, "    \"label\": ");
    json_write_escaped(f, label.c_str(), label.size());
    std::fprintf(f, ",\n    \"author\": ");
    json_write_escaped(f, author.c_str(), author.size());
    std::fprintf(f, ",\n    \"company\": ");
    json_write_escaped(f, company.c_str(), company.size());
    std::fprintf(f, ",\n    \"comment\": ");
    json_write_escaped(f, comment.c_str(), comment.size());
    std::fprintf(f, ",\n    \"created_at\": ");
    json_write_escaped(f, created_at.c_str(), created_at.size());
    std::fprintf(f, ",\n    \"modified_at\": ");
    json_write_escaped(f, modified_at.c_str(), modified_at.size());
    std::fprintf(f, ",\n    \"unit_name\": ");
    json_write_escaped(f, unit_name.c_str(), unit_name.size());
    std::fprintf(f, ",\n    \"meta\": {");
    for (size_t i = 0; i < meta_pairs.size(); ++i) {
        const auto& kv = meta_pairs[i];
        std::fprintf(f, "%s", (i ? ", " : ""));
        json_write_escaped(f, kv.first.c_str(), kv.first.size());
        std::fprintf(f, ": ");
        json_write_escaped(f, kv.second.c_str(), kv.second.size());
    }
    std::fprintf(f, "}\n  },\n");

    std::fprintf(f, "  \"settings\": {\"unit_scale\": %.6f},\n", unit_scale);

    int layer_count = 0;
    (void)cadgf_document_get_layer_count(doc, &layer_count);
    std::fprintf(f, "  \"layers\": [\n");
    for (int i = 0; i < layer_count; ++i) {
        int layer_id = 0;
        if (!cadgf_document_get_layer_id_at(doc, i, &layer_id)) continue;
        cadgf_layer_info_v2 info{};
        bool got_info = cadgf_document_get_layer_info_v2(doc, layer_id, &info) != 0;
        if (!got_info) {
            cadgf_layer_info legacy{};
            if (cadgf_document_get_layer_info(doc, layer_id, &legacy)) {
                info.id = legacy.id;
                info.color = legacy.color;
                info.visible = legacy.visible;
                info.locked = legacy.locked;
                info.printable = 1;
                info.frozen = 0;
                info.construction = 0;
                got_info = true;
            }
        }
        if (!got_info) continue;
        const std::string name = query_layer_name_utf8(doc, layer_id);
        std::fprintf(f, "    {\"id\": %d, \"name\": ", layer_id);
        json_write_escaped(f, name.c_str(), name.size());
        std::fprintf(f, ", \"color\": %u, \"visible\": %d, \"locked\": %d",
                     info.color, info.visible, info.locked);
        std::fprintf(f, ", \"printable\": %d, \"frozen\": %d, \"construction\": %d}%s\n",
                     info.printable, info.frozen, info.construction,
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
        const std::string line_type = query_entity_line_type_utf8(doc, eid);
        const std::string color_source = query_entity_color_source_utf8(doc, eid);
        double line_weight = 0.0;
        double line_scale = 0.0;
        int color_aci = 0;
        const bool has_line_weight = cadgf_document_get_entity_line_weight(doc, eid, &line_weight) && line_weight != 0.0;
        const bool has_line_scale = cadgf_document_get_entity_line_type_scale(doc, eid, &line_scale) && line_scale != 0.0;
        const bool has_line_type = !line_type.empty();
        const bool has_color_aci = query_entity_color_aci(doc, eid, &color_aci);

        std::fprintf(f, "    {\"id\": %llu, \"type\": %d, \"layer_id\": %d, \"name\": ",
                     static_cast<unsigned long long>(eid), info.type, info.layer_id);
        json_write_escaped(f, name.c_str(), name.size());
        if (has_line_type) {
            std::fprintf(f, ", \"line_type\": ");
            json_write_escaped(f, line_type.c_str(), line_type.size());
        }
        if (has_line_weight) {
            std::fprintf(f, ", \"line_weight\": %.6f", line_weight);
        }
        if (has_line_scale) {
            std::fprintf(f, ", \"line_type_scale\": %.6f", line_scale);
        }
        if (!color_source.empty()) {
            std::fprintf(f, ", \"color_source\": ");
            json_write_escaped(f, color_source.c_str(), color_source.size());
        }
        if (has_color_aci) {
            std::fprintf(f, ", \"color_aci\": %d", color_aci);
        }

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
        } else if (info.type == CADGF_ENTITY_TYPE_POINT) {
            cadgf_point pt{};
            if (cadgf_document_get_point(doc, eid, &pt)) {
                std::fprintf(f, ", \"point\": [%.6f, %.6f]", pt.p.x, pt.p.y);
            }
        } else if (info.type == CADGF_ENTITY_TYPE_LINE) {
            cadgf_line ln{};
            if (cadgf_document_get_line(doc, eid, &ln)) {
                std::fprintf(f, ", \"line\": [[%.6f, %.6f], [%.6f, %.6f]]",
                             ln.a.x, ln.a.y, ln.b.x, ln.b.y);
            }
        } else if (info.type == CADGF_ENTITY_TYPE_ARC) {
            cadgf_arc arc{};
            if (cadgf_document_get_arc(doc, eid, &arc)) {
                std::fprintf(f, ", \"arc\": {\"c\": [%.6f, %.6f], \"r\": %.6f, \"a0\": %.6f, \"a1\": %.6f, \"cw\": %d}",
                             arc.center.x, arc.center.y, arc.radius, arc.start_angle, arc.end_angle, arc.clockwise);
            }
        } else if (info.type == CADGF_ENTITY_TYPE_CIRCLE) {
            cadgf_circle circle{};
            if (cadgf_document_get_circle(doc, eid, &circle)) {
                std::fprintf(f, ", \"circle\": {\"c\": [%.6f, %.6f], \"r\": %.6f}",
                             circle.center.x, circle.center.y, circle.radius);
            }
        } else if (info.type == CADGF_ENTITY_TYPE_ELLIPSE) {
            cadgf_ellipse ellipse{};
            if (cadgf_document_get_ellipse(doc, eid, &ellipse)) {
                std::fprintf(f, ", \"ellipse\": {\"c\": [%.6f, %.6f], \"rx\": %.6f, \"ry\": %.6f, \"rot\": %.6f, \"a0\": %.6f, \"a1\": %.6f}",
                             ellipse.center.x, ellipse.center.y, ellipse.rx, ellipse.ry,
                             ellipse.rotation, ellipse.start_angle, ellipse.end_angle);
            }
        } else if (info.type == CADGF_ENTITY_TYPE_SPLINE) {
            int required_ctrl = 0;
            int required_knots = 0;
            int degree = 0;
            if (cadgf_document_get_spline(doc, eid, nullptr, 0, &required_ctrl,
                                          nullptr, 0, &required_knots, &degree) &&
                required_ctrl > 0) {
                std::vector<cadgf_vec2> control(static_cast<size_t>(required_ctrl));
                std::vector<double> knots(static_cast<size_t>(required_knots));
                cadgf_vec2* control_ptr = control.empty() ? nullptr : control.data();
                double* knots_ptr = knots.empty() ? nullptr : knots.data();
                int required_ctrl2 = required_ctrl;
                int required_knots2 = required_knots;
                int degree2 = degree;
                if (cadgf_document_get_spline(doc, eid, control_ptr, required_ctrl,
                                              &required_ctrl2, knots_ptr, required_knots,
                                              &required_knots2, &degree2)) {
                    std::fprintf(f, ", \"spline\": {\"degree\": %d, \"control\": [", degree2);
                    for (size_t j = 0; j < control.size(); ++j) {
                        const cadgf_vec2 p = control[j];
                        std::fprintf(f, "%s[%.6f, %.6f]", (j ? "," : ""), p.x, p.y);
                    }
                    std::fprintf(f, "], \"knots\": [");
                    for (size_t j = 0; j < knots.size(); ++j) {
                        std::fprintf(f, "%s%.6f", (j ? "," : ""), knots[j]);
                    }
                    std::fprintf(f, "]}");
                }
            }
        } else if (info.type == CADGF_ENTITY_TYPE_TEXT) {
            int required = 0;
            cadgf_vec2 pos{};
            double height = 0.0;
            double rotation = 0.0;
            if (cadgf_document_get_text(doc, eid, &pos, &height, &rotation,
                                        nullptr, 0, &required) && required > 0) {
                std::vector<char> buf(static_cast<size_t>(required));
                int required2 = 0;
                if (cadgf_document_get_text(doc, eid, &pos, &height, &rotation,
                                            buf.data(), static_cast<int>(buf.size()), &required2)) {
                    if (!buf.empty() && buf.back() == 0) buf.pop_back();
                    std::fprintf(f, ", \"text\": {\"pos\": [%.6f, %.6f], \"h\": %.6f, \"rot\": %.6f, \"value\": ",
                                 pos.x, pos.y, height, rotation);
                    json_write_escaped(f, buf.data(), buf.size());
                    std::fprintf(f, "}");
                }
            }
        }

        std::fprintf(f, "}%s\n", (i + 1 < entity_count) ? "," : "");
    }
    std::fprintf(f, "  ]\n");
    std::fprintf(f, "}\n");
    std::fclose(f);
    return true;
}

static bool write_mesh_metadata(const std::string& path,
                                const std::string& gltf_path,
                                const std::string& bin_path,
                                const std::vector<MeshSlice>& slices,
                                std::string* err) {
    FILE* f = std::fopen(path.c_str(), "wb");
    if (!f) {
        if (err) *err = "failed to open metadata JSON";
        return false;
    }

    const std::string gltf_name = fs::path(gltf_path).filename().string();
    const std::string bin_name = fs::path(bin_path).filename().string();
    std::fprintf(f, "{\n");
    std::fprintf(f, "  \"gltf\": ");
    json_write_escaped(f, gltf_name.c_str(), gltf_name.size());
    std::fprintf(f, ",\n  \"bin\": ");
    json_write_escaped(f, bin_name.c_str(), bin_name.size());
    std::fprintf(f, ",\n  \"entities\": [\n");
    for (size_t i = 0; i < slices.size(); ++i) {
        const auto& s = slices[i];
        std::fprintf(f, "    {\"id\": %llu, \"name\": ", static_cast<unsigned long long>(s.id));
        json_write_escaped(f, s.name.c_str(), s.name.size());
        std::fprintf(f, ", \"layer_id\": %d", s.layerId);
        if (!s.lineType.empty()) {
            std::fprintf(f, ", \"line_type\": ");
            json_write_escaped(f, s.lineType.c_str(), s.lineType.size());
        }
        if (s.lineWeight != 0.0) {
            std::fprintf(f, ", \"line_weight\": %.6f", s.lineWeight);
        }
        if (s.lineTypeScale != 0.0) {
            std::fprintf(f, ", \"line_type_scale\": %.6f", s.lineTypeScale);
        }
        std::fprintf(f, ", \"base_vertex\": %u, \"vertex_count\": %u, \"index_offset\": %u, \"index_count\": %u}%s\n",
                     s.baseVertex, s.vertexCount, s.indexOffset, s.indexCount,
                     (i + 1 < slices.size()) ? "," : "");
    }
    std::fprintf(f, "  ]\n}\n");
    std::fclose(f);
    return true;
}

static void strip_closing_point(std::vector<cadgf_vec2>& pts) {
    if (pts.size() < 2) return;
    const cadgf_vec2& first = pts.front();
    const cadgf_vec2& last = pts.back();
    if (first.x == last.x && first.y == last.y) {
        pts.pop_back();
    }
}

#if defined(CADGF_HAS_TINYGLTF)
static tinygltf::Value build_cadgf_extras(const cadgf_document* doc) {
    using Value = tinygltf::Value;
    Value::Object root;
    Value::Object cadgf;
    Value::Object doc_meta;

    const std::string label = query_doc_string_utf8(doc, cadgf_document_get_label);
    const std::string author = query_doc_string_utf8(doc, cadgf_document_get_author);
    const std::string company = query_doc_string_utf8(doc, cadgf_document_get_company);
    const std::string comment = query_doc_string_utf8(doc, cadgf_document_get_comment);
    const std::string created_at = query_doc_string_utf8(doc, cadgf_document_get_created_at);
    const std::string modified_at = query_doc_string_utf8(doc, cadgf_document_get_modified_at);
    const std::string unit_name = query_doc_string_utf8(doc, cadgf_document_get_unit_name);
    const double unit_scale = cadgf_document_get_unit_scale(doc);
    const auto meta_pairs = query_doc_meta_pairs(doc);

    doc_meta["label"] = Value(label);
    doc_meta["author"] = Value(author);
    doc_meta["company"] = Value(company);
    doc_meta["comment"] = Value(comment);
    doc_meta["created_at"] = Value(created_at);
    doc_meta["modified_at"] = Value(modified_at);
    doc_meta["unit_name"] = Value(unit_name);
    doc_meta["unit_scale"] = Value(unit_scale);

    Value::Object meta_obj;
    for (const auto& kv : meta_pairs) {
        meta_obj[kv.first] = Value(kv.second);
    }
    doc_meta["meta"] = Value(meta_obj);
    cadgf["document"] = Value(doc_meta);

    int layer_count = 0;
    (void)cadgf_document_get_layer_count(doc, &layer_count);
    Value::Array layers;
    layers.reserve(static_cast<size_t>(std::max(0, layer_count)));
    for (int i = 0; i < layer_count; ++i) {
        int layer_id = 0;
        if (!cadgf_document_get_layer_id_at(doc, i, &layer_id)) continue;
        cadgf_layer_info_v2 info{};
        if (!cadgf_document_get_layer_info_v2(doc, layer_id, &info)) continue;
        Value::Object layer_obj;
        layer_obj["id"] = Value(layer_id);
        layer_obj["name"] = Value(query_layer_name_utf8(doc, layer_id));
        layer_obj["color"] = Value(static_cast<int>(info.color));
        layer_obj["visible"] = Value(info.visible != 0);
        layer_obj["locked"] = Value(info.locked != 0);
        layer_obj["printable"] = Value(info.printable != 0);
        layer_obj["frozen"] = Value(info.frozen != 0);
        layer_obj["construction"] = Value(info.construction != 0);
        layers.push_back(Value(layer_obj));
    }
    cadgf["layers"] = Value(layers);

    root["cadgf"] = Value(cadgf);
    return Value(root);
}

static bool write_gltf(const std::string& gltf_path,
                       const std::string& bin_path,
                       const std::vector<float>& positions,
                       const std::vector<uint32_t>& indices,
                       const cadgf_document* doc,
                       std::string* err) {
    if (positions.empty() || indices.empty()) {
        if (err) *err = "no mesh data";
        return false;
    }

    tinygltf::Model model;
    tinygltf::Scene scene;
    tinygltf::Mesh mesh;
    tinygltf::Primitive prim;
    model.asset.version = "2.0";
    model.asset.generator = "CADGameFusion_Convert_CLI";

    tinygltf::Buffer buffer;
    const size_t pos_bytes = positions.size() * sizeof(float);
    const size_t idx_bytes = indices.size() * sizeof(uint32_t);
    buffer.data.resize(pos_bytes + idx_bytes);
    std::memcpy(buffer.data.data(), positions.data(), pos_bytes);
    std::memcpy(buffer.data.data() + pos_bytes, indices.data(), idx_bytes);
    buffer.uri = fs::path(bin_path).filename().string();
    model.buffers.push_back(buffer);

    tinygltf::BufferView pos_view;
    pos_view.buffer = 0;
    pos_view.byteOffset = 0;
    pos_view.byteLength = pos_bytes;
    pos_view.target = TINYGLTF_TARGET_ARRAY_BUFFER;
    const int pos_view_idx = static_cast<int>(model.bufferViews.size());
    model.bufferViews.push_back(pos_view);

    tinygltf::BufferView idx_view;
    idx_view.buffer = 0;
    idx_view.byteOffset = pos_bytes;
    idx_view.byteLength = idx_bytes;
    idx_view.target = TINYGLTF_TARGET_ELEMENT_ARRAY_BUFFER;
    const int idx_view_idx = static_cast<int>(model.bufferViews.size());
    model.bufferViews.push_back(idx_view);

    float min_x = std::numeric_limits<float>::max();
    float min_y = std::numeric_limits<float>::max();
    float min_z = std::numeric_limits<float>::max();
    float max_x = std::numeric_limits<float>::lowest();
    float max_y = std::numeric_limits<float>::lowest();
    float max_z = std::numeric_limits<float>::lowest();
    for (size_t i = 0; i + 2 < positions.size(); i += 3) {
        const float x = positions[i];
        const float y = positions[i + 1];
        const float z = positions[i + 2];
        min_x = std::min(min_x, x);
        min_y = std::min(min_y, y);
        min_z = std::min(min_z, z);
        max_x = std::max(max_x, x);
        max_y = std::max(max_y, y);
        max_z = std::max(max_z, z);
    }

    tinygltf::Accessor pos_accessor;
    pos_accessor.bufferView = pos_view_idx;
    pos_accessor.byteOffset = 0;
    pos_accessor.componentType = TINYGLTF_COMPONENT_TYPE_FLOAT;
    pos_accessor.count = positions.size() / 3;
    pos_accessor.type = TINYGLTF_TYPE_VEC3;
    pos_accessor.minValues = {min_x, min_y, min_z};
    pos_accessor.maxValues = {max_x, max_y, max_z};
    const int pos_accessor_idx = static_cast<int>(model.accessors.size());
    model.accessors.push_back(pos_accessor);

    tinygltf::Accessor idx_accessor;
    idx_accessor.bufferView = idx_view_idx;
    idx_accessor.byteOffset = 0;
    idx_accessor.componentType = TINYGLTF_COMPONENT_TYPE_UNSIGNED_INT;
    idx_accessor.count = indices.size();
    idx_accessor.type = TINYGLTF_TYPE_SCALAR;
    const int idx_accessor_idx = static_cast<int>(model.accessors.size());
    model.accessors.push_back(idx_accessor);

    prim.attributes["POSITION"] = pos_accessor_idx;
    prim.indices = idx_accessor_idx;
    prim.mode = TINYGLTF_MODE_TRIANGLES;
    mesh.primitives.push_back(prim);
    if (doc) {
        mesh.extras = build_cadgf_extras(doc);
    }
    model.meshes.push_back(mesh);

    tinygltf::Node node;
    node.mesh = 0;
    if (doc) {
        node.extras = build_cadgf_extras(doc);
    }
    model.nodes.push_back(node);
    scene.nodes.push_back(0);
    model.scenes.push_back(scene);
    model.defaultScene = 0;

    tinygltf::TinyGLTF gltf;
    if (!gltf.WriteGltfSceneToFile(&model, gltf_path, false, false, true, false)) {
        if (err) *err = "failed to write glTF";
        return false;
    }
    return true;
}
#endif

int main(int argc, char** argv) {
    const int abi = cadgf_get_abi_version();
    if (abi != CADGF_ABI_VERSION) {
        std::cerr << "[ERROR] CADGF core ABI mismatch. Expected " << CADGF_ABI_VERSION
                  << ", got " << abi << "." << std::endl;
        return 42;
    }

    ConvertOptions opts;
    if (!parse_args(argc, argv, &opts)) {
        usage(argv[0]);
        return 1;
    }

    if (!fs::exists(opts.inputPath)) {
        std::cerr << "Input not found: " << opts.inputPath << "\n";
        return 1;
    }

    cadgf::PluginRegistry registry;
    std::string err;
    if (!registry.load_plugin(opts.pluginPath, &err)) {
        std::cerr << "Failed to load plugin: " << opts.pluginPath << "\n";
        std::cerr << "  Error: " << err << "\n";
        return 1;
    }

    std::string ext = fs::path(opts.inputPath).extension().string();
    const cadgf_importer_api_v1* importer = nullptr;
    if (!ext.empty()) {
        importer = registry.find_importer_by_extension(ext);
    }
    if (!importer) {
        auto all = registry.importers();
        if (!all.empty()) importer = all.front();
    }
    if (!importer) {
        std::cerr << "No importer found in plugin.\n";
        return 1;
    }

    cadgf_document* doc = cadgf_document_create();
    if (!doc) {
        std::cerr << "cadgf_document_create failed\n";
        return 1;
    }

    cadgf_error_v1 outErr{};
    outErr.code = 0;
    outErr.message[0] = 0;
    if (!importer->import_to_document(doc, opts.inputPath.c_str(), &outErr)) {
        std::cerr << "import_to_document failed (code=" << outErr.code << "): " << outErr.message << "\n";
        cadgf_document_destroy(doc);
        return 1;
    }

    fs::create_directories(opts.outDir);
    const std::string json_path = (fs::path(opts.outDir) / "document.json").string();
    const std::string gltf_path = (fs::path(opts.outDir) / "mesh.gltf").string();
    const std::string bin_path = (fs::path(opts.outDir) / "mesh.bin").string();

    if (opts.emitJson) {
        if (!write_document_json(doc, json_path, &err)) {
            std::cerr << "JSON export failed: " << err << "\n";
            cadgf_document_destroy(doc);
            return 1;
        }
    }

    if (opts.emitGltf) {
#if defined(CADGF_HAS_TINYGLTF)
        std::vector<float> positions;
        std::vector<uint32_t> indices;
        std::vector<MeshSlice> slices;
        int entity_count = 0;
        (void)cadgf_document_get_entity_count(doc, &entity_count);
        for (int i = 0; i < entity_count; ++i) {
            cadgf_entity_id eid = 0;
            if (!cadgf_document_get_entity_id_at(doc, i, &eid)) continue;
            cadgf_entity_info info{};
            (void)cadgf_document_get_entity_info(doc, eid, &info);
            if (info.type != CADGF_ENTITY_TYPE_POLYLINE) continue;

            std::vector<cadgf_vec2> pts;
            if (!query_polyline_points(doc, eid, pts)) continue;
            strip_closing_point(pts);
            if (pts.size() < 3) continue;

            int index_count = 0;
            if (!cadgf_triangulate_polygon(pts.data(), static_cast<int>(pts.size()), nullptr, &index_count) || index_count <= 0) {
                continue;
            }
            std::vector<unsigned int> local_indices(static_cast<size_t>(index_count));
            int index_count2 = index_count;
            if (!cadgf_triangulate_polygon(pts.data(), static_cast<int>(pts.size()), local_indices.data(), &index_count2) || index_count2 <= 0) {
                continue;
            }

            const uint32_t base = static_cast<uint32_t>(positions.size() / 3);
            const uint32_t index_offset = static_cast<uint32_t>(indices.size());
            for (const auto& p : pts) {
                positions.push_back(static_cast<float>(p.x));
                positions.push_back(static_cast<float>(p.y));
                positions.push_back(0.0f);
            }
            for (int k = 0; k < index_count2; ++k) {
                indices.push_back(base + static_cast<uint32_t>(local_indices[static_cast<size_t>(k)]));
            }

            MeshSlice slice;
            slice.id = eid;
            slice.layerId = info.layer_id;
            slice.name = query_entity_name_utf8(doc, eid);
            slice.lineType = query_entity_line_type_utf8(doc, eid);
            (void)cadgf_document_get_entity_line_weight(doc, eid, &slice.lineWeight);
            (void)cadgf_document_get_entity_line_type_scale(doc, eid, &slice.lineTypeScale);
            slice.baseVertex = base;
            slice.vertexCount = static_cast<uint32_t>(pts.size());
            slice.indexOffset = index_offset;
            slice.indexCount = static_cast<uint32_t>(index_count2);
            slices.push_back(slice);
        }

        if (!write_gltf(gltf_path, bin_path, positions, indices, doc, &err)) {
            std::cerr << "glTF export failed: " << err << "\n";
            cadgf_document_destroy(doc);
            return 1;
        }

        const std::string meta_path = (fs::path(opts.outDir) / "mesh_metadata.json").string();
        if (!write_mesh_metadata(meta_path, gltf_path, bin_path, slices, &err)) {
            std::cerr << "metadata export failed: " << err << "\n";
            cadgf_document_destroy(doc);
            return 1;
        }
#else
        std::cerr << "[WARN] TinyGLTF not available; skipping glTF export.\n";
#endif
    }

    cadgf_document_destroy(doc);
    std::cout << "Converted: " << opts.inputPath << " -> " << opts.outDir << "\n";
    return 0;
}
