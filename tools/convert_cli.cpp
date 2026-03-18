#include <algorithm>
#include <array>
#include <cctype>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <ctime>
#include <exception>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <limits>
#include <map>
#include <string>
#include <unordered_map>
#include <vector>
#include <utility>
#include <cstdio>
#include <cstring>
#include <cstdlib>

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
static constexpr double kPi = 3.14159265358979323846;
static constexpr double kTwoPi = kPi * 2.0;

struct ConvertOptions {
    std::string pluginPath;
    std::string inputPath;
    std::string outDir = "build/convert_out";
    std::string projectId;
    std::string documentLabel;
    std::string documentId;
    bool emitJson = false;
    bool emitGltf = false;
    bool lineOnly = false;
};

struct MeshSlice {
    cadgf_entity_id id{};
    int layerId{};
    int groupId{-1};
    std::string layerName;
    std::string layoutName;
    std::string sourceType;
    std::string editMode;
    std::string proxyKind;
    std::string blockName;
    std::string hatchPattern;
    std::string dimStyle;
    uint32_t layerColor{};
    bool hasLayerColor{false};
    std::string name;
    uint32_t color{};
    std::string colorSource;
    int colorAci{};
    bool hasColorAci{false};
    int hatchId{};
    bool hasHatchId{false};
    int dimType{};
    bool hasDimType{false};
    std::string lineType;
    double lineWeight{};
    double lineTypeScale{};
    int space{-1};
    uint32_t baseVertex{};
    uint32_t vertexCount{};
    uint32_t indexOffset{};
    uint32_t indexCount{};
};

struct SpaceSummary {
    int space{-1};
    int documentEntityCount{};
    int meshEntityCount{};
    int lineEntityCount{};
};

struct ViewportMetadata {
    size_t index{};
    int space{-1};
    bool hasId{false};
    int id{};
    std::string layout;
    bool hasCenterX{false};
    double centerX{};
    bool hasCenterY{false};
    double centerY{};
    bool hasWidth{false};
    double width{};
    bool hasHeight{false};
    double height{};
    bool hasViewCenterX{false};
    double viewCenterX{};
    bool hasViewCenterY{false};
    double viewCenterY{};
    bool hasViewHeight{false};
    double viewHeight{};
    bool hasTwistDeg{false};
    double twistDeg{};
};

struct LayoutMetadata {
    std::string name;
    int space{-1};
    bool synthetic{false};
    bool isDefault{false};
    int viewportCount{};
    bool hasDocumentEntityCount{false};
    int documentEntityCount{};
    bool hasMeshEntityCount{false};
    int meshEntityCount{};
    bool hasLineEntityCount{false};
    int lineEntityCount{};
};

struct InstanceMetadata {
    int groupId{-1};
    std::string blockName;
    std::string sourceType;
    std::string editMode;
    std::string proxyKind;
    int space{-1};
    std::string layoutName;
    std::vector<cadgf_entity_id> entityIds;
    int documentEntityCount{};
    int meshEntityCount{};
    int lineEntityCount{};
};

struct BlockMetadata {
    std::string name;
    int instanceCount{};
    int documentEntityCount{};
    int meshEntityCount{};
    int lineEntityCount{};
    int proxyEntityCount{};
};

struct ManifestWarning {
    std::string code;
    std::string message;
};

struct ArtifactManifestEntry {
    const char* key{};
    const char* filename{};
    const char* output_name{};
    bool emitted{false};
    std::string sha256;
    uintmax_t size{};
};

static void usage(const char* argv0) {
    std::cerr << "Usage: " << argv0
              << " --plugin <path> --input <file> [--out <dir>] [--json] [--gltf]"
              << " [--project-id <id>] [--document-label <label>] [--document-id <id>] [--line-only]\n";
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
        } else if (arg == "--project-id" && i + 1 < argc) {
            opts->projectId = argv[++i];
        } else if (arg == "--document-label" && i + 1 < argc) {
            opts->documentLabel = argv[++i];
        } else if (arg == "--document-id" && i + 1 < argc) {
            opts->documentId = argv[++i];
        } else if (arg == "--json") {
            opts->emitJson = true;
            saw_format = true;
        } else if (arg == "--gltf") {
            opts->emitGltf = true;
            saw_format = true;
        } else if (arg == "--line-only") {
            opts->lineOnly = true;
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

static std::string trim_ascii(std::string value);
static std::string encode_document_id(const std::string& project_id, const std::string& document_label);

class Sha256 {
public:
    Sha256() { reset(); }

    void update(const uint8_t* data, size_t len) {
        if (!data || len == 0) return;
        bit_count_ += static_cast<uint64_t>(len) * 8u;
        size_t offset = 0;
        while (offset < len) {
            const size_t copy = std::min(len - offset, block_.size() - block_size_);
            std::memcpy(block_.data() + block_size_, data + offset, copy);
            block_size_ += copy;
            offset += copy;
            if (block_size_ == block_.size()) {
                process_block(block_.data());
                block_size_ = 0;
            }
        }
    }

    void update(const char* data, size_t len) {
        update(reinterpret_cast<const uint8_t*>(data), len);
    }

    std::string finalize_hex() {
        block_[block_size_++] = 0x80u;
        if (block_size_ > 56) {
            std::fill(block_.begin() + static_cast<std::ptrdiff_t>(block_size_), block_.end(), 0u);
            process_block(block_.data());
            block_size_ = 0;
        }
        std::fill(block_.begin() + static_cast<std::ptrdiff_t>(block_size_), block_.begin() + 56, 0u);
        for (size_t i = 0; i < 8; ++i) {
            block_[63 - i] = static_cast<uint8_t>((bit_count_ >> (i * 8u)) & 0xffu);
        }
        process_block(block_.data());
        block_size_ = 0;

        static constexpr char kHex[] = "0123456789abcdef";
        std::string out(64, '0');
        for (size_t i = 0; i < state_.size(); ++i) {
            const uint32_t word = state_[i];
            out[i * 8 + 0] = kHex[(word >> 28) & 0x0fu];
            out[i * 8 + 1] = kHex[(word >> 24) & 0x0fu];
            out[i * 8 + 2] = kHex[(word >> 20) & 0x0fu];
            out[i * 8 + 3] = kHex[(word >> 16) & 0x0fu];
            out[i * 8 + 4] = kHex[(word >> 12) & 0x0fu];
            out[i * 8 + 5] = kHex[(word >> 8) & 0x0fu];
            out[i * 8 + 6] = kHex[(word >> 4) & 0x0fu];
            out[i * 8 + 7] = kHex[word & 0x0fu];
        }
        return out;
    }

private:
    static uint32_t rotr(uint32_t value, uint32_t bits) {
        return (value >> bits) | (value << (32u - bits));
    }

    static uint32_t ch(uint32_t x, uint32_t y, uint32_t z) {
        return (x & y) ^ (~x & z);
    }

    static uint32_t maj(uint32_t x, uint32_t y, uint32_t z) {
        return (x & y) ^ (x & z) ^ (y & z);
    }

    static uint32_t big_sigma0(uint32_t x) {
        return rotr(x, 2u) ^ rotr(x, 13u) ^ rotr(x, 22u);
    }

    static uint32_t big_sigma1(uint32_t x) {
        return rotr(x, 6u) ^ rotr(x, 11u) ^ rotr(x, 25u);
    }

    static uint32_t small_sigma0(uint32_t x) {
        return rotr(x, 7u) ^ rotr(x, 18u) ^ (x >> 3u);
    }

    static uint32_t small_sigma1(uint32_t x) {
        return rotr(x, 17u) ^ rotr(x, 19u) ^ (x >> 10u);
    }

    void reset() {
        state_ = {
            0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
            0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u,
        };
        block_.fill(0u);
        block_size_ = 0;
        bit_count_ = 0;
    }

    void process_block(const uint8_t* block) {
        uint32_t schedule[64]{};
        for (size_t i = 0; i < 16; ++i) {
            const size_t offset = i * 4;
            schedule[i] =
                (static_cast<uint32_t>(block[offset]) << 24) |
                (static_cast<uint32_t>(block[offset + 1]) << 16) |
                (static_cast<uint32_t>(block[offset + 2]) << 8) |
                static_cast<uint32_t>(block[offset + 3]);
        }
        for (size_t i = 16; i < 64; ++i) {
            schedule[i] = small_sigma1(schedule[i - 2]) + schedule[i - 7] +
                          small_sigma0(schedule[i - 15]) + schedule[i - 16];
        }

        uint32_t a = state_[0];
        uint32_t b = state_[1];
        uint32_t c = state_[2];
        uint32_t d = state_[3];
        uint32_t e = state_[4];
        uint32_t f = state_[5];
        uint32_t g = state_[6];
        uint32_t h = state_[7];

        for (size_t i = 0; i < 64; ++i) {
            const uint32_t temp1 = h + big_sigma1(e) + ch(e, f, g) + kRoundConstants[i] + schedule[i];
            const uint32_t temp2 = big_sigma0(a) + maj(a, b, c);
            h = g;
            g = f;
            f = e;
            e = d + temp1;
            d = c;
            c = b;
            b = a;
            a = temp1 + temp2;
        }

        state_[0] += a;
        state_[1] += b;
        state_[2] += c;
        state_[3] += d;
        state_[4] += e;
        state_[5] += f;
        state_[6] += g;
        state_[7] += h;
    }

    std::array<uint32_t, 8> state_{};
    std::array<uint8_t, 64> block_{};
    size_t block_size_{};
    uint64_t bit_count_{};

    static constexpr std::array<uint32_t, 64> kRoundConstants{{
        0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u, 0x923f82a4u, 0xab1c5ed5u,
        0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u, 0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u,
        0xe49b69c1u, 0xefbe4786u, 0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
        0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u, 0x06ca6351u, 0x14292967u,
        0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u, 0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u,
        0xa2bfe8a1u, 0xa81a664bu, 0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
        0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au, 0x5b9cca4fu, 0x682e6ff3u,
        0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u, 0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u,
    }};
};

static bool compute_file_sha256(const fs::path& path, std::string* out, std::string* err) {
    if (!out) return false;
    std::ifstream stream(path, std::ios::binary);
    if (!stream) {
        if (err) *err = "failed to open file for hashing: " + path.string();
        return false;
    }
    Sha256 sha;
    std::array<char, 1024 * 1024> buffer{};
    while (stream) {
        stream.read(buffer.data(), static_cast<std::streamsize>(buffer.size()));
        const std::streamsize got = stream.gcount();
        if (got > 0) {
            sha.update(buffer.data(), static_cast<size_t>(got));
        }
    }
    if (!stream.eof()) {
        if (err) *err = "failed while hashing file: " + path.string();
        return false;
    }
    *out = sha.finalize_hex();
    return true;
}

static bool utc_tm_from_time_t(std::time_t value, std::tm* out) {
    if (!out) return false;
#if defined(_WIN32)
    return gmtime_s(out, &value) == 0;
#else
    return gmtime_r(&value, out) != nullptr;
#endif
}

static std::string format_time_point_utc(std::chrono::system_clock::time_point tp) {
    const std::time_t raw = std::chrono::system_clock::to_time_t(tp);
    std::tm utc{};
    if (!utc_tm_from_time_t(raw, &utc)) {
        return {};
    }
    char buffer[32];
    std::snprintf(buffer, sizeof(buffer),
                  "%04d-%02d-%02dT%02d:%02d:%02dZ",
                  utc.tm_year + 1900, utc.tm_mon + 1, utc.tm_mday,
                  utc.tm_hour, utc.tm_min, utc.tm_sec);
    return buffer;
}

static std::chrono::system_clock::time_point filesystem_time_to_system_clock(fs::file_time_type tp) {
    return std::chrono::time_point_cast<std::chrono::system_clock::duration>(
        tp - fs::file_time_type::clock::now() + std::chrono::system_clock::now());
}

static bool query_file_size(const fs::path& path, uintmax_t* out) {
    if (!out) return false;
    std::error_code ec;
    const uintmax_t size = fs::file_size(path, ec);
    if (ec) {
        return false;
    }
    *out = size;
    return true;
}

static bool query_file_mtime_utc(const fs::path& path, std::string* out) {
    if (!out) return false;
    std::error_code ec;
    const fs::file_time_type mtime = fs::last_write_time(path, ec);
    if (ec) {
        return false;
    }
    *out = format_time_point_utc(filesystem_time_to_system_clock(mtime));
    return !out->empty();
}

static bool populate_artifact_manifest_entry(const fs::path& out_dir,
                                             ArtifactManifestEntry* artifact,
                                             std::string* err) {
    if (!artifact || !artifact->emitted || !artifact->filename) return true;
    const fs::path path = out_dir / artifact->filename;
    if (!fs::exists(path)) {
        if (err) *err = "expected artifact missing: " + path.string();
        return false;
    }
    if (!query_file_size(path, &artifact->size)) {
        if (err) *err = "failed to read artifact size: " + path.string();
        return false;
    }
    return compute_file_sha256(path, &artifact->sha256, err);
}

static bool write_manifest_json(const ConvertOptions& opts,
                                bool wrote_json,
                                bool wrote_gltf,
                                bool wrote_bin,
                                bool wrote_meta,
                                std::string* err) {
    const fs::path input_path = fs::absolute(fs::path(opts.inputPath));
    const fs::path plugin_path = fs::absolute(fs::path(opts.pluginPath));
    const fs::path out_dir = fs::absolute(fs::path(opts.outDir));
    const fs::path manifest_path = out_dir / "manifest.json";
    const char* cadgf_version = cadgf_get_version();
    const std::string project_id = trim_ascii(opts.projectId);
    const std::string document_label = trim_ascii(opts.documentLabel);
    std::string document_id = trim_ascii(opts.documentId);
    if (document_id.empty()) {
        document_id = encode_document_id(project_id, document_label);
    }

    uintmax_t input_size = 0;
    if (!query_file_size(input_path, &input_size)) {
        if (err) *err = "failed to read input size: " + input_path.string();
        return false;
    }

    std::string input_mtime;
    if (!query_file_mtime_utc(input_path, &input_mtime)) {
        if (err) *err = "failed to read input mtime: " + input_path.string();
        return false;
    }

    std::string source_hash;
    if (!compute_file_sha256(input_path, &source_hash, err)) {
        return false;
    }

    ArtifactManifestEntry artifacts[] = {
        {"document_json", "document.json", "json", wrote_json},
        {"mesh_gltf", "mesh.gltf", "gltf", wrote_gltf},
        {"mesh_bin", "mesh.bin", "gltf", wrote_bin},
        {"mesh_metadata", "mesh_metadata.json", "meta", wrote_meta},
    };
    for (auto& artifact : artifacts) {
        if (!populate_artifact_manifest_entry(out_dir, &artifact, err)) {
            return false;
        }
    }

    std::vector<std::string> outputs;
    for (const auto& artifact : artifacts) {
        if (!artifact.emitted || !artifact.output_name) continue;
        outputs.emplace_back(artifact.output_name);
    }
    std::sort(outputs.begin(), outputs.end());
    outputs.erase(std::unique(outputs.begin(), outputs.end()), outputs.end());

    std::vector<ManifestWarning> warnings;
    if (opts.emitJson && !wrote_json) {
        warnings.push_back({"document_json_missing", "document.json was requested but not produced"});
    }
    if (opts.emitGltf && (!wrote_gltf || !wrote_bin)) {
        warnings.push_back({"mesh_gltf_missing", "glTF export was requested but mesh.gltf or mesh.bin was not produced"});
    }
    if (opts.emitGltf && !wrote_meta) {
        warnings.push_back({"mesh_metadata_missing", "glTF export was requested but mesh_metadata.json was not produced"});
    }

    FILE* f = std::fopen(manifest_path.string().c_str(), "wb");
    if (!f) {
        if (err) *err = "failed to open manifest JSON";
        return false;
    }

    const std::string generated_at = format_time_point_utc(std::chrono::system_clock::now());
    std::fprintf(f, "{\n");
    std::fprintf(f, "  \"schema_version\": \"1\",\n");
    std::fprintf(f, "  \"input\": ");
    const std::string input_string = input_path.string();
    json_write_escaped(f, input_string.c_str(), input_string.size());
    std::fprintf(f, ",\n  \"input_size\": %llu,\n", static_cast<unsigned long long>(input_size));
    std::fprintf(f, "  \"input_mtime\": ");
    json_write_escaped(f, input_mtime.c_str(), input_mtime.size());
    std::fprintf(f, ",\n  \"source_hash\": ");
    json_write_escaped(f, source_hash.c_str(), source_hash.size());
    std::fprintf(f, ",\n  \"plugin\": ");
    const std::string plugin_string = plugin_path.string();
    json_write_escaped(f, plugin_string.c_str(), plugin_string.size());
    std::fprintf(f, ",\n  \"output_dir\": ");
    const std::string out_dir_string = out_dir.string();
    json_write_escaped(f, out_dir_string.c_str(), out_dir_string.size());
    std::fprintf(f, ",\n  \"output_layout\": \"legacy\",\n");
    std::fprintf(f, "  \"generated_at\": ");
    json_write_escaped(f, generated_at.c_str(), generated_at.size());
    std::fprintf(f, ",\n  \"cadgf_version\": ");
    json_write_escaped(f, cadgf_version, std::strlen(cadgf_version));
    if (!project_id.empty()) {
        std::fprintf(f, ",\n  \"project_id\": ");
        json_write_escaped(f, project_id.c_str(), project_id.size());
    }
    if (!document_label.empty()) {
        std::fprintf(f, ",\n  \"document_label\": ");
        json_write_escaped(f, document_label.c_str(), document_label.size());
    }
    if (!document_id.empty()) {
        std::fprintf(f, ",\n  \"document_id\": ");
        json_write_escaped(f, document_id.c_str(), document_id.size());
    }
    if (wrote_json) {
        std::fprintf(f, ",\n  \"document_schema_version\": %d", kDocumentSchemaVersion);
    }
    std::fprintf(f, ",\n  \"artifacts\": {\n");
    bool first = true;
    for (const auto& artifact : artifacts) {
        if (!artifact.emitted) continue;
        std::fprintf(f, "%s", first ? "" : ",\n");
        std::fprintf(f, "    ");
        json_write_escaped(f, artifact.key, std::strlen(artifact.key));
        std::fprintf(f, ": ");
        json_write_escaped(f, artifact.filename, std::strlen(artifact.filename));
        first = false;
    }
    if (!first) std::fprintf(f, "\n");
    std::fprintf(f, "  },\n");
    std::fprintf(f, "  \"content_hashes\": {\n");
    first = true;
    for (const auto& artifact : artifacts) {
        if (!artifact.emitted) continue;
        std::fprintf(f, "%s", first ? "" : ",\n");
        std::fprintf(f, "    ");
        json_write_escaped(f, artifact.key, std::strlen(artifact.key));
        std::fprintf(f, ": ");
        json_write_escaped(f, artifact.sha256.c_str(), artifact.sha256.size());
        first = false;
    }
    if (!first) std::fprintf(f, "\n");
    std::fprintf(f, "  },\n");
    std::fprintf(f, "  \"artifact_sizes\": {\n");
    first = true;
    for (const auto& artifact : artifacts) {
        if (!artifact.emitted) continue;
        std::fprintf(f, "%s", first ? "" : ",\n");
        std::fprintf(f, "    ");
        json_write_escaped(f, artifact.key, std::strlen(artifact.key));
        std::fprintf(f, ": %llu", static_cast<unsigned long long>(artifact.size));
        first = false;
    }
    if (!first) std::fprintf(f, "\n");
    std::fprintf(f, "  },\n");
    std::fprintf(f, "  \"tool_versions\": {\n");
    std::fprintf(f, "    \"plm_convert\": \"1\",\n");
    std::fprintf(f, "    \"cadgf\": ");
    json_write_escaped(f, cadgf_version, std::strlen(cadgf_version));
    std::fprintf(f, ",\n    \"convert_cli\": ");
    json_write_escaped(f, cadgf_version, std::strlen(cadgf_version));
    std::fprintf(f, "\n  },\n");
    std::fprintf(f, "  \"outputs\": [\n");
    for (size_t i = 0; i < outputs.size(); ++i) {
        std::fprintf(f, "    ");
        json_write_escaped(f, outputs[i].c_str(), outputs[i].size());
        std::fprintf(f, "%s\n", (i + 1 < outputs.size()) ? "," : "");
    }
    std::fprintf(f, "  ],\n");
    std::fprintf(f, "  \"warnings\": [\n");
    for (size_t i = 0; i < warnings.size(); ++i) {
        std::fprintf(f, "    {\"code\": ");
        json_write_escaped(f, warnings[i].code.c_str(), warnings[i].code.size());
        std::fprintf(f, ", \"message\": ");
        json_write_escaped(f, warnings[i].message.c_str(), warnings[i].message.size());
        std::fprintf(f, "}%s\n", (i + 1 < warnings.size()) ? "," : "");
    }
    std::fprintf(f, "  ],\n");
    std::fprintf(f, "  \"status\": %s\n", warnings.empty() ? "\"ok\"" : "\"partial\"");
    std::fprintf(f, "}\n");
    if (std::fflush(f) != 0 || std::ferror(f)) {
        if (err) *err = "write error while flushing manifest JSON";
        std::fclose(f);
        return false;
    }
    std::fclose(f);
    return true;
}

static bool is_valid_utf8(const std::string& value) {
    const unsigned char* data = reinterpret_cast<const unsigned char*>(value.data());
    size_t i = 0;
    while (i < value.size()) {
        unsigned char c = data[i];
        if (c <= 0x7Fu) {
            ++i;
            continue;
        }
        if ((c >> 5) == 0x6) {
            if (i + 1 >= value.size()) return false;
            unsigned char c1 = data[i + 1];
            if ((c1 & 0xC0u) != 0x80u) return false;
            if (c < 0xC2u) return false;
            i += 2;
            continue;
        }
        if ((c >> 4) == 0xE) {
            if (i + 2 >= value.size()) return false;
            unsigned char c1 = data[i + 1];
            unsigned char c2 = data[i + 2];
            if ((c1 & 0xC0u) != 0x80u || (c2 & 0xC0u) != 0x80u) return false;
            if (c == 0xE0u && c1 < 0xA0u) return false;
            if (c == 0xEDu && c1 >= 0xA0u) return false;
            i += 3;
            continue;
        }
        if ((c >> 3) == 0x1E) {
            if (i + 3 >= value.size()) return false;
            unsigned char c1 = data[i + 1];
            unsigned char c2 = data[i + 2];
            unsigned char c3 = data[i + 3];
            if ((c1 & 0xC0u) != 0x80u || (c2 & 0xC0u) != 0x80u || (c3 & 0xC0u) != 0x80u) return false;
            if (c == 0xF0u && c1 < 0x90u) return false;
            if (c == 0xF4u && c1 > 0x8Fu) return false;
            if (c > 0xF4u) return false;
            i += 4;
            continue;
        }
        return false;
    }
    return true;
}

static std::string latin1_to_utf8(const std::string& value) {
    std::string out;
    out.reserve(value.size() * 2);
    for (unsigned char c : value) {
        if (c < 0x80u) {
            out.push_back(static_cast<char>(c));
        } else {
            out.push_back(static_cast<char>(0xC0u | (c >> 6)));
            out.push_back(static_cast<char>(0x80u | (c & 0x3Fu)));
        }
    }
    return out;
}

static std::string sanitize_utf8(const std::string& value) {
    if (value.empty() || is_valid_utf8(value)) {
        return value;
    }
    return latin1_to_utf8(value);
}

static std::string trim_ascii(std::string value) {
    const auto is_space = [](unsigned char c) { return std::isspace(c) != 0; };
    value.erase(value.begin(), std::find_if(value.begin(), value.end(), [&](char c) {
        return !is_space(static_cast<unsigned char>(c));
    }));
    value.erase(std::find_if(value.rbegin(), value.rend(), [&](char c) {
        return !is_space(static_cast<unsigned char>(c));
    }).base(), value.end());
    return value;
}

static std::string encode_document_id(const std::string& project_id, const std::string& document_label) {
    if (project_id.empty() || document_label.empty()) {
        return {};
    }
    static constexpr char kBase64Url[] =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    const std::string raw = project_id + "\n" + document_label;
    std::string out;
    out.reserve(((raw.size() + 2) / 3) * 4);
    size_t i = 0;
    while (i + 3 <= raw.size()) {
        const uint32_t block =
            (static_cast<uint32_t>(static_cast<unsigned char>(raw[i])) << 16) |
            (static_cast<uint32_t>(static_cast<unsigned char>(raw[i + 1])) << 8) |
            static_cast<uint32_t>(static_cast<unsigned char>(raw[i + 2]));
        out.push_back(kBase64Url[(block >> 18) & 0x3fu]);
        out.push_back(kBase64Url[(block >> 12) & 0x3fu]);
        out.push_back(kBase64Url[(block >> 6) & 0x3fu]);
        out.push_back(kBase64Url[block & 0x3fu]);
        i += 3;
    }
    const size_t remaining = raw.size() - i;
    if (remaining == 1) {
        const uint32_t block = static_cast<uint32_t>(static_cast<unsigned char>(raw[i])) << 16;
        out.push_back(kBase64Url[(block >> 18) & 0x3fu]);
        out.push_back(kBase64Url[(block >> 12) & 0x3fu]);
    } else if (remaining == 2) {
        const uint32_t block =
            (static_cast<uint32_t>(static_cast<unsigned char>(raw[i])) << 16) |
            (static_cast<uint32_t>(static_cast<unsigned char>(raw[i + 1])) << 8);
        out.push_back(kBase64Url[(block >> 18) & 0x3fu]);
        out.push_back(kBase64Url[(block >> 12) & 0x3fu]);
        out.push_back(kBase64Url[(block >> 6) & 0x3fu]);
    }
    return out;
}

static std::string query_layer_name_utf8(const cadgf_document* doc, int layer_id) {
    int required = 0;
    if (!cadgf_document_get_layer_name(doc, layer_id, nullptr, 0, &required) || required <= 0) return {};
    std::vector<char> buf(static_cast<size_t>(required));
    if (!cadgf_document_get_layer_name(doc, layer_id, buf.data(), required, &required)) return {};
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return sanitize_utf8(std::string(buf.begin(), buf.end()));
}

static std::string query_entity_name_utf8(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    if (!cadgf_document_get_entity_name(doc, id, nullptr, 0, &required) || required <= 0) return {};
    std::vector<char> buf(static_cast<size_t>(required));
    if (!cadgf_document_get_entity_name(doc, id, buf.data(), required, &required)) return {};
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return sanitize_utf8(std::string(buf.begin(), buf.end()));
}

static std::string query_entity_line_type_utf8(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    if (!cadgf_document_get_entity_line_type(doc, id, nullptr, 0, &required) || required <= 0) return {};
    std::vector<char> buf(static_cast<size_t>(required));
    if (!cadgf_document_get_entity_line_type(doc, id, buf.data(), required, &required)) return {};
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return sanitize_utf8(std::string(buf.begin(), buf.end()));
}

static std::string query_entity_color_source_utf8(const cadgf_document* doc, cadgf_entity_id id) {
    int required = 0;
    if (!cadgf_document_get_entity_color_source(doc, id, nullptr, 0, &required) || required <= 0) return {};
    std::vector<char> buf(static_cast<size_t>(required));
    if (!cadgf_document_get_entity_color_source(doc, id, buf.data(), required, &required)) return {};
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    return sanitize_utf8(std::string(buf.begin(), buf.end()));
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
    return sanitize_utf8(std::string(buf.begin(), buf.end()));
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
        std::string key = sanitize_utf8(std::string(key_buf.begin(), key_buf.end()));
        if (key.empty()) continue;

        int val_required = 0;
        if (!cadgf_document_get_meta_value(doc, key.c_str(), nullptr, 0, &val_required) || val_required <= 0) continue;
        std::vector<char> val_buf(static_cast<size_t>(val_required));
        int val_required2 = 0;
        if (!cadgf_document_get_meta_value(doc, key.c_str(), val_buf.data(), static_cast<int>(val_buf.size()), &val_required2)) continue;
        if (!val_buf.empty() && val_buf.back() == 0) val_buf.pop_back();
        out.emplace_back(std::move(key), sanitize_utf8(std::string(val_buf.begin(), val_buf.end())));
    }
    return out;
}

static bool query_doc_meta_value(const cadgf_document* doc, const std::string& key, std::string* out) {
    if (!doc || !out || key.empty()) return false;
    int required = 0;
    if (!cadgf_document_get_meta_value(doc, key.c_str(), nullptr, 0, &required) || required <= 0) {
        return false;
    }
    std::vector<char> buf(static_cast<size_t>(required));
    int required2 = 0;
    if (!cadgf_document_get_meta_value(doc, key.c_str(), buf.data(), static_cast<int>(buf.size()), &required2)) {
        return false;
    }
    if (!buf.empty() && buf.back() == 0) buf.pop_back();
    *out = sanitize_utf8(std::string(buf.begin(), buf.end()));
    return !out->empty();
}

static bool query_entity_meta_value(const cadgf_document* doc,
                                    cadgf_entity_id id,
                                    const char* suffix,
                                    std::string* out) {
    if (!suffix || !*suffix) return false;
    const std::string key = "dxf.entity." + std::to_string(static_cast<unsigned long long>(id)) + "." + suffix;
    return query_doc_meta_value(doc, key, out);
}

static bool parse_meta_int(const std::string& value, int* out) {
    if (!out) return false;
    char* end = nullptr;
    const long parsed = std::strtol(value.c_str(), &end, 10);
    if (!end || end == value.c_str()) return false;
    *out = static_cast<int>(parsed);
    return true;
}

static bool parse_meta_double(const std::string& value, double* out) {
    if (!out) return false;
    char* end = nullptr;
    const double parsed = std::strtod(value.c_str(), &end);
    if (!end || end == value.c_str()) return false;
    *out = parsed;
    return true;
}

static bool query_doc_meta_int(const cadgf_document* doc, const std::string& key, int* out) {
    std::string value;
    return query_doc_meta_value(doc, key, &value) && parse_meta_int(value, out);
}

static bool query_doc_meta_double(const cadgf_document* doc, const std::string& key, double* out) {
    std::string value;
    return query_doc_meta_value(doc, key, &value) && parse_meta_double(value, out);
}

static int query_entity_space(const cadgf_document* doc, cadgf_entity_id id) {
    std::string value;
    const std::string key = "dxf.entity." + std::to_string(static_cast<unsigned long long>(id)) + ".space";
    if (!query_doc_meta_value(doc, key, &value)) return -1;
    char* end = nullptr;
    const long parsed = std::strtol(value.c_str(), &end, 10);
    if (!end || end == value.c_str()) return -1;
    if (parsed != 0 && parsed != 1) return -1;
    return static_cast<int>(parsed);
}

static std::string query_entity_layout_name(const cadgf_document* doc, cadgf_entity_id id) {
    std::string value;
    if (!query_entity_meta_value(doc, id, "layout", &value)) {
        return {};
    }
    return value;
}

static std::map<int, int> count_document_entities_by_space(const cadgf_document* doc) {
    std::map<int, int> counts;
    int entity_count = 0;
    if (!cadgf_document_get_entity_count(doc, &entity_count) || entity_count <= 0) {
        return counts;
    }
    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id eid = 0;
        if (!cadgf_document_get_entity_id_at(doc, i, &eid)) continue;
        const int space = query_entity_space(doc, eid);
        counts[space] += 1;
    }
    return counts;
}

static std::map<std::string, int> count_document_entities_by_layout(const cadgf_document* doc) {
    std::map<std::string, int> counts;
    int entity_count = 0;
    if (!cadgf_document_get_entity_count(doc, &entity_count) || entity_count <= 0) {
        return counts;
    }
    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id eid = 0;
        if (!cadgf_document_get_entity_id_at(doc, i, &eid)) continue;
        const std::string layout_name = query_entity_layout_name(doc, eid);
        if (layout_name.empty()) continue;
        counts[layout_name] += 1;
    }
    return counts;
}

static std::map<int, int> count_mesh_slices_by_space(const std::vector<MeshSlice>& slices) {
    std::map<int, int> counts;
    for (const auto& slice : slices) {
        counts[slice.space] += 1;
    }
    return counts;
}

static std::map<std::string, int> count_mesh_slices_by_layout(const std::vector<MeshSlice>& slices) {
    std::map<std::string, int> counts;
    for (const auto& slice : slices) {
        if (slice.layoutName.empty()) continue;
        counts[slice.layoutName] += 1;
    }
    return counts;
}

static int find_count_for_space(const std::map<int, int>& counts, int space) {
    const auto it = counts.find(space);
    return it == counts.end() ? 0 : it->second;
}

static bool find_count_for_layout(const std::map<std::string, int>& counts,
                                  const std::string& layout_name,
                                  int* out) {
    if (!out || layout_name.empty()) return false;
    const auto it = counts.find(layout_name);
    if (it == counts.end()) return false;
    *out = it->second;
    return true;
}

static std::vector<SpaceSummary> build_space_summaries(const cadgf_document* doc,
                                                       const std::vector<MeshSlice>& slices,
                                                       const std::vector<MeshSlice>* line_slices) {
    const auto doc_counts = count_document_entities_by_space(doc);
    const auto mesh_counts = count_mesh_slices_by_space(slices);
    const auto line_counts = line_slices ? count_mesh_slices_by_space(*line_slices) : std::map<int, int>{};
    std::map<int, SpaceSummary> merged;
    const auto merge_keys = [&](const std::map<int, int>& counts) {
        for (const auto& kv : counts) {
            merged[kv.first].space = kv.first;
        }
    };
    merge_keys(doc_counts);
    merge_keys(mesh_counts);
    merge_keys(line_counts);
    for (auto& kv : merged) {
        kv.second.documentEntityCount = find_count_for_space(doc_counts, kv.first);
        kv.second.meshEntityCount = find_count_for_space(mesh_counts, kv.first);
        kv.second.lineEntityCount = find_count_for_space(line_counts, kv.first);
    }
    std::vector<SpaceSummary> out;
    out.reserve(merged.size());
    for (const auto& kv : merged) {
        out.push_back(kv.second);
    }
    return out;
}

static const SpaceSummary* find_space_summary(const std::vector<SpaceSummary>& summaries, int space) {
    for (const auto& item : summaries) {
        if (item.space == space) return &item;
    }
    return nullptr;
}

static std::vector<ViewportMetadata> collect_viewports(const cadgf_document* doc) {
    std::vector<ViewportMetadata> viewports;
    int count = 0;
    if (!query_doc_meta_int(doc, "dxf.viewport.count", &count) || count <= 0) {
        return viewports;
    }
    viewports.reserve(static_cast<size_t>(count));
    for (int i = 0; i < count; ++i) {
        ViewportMetadata viewport{};
        viewport.index = static_cast<size_t>(i);
        std::string value;
        const std::string base = "dxf.viewport." + std::to_string(i);
        if (query_doc_meta_int(doc, base + ".space", &viewport.space)) {
            // populated
        }
        if (query_doc_meta_int(doc, base + ".id", &viewport.id)) {
            viewport.hasId = true;
        }
        if (query_doc_meta_value(doc, base + ".layout", &value)) {
            viewport.layout = value;
        }
        if (query_doc_meta_double(doc, base + ".center_x", &viewport.centerX)) {
            viewport.hasCenterX = true;
        }
        if (query_doc_meta_double(doc, base + ".center_y", &viewport.centerY)) {
            viewport.hasCenterY = true;
        }
        if (query_doc_meta_double(doc, base + ".width", &viewport.width)) {
            viewport.hasWidth = true;
        }
        if (query_doc_meta_double(doc, base + ".height", &viewport.height)) {
            viewport.hasHeight = true;
        }
        if (query_doc_meta_double(doc, base + ".view_center_x", &viewport.viewCenterX)) {
            viewport.hasViewCenterX = true;
        }
        if (query_doc_meta_double(doc, base + ".view_center_y", &viewport.viewCenterY)) {
            viewport.hasViewCenterY = true;
        }
        if (query_doc_meta_double(doc, base + ".view_height", &viewport.viewHeight)) {
            viewport.hasViewHeight = true;
        }
        if (query_doc_meta_double(doc, base + ".twist_deg", &viewport.twistDeg)) {
            viewport.hasTwistDeg = true;
        }
        viewports.push_back(std::move(viewport));
    }
    return viewports;
}

static int count_viewports_for_space(const std::vector<ViewportMetadata>& viewports, int space) {
    int count = 0;
    for (const auto& viewport : viewports) {
        if (viewport.space == space) {
            count += 1;
        }
    }
    return count;
}

static std::vector<LayoutMetadata> build_layouts(const std::vector<SpaceSummary>& spaces,
                                                 int default_space,
                                                 const std::vector<ViewportMetadata>& viewports,
                                                 const std::map<std::string, int>& document_layout_counts,
                                                 const std::map<std::string, int>& mesh_layout_counts,
                                                 const std::map<std::string, int>& line_layout_counts) {
    std::vector<LayoutMetadata> layouts;

    if (const SpaceSummary* model = find_space_summary(spaces, 0)) {
        LayoutMetadata layout{};
        layout.name = "Model";
        layout.space = 0;
        layout.synthetic = true;
        layout.isDefault = default_space == 0;
        layout.viewportCount = count_viewports_for_space(viewports, 0);
        layout.hasDocumentEntityCount = true;
        layout.documentEntityCount = model->documentEntityCount;
        layout.hasMeshEntityCount = true;
        layout.meshEntityCount = model->meshEntityCount;
        layout.hasLineEntityCount = true;
        layout.lineEntityCount = model->lineEntityCount;
        layouts.push_back(std::move(layout));
    } else if (default_space == 0 || viewports.empty()) {
        LayoutMetadata layout{};
        layout.name = "Model";
        layout.space = 0;
        layout.synthetic = true;
        layout.isDefault = default_space == 0;
        layout.viewportCount = count_viewports_for_space(viewports, 0);
        layouts.push_back(std::move(layout));
    }

    std::map<std::string, int> paper_layouts;
    for (const auto& viewport : viewports) {
        if (viewport.space != 1 || viewport.layout.empty()) continue;
        paper_layouts[viewport.layout] += 1;
    }

    const SpaceSummary* paper = find_space_summary(spaces, 1);
    const bool has_paper_content = paper != nullptr;
    const bool should_emit_paper = has_paper_content || default_space == 1 || !paper_layouts.empty();
    if (!should_emit_paper) {
        return layouts;
    }

    if (paper_layouts.empty()) {
        LayoutMetadata layout{};
        layout.name = "PaperSpace";
        layout.space = 1;
        layout.synthetic = true;
        layout.isDefault = default_space == 1;
        layout.viewportCount = count_viewports_for_space(viewports, 1);
        if (paper) {
            layout.hasDocumentEntityCount = true;
            layout.documentEntityCount = paper->documentEntityCount;
            layout.hasMeshEntityCount = true;
            layout.meshEntityCount = paper->meshEntityCount;
            layout.hasLineEntityCount = true;
            layout.lineEntityCount = paper->lineEntityCount;
        }
        layouts.push_back(std::move(layout));
        return layouts;
    }

    const bool unique_paper_layout = paper_layouts.size() == 1;
    const bool default_unique_paper_layout = default_space == 1 && unique_paper_layout;
    for (const auto& kv : paper_layouts) {
        LayoutMetadata layout{};
        layout.name = kv.first;
        layout.space = 1;
        layout.synthetic = false;
        layout.isDefault = default_unique_paper_layout;
        layout.viewportCount = kv.second;
        int count = 0;
        if (find_count_for_layout(document_layout_counts, layout.name, &count)) {
            layout.hasDocumentEntityCount = true;
            layout.documentEntityCount = count;
        }
        if (find_count_for_layout(mesh_layout_counts, layout.name, &count)) {
            layout.hasMeshEntityCount = true;
            layout.meshEntityCount = count;
        }
        if (find_count_for_layout(line_layout_counts, layout.name, &count)) {
            layout.hasLineEntityCount = true;
            layout.lineEntityCount = count;
        }
        if (paper && unique_paper_layout &&
            !layout.hasDocumentEntityCount && !layout.hasMeshEntityCount && !layout.hasLineEntityCount) {
            layout.hasDocumentEntityCount = true;
            layout.documentEntityCount = paper->documentEntityCount;
            layout.hasMeshEntityCount = true;
            layout.meshEntityCount = paper->meshEntityCount;
            layout.hasLineEntityCount = true;
            layout.lineEntityCount = paper->lineEntityCount;
        }
        layouts.push_back(std::move(layout));
    }
    return layouts;
}

static void write_mesh_slice_json(FILE* f, const MeshSlice& s) {
    std::fprintf(f, "{\"id\": %llu, \"name\": ", static_cast<unsigned long long>(s.id));
    json_write_escaped(f, s.name.c_str(), s.name.size());
    std::fprintf(f, ", \"layer_id\": %d", s.layerId);
    if (s.groupId >= 0) {
        std::fprintf(f, ", \"group_id\": %d", s.groupId);
    }
    if (!s.layoutName.empty()) {
        std::fprintf(f, ", \"layout\": ");
        json_write_escaped(f, s.layoutName.c_str(), s.layoutName.size());
    }
    if (!s.sourceType.empty()) {
        std::fprintf(f, ", \"source_type\": ");
        json_write_escaped(f, s.sourceType.c_str(), s.sourceType.size());
    }
    if (!s.editMode.empty()) {
        std::fprintf(f, ", \"edit_mode\": ");
        json_write_escaped(f, s.editMode.c_str(), s.editMode.size());
    }
    if (!s.proxyKind.empty()) {
        std::fprintf(f, ", \"proxy_kind\": ");
        json_write_escaped(f, s.proxyKind.c_str(), s.proxyKind.size());
    }
    if (!s.blockName.empty()) {
        std::fprintf(f, ", \"block_name\": ");
        json_write_escaped(f, s.blockName.c_str(), s.blockName.size());
    }
    if (s.hasHatchId) {
        std::fprintf(f, ", \"hatch_id\": %d", s.hatchId);
    }
    if (!s.hatchPattern.empty()) {
        std::fprintf(f, ", \"hatch_pattern\": ");
        json_write_escaped(f, s.hatchPattern.c_str(), s.hatchPattern.size());
    }
    if (s.hasDimType) {
        std::fprintf(f, ", \"dim_type\": %d", s.dimType);
    }
    if (!s.dimStyle.empty()) {
        std::fprintf(f, ", \"dim_style\": ");
        json_write_escaped(f, s.dimStyle.c_str(), s.dimStyle.size());
    }
    if (!s.layerName.empty()) {
        std::fprintf(f, ", \"layer_name\": ");
        json_write_escaped(f, s.layerName.c_str(), s.layerName.size());
    }
    if (s.hasLayerColor) {
        std::fprintf(f, ", \"layer_color\": %u", s.layerColor);
    }
    if (s.color != 0) {
        std::fprintf(f, ", \"color\": %u", s.color);
    }
    if (!s.colorSource.empty()) {
        std::fprintf(f, ", \"color_source\": ");
        json_write_escaped(f, s.colorSource.c_str(), s.colorSource.size());
    }
    if (s.hasColorAci) {
        std::fprintf(f, ", \"color_aci\": %d", s.colorAci);
    }
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
    if (s.space >= 0) {
        std::fprintf(f, ", \"space\": %d", s.space);
    }
    std::fprintf(f, ", \"base_vertex\": %u, \"vertex_count\": %u, \"index_offset\": %u, \"index_count\": %u}",
                 s.baseVertex, s.vertexCount, s.indexOffset, s.indexCount);
}

static void write_space_summary_json(FILE* f, const SpaceSummary& summary) {
    std::fprintf(f,
                 "{\"space\": %d, \"document_entity_count\": %d, \"mesh_entity_count\": %d, "
                 "\"line_entity_count\": %d}",
                 summary.space, summary.documentEntityCount, summary.meshEntityCount,
                 summary.lineEntityCount);
}

static void write_layout_json(FILE* f, const LayoutMetadata& layout) {
    std::fprintf(f, "{\"name\": ");
    json_write_escaped(f, layout.name.c_str(), layout.name.size());
    std::fprintf(f, ", \"space\": %d, \"is_default\": %s, \"synthetic\": %s, \"viewport_count\": %d",
                 layout.space, layout.isDefault ? "true" : "false",
                 layout.synthetic ? "true" : "false", layout.viewportCount);
    if (layout.hasDocumentEntityCount) {
        std::fprintf(f, ", \"document_entity_count\": %d", layout.documentEntityCount);
    }
    if (layout.hasMeshEntityCount) {
        std::fprintf(f, ", \"mesh_entity_count\": %d", layout.meshEntityCount);
    }
    if (layout.hasLineEntityCount) {
        std::fprintf(f, ", \"line_entity_count\": %d", layout.lineEntityCount);
    }
    std::fprintf(f, "}");
}

static void write_viewport_json(FILE* f, const ViewportMetadata& viewport) {
    std::fprintf(f, "{\"index\": %zu", viewport.index);
    if (viewport.space >= 0) {
        std::fprintf(f, ", \"space\": %d", viewport.space);
    }
    if (viewport.hasId) {
        std::fprintf(f, ", \"id\": %d", viewport.id);
    }
    if (!viewport.layout.empty()) {
        std::fprintf(f, ", \"layout\": ");
        json_write_escaped(f, viewport.layout.c_str(), viewport.layout.size());
    }
    if (viewport.hasCenterX) {
        std::fprintf(f, ", \"center_x\": %.6f", viewport.centerX);
    }
    if (viewport.hasCenterY) {
        std::fprintf(f, ", \"center_y\": %.6f", viewport.centerY);
    }
    if (viewport.hasWidth) {
        std::fprintf(f, ", \"width\": %.6f", viewport.width);
    }
    if (viewport.hasHeight) {
        std::fprintf(f, ", \"height\": %.6f", viewport.height);
    }
    if (viewport.hasViewCenterX) {
        std::fprintf(f, ", \"view_center_x\": %.6f", viewport.viewCenterX);
    }
    if (viewport.hasViewCenterY) {
        std::fprintf(f, ", \"view_center_y\": %.6f", viewport.viewCenterY);
    }
    if (viewport.hasViewHeight) {
        std::fprintf(f, ", \"view_height\": %.6f", viewport.viewHeight);
    }
    if (viewport.hasTwistDeg) {
        std::fprintf(f, ", \"twist_deg\": %.6f", viewport.twistDeg);
    }
    std::fprintf(f, "}");
}

static void write_instance_json(FILE* f, const InstanceMetadata& instance) {
    std::fprintf(f, "{\"group_id\": %d, \"block_name\": ", instance.groupId);
    json_write_escaped(f, instance.blockName.c_str(), instance.blockName.size());
    if (!instance.sourceType.empty()) {
        std::fprintf(f, ", \"source_type\": ");
        json_write_escaped(f, instance.sourceType.c_str(), instance.sourceType.size());
    }
    if (!instance.editMode.empty()) {
        std::fprintf(f, ", \"edit_mode\": ");
        json_write_escaped(f, instance.editMode.c_str(), instance.editMode.size());
    }
    if (!instance.proxyKind.empty()) {
        std::fprintf(f, ", \"proxy_kind\": ");
        json_write_escaped(f, instance.proxyKind.c_str(), instance.proxyKind.size());
    }
    if (instance.space >= 0) {
        std::fprintf(f, ", \"space\": %d", instance.space);
    }
    if (!instance.layoutName.empty()) {
        std::fprintf(f, ", \"layout\": ");
        json_write_escaped(f, instance.layoutName.c_str(), instance.layoutName.size());
    }
    std::fprintf(f,
                 ", \"document_entity_count\": %d, \"mesh_entity_count\": %d, \"line_entity_count\": %d, "
                 "\"entity_ids\": [",
                 instance.documentEntityCount, instance.meshEntityCount, instance.lineEntityCount);
    for (size_t i = 0; i < instance.entityIds.size(); ++i) {
        std::fprintf(f, "%s%llu", (i ? ", " : ""),
                     static_cast<unsigned long long>(instance.entityIds[i]));
    }
    std::fprintf(f, "]}");
}

static void write_block_json(FILE* f, const BlockMetadata& block) {
    std::fprintf(f, "{\"name\": ");
    json_write_escaped(f, block.name.c_str(), block.name.size());
    std::fprintf(f,
                 ", \"instance_count\": %d, \"document_entity_count\": %d, "
                 "\"mesh_entity_count\": %d, \"line_entity_count\": %d, \"proxy_entity_count\": %d}",
                 block.instanceCount, block.documentEntityCount, block.meshEntityCount,
                 block.lineEntityCount, block.proxyEntityCount);
}

static std::vector<InstanceMetadata> build_instance_metadata(const cadgf_document* doc,
                                                             const std::vector<MeshSlice>& slices,
                                                             const std::vector<MeshSlice>* line_slices) {
    struct Accumulator {
        InstanceMetadata value{};
        bool seeded{false};
    };

    std::map<int, Accumulator> by_group;
    auto seed_from_values = [](Accumulator& acc,
                               int group_id,
                               const std::string& block_name,
                               const std::string& source_type,
                               const std::string& edit_mode,
                               const std::string& proxy_kind,
                               int space,
                               const std::string& layout_name) {
        if (!acc.seeded) {
            acc.value.groupId = group_id;
            acc.value.blockName = block_name;
            acc.value.sourceType = source_type;
            acc.value.editMode = edit_mode;
            acc.value.proxyKind = proxy_kind;
            acc.value.space = space;
            acc.value.layoutName = layout_name;
            acc.seeded = true;
            return;
        }
        if (acc.value.blockName.empty()) acc.value.blockName = block_name;
        if (acc.value.sourceType.empty()) acc.value.sourceType = source_type;
        if (acc.value.editMode.empty()) acc.value.editMode = edit_mode;
        if (acc.value.proxyKind.empty()) acc.value.proxyKind = proxy_kind;
        if (acc.value.space < 0 && space >= 0) acc.value.space = space;
        if (acc.value.layoutName.empty()) acc.value.layoutName = layout_name;
    };

    int entity_count = 0;
    (void)cadgf_document_get_entity_count(doc, &entity_count);
    for (int i = 0; i < entity_count; ++i) {
        cadgf_entity_id eid = 0;
        if (!cadgf_document_get_entity_id_at(doc, i, &eid)) continue;
        cadgf_entity_info_v2 info_v2{};
        if (!cadgf_document_get_entity_info_v2(doc, eid, &info_v2)) continue;
        if (info_v2.group_id < 0) continue;
        std::string block_name;
        if (!query_entity_meta_value(doc, eid, "block_name", &block_name) || block_name.empty()) continue;
        std::string source_type;
        std::string edit_mode;
        std::string proxy_kind;
        std::string layout_name = query_entity_layout_name(doc, eid);
        (void)query_entity_meta_value(doc, eid, "source_type", &source_type);
        (void)query_entity_meta_value(doc, eid, "edit_mode", &edit_mode);
        (void)query_entity_meta_value(doc, eid, "proxy_kind", &proxy_kind);
        const int space = query_entity_space(doc, eid);
        auto& acc = by_group[info_v2.group_id];
        seed_from_values(acc, info_v2.group_id, block_name, source_type, edit_mode, proxy_kind, space, layout_name);
        acc.value.documentEntityCount += 1;
        acc.value.entityIds.push_back(eid);
    }

    auto add_slice_counts = [&](const std::vector<MeshSlice>& slice_list, bool line_mode) {
        for (const auto& slice : slice_list) {
            if (slice.groupId < 0 || slice.blockName.empty()) continue;
            auto& acc = by_group[slice.groupId];
            seed_from_values(acc, slice.groupId, slice.blockName, slice.sourceType, slice.editMode,
                             slice.proxyKind, slice.space, slice.layoutName);
            if (line_mode) {
                acc.value.lineEntityCount += 1;
            } else {
                acc.value.meshEntityCount += 1;
            }
        }
    };
    add_slice_counts(slices, false);
    if (line_slices) add_slice_counts(*line_slices, true);

    std::vector<InstanceMetadata> instances;
    instances.reserve(by_group.size());
    for (auto& kv : by_group) {
        auto& value = kv.second.value;
        if (value.blockName.empty()) continue;
        std::sort(value.entityIds.begin(), value.entityIds.end());
        value.entityIds.erase(std::unique(value.entityIds.begin(), value.entityIds.end()), value.entityIds.end());
        instances.push_back(std::move(value));
    }
    return instances;
}

static std::vector<BlockMetadata> build_block_metadata(const std::vector<InstanceMetadata>& instances) {
    std::map<std::string, BlockMetadata> by_name;
    for (const auto& instance : instances) {
        if (instance.blockName.empty()) continue;
        auto& block = by_name[instance.blockName];
        if (block.name.empty()) block.name = instance.blockName;
        block.instanceCount += 1;
        block.documentEntityCount += instance.documentEntityCount;
        block.meshEntityCount += instance.meshEntityCount;
        block.lineEntityCount += instance.lineEntityCount;
        if (instance.editMode == "proxy" || !instance.proxyKind.empty()) {
            block.proxyEntityCount += instance.documentEntityCount;
        }
    }
    std::vector<BlockMetadata> blocks;
    blocks.reserve(by_name.size());
    for (auto& kv : by_name) {
        blocks.push_back(std::move(kv.second));
    }
    return blocks;
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
        cadgf_entity_info_v2 info_v2{};
        cadgf_entity_info info{};
        int entity_type = 0;
        int layer_id = 0;
        unsigned int entity_color = 0;
        const bool got_info_v2 = cadgf_document_get_entity_info_v2(doc, eid, &info_v2) != 0;
        if (got_info_v2) {
            entity_type = info_v2.type;
            layer_id = info_v2.layer_id;
            entity_color = info_v2.color;
        } else if (cadgf_document_get_entity_info(doc, eid, &info)) {
            entity_type = info.type;
            layer_id = info.layer_id;
        }
        cadgf_entity_info info_basic{};
        info_basic.id = eid;
        info_basic.type = entity_type;
        info_basic.layer_id = layer_id;
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
        const bool has_color = entity_color != 0;
        const int entity_space = query_entity_space(doc, eid);

        std::fprintf(f, "    {\"id\": %llu, \"type\": %d, \"layer_id\": %d, \"name\": ",
                     static_cast<unsigned long long>(eid), entity_type, layer_id);
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
        if (has_color) {
            std::fprintf(f, ", \"color\": %u", entity_color);
        }
        if (got_info_v2 && info_v2.group_id >= 0) {
            std::fprintf(f, ", \"group_id\": %d", info_v2.group_id);
        }
        if (!color_source.empty()) {
            std::fprintf(f, ", \"color_source\": ");
            json_write_escaped(f, color_source.c_str(), color_source.size());
        }
        if (has_color_aci) {
            std::fprintf(f, ", \"color_aci\": %d", color_aci);
        }
        if (entity_space >= 0) {
            std::fprintf(f, ", \"space\": %d", entity_space);
        }
        std::string meta_value;
        if (query_entity_meta_value(doc, eid, "layout", &meta_value)) {
            std::fprintf(f, ", \"layout\": ");
            json_write_escaped(f, meta_value.c_str(), meta_value.size());
        }
        if (query_entity_meta_value(doc, eid, "source_type", &meta_value)) {
            std::fprintf(f, ", \"source_type\": ");
            json_write_escaped(f, meta_value.c_str(), meta_value.size());
        }
        if (query_entity_meta_value(doc, eid, "edit_mode", &meta_value)) {
            std::fprintf(f, ", \"edit_mode\": ");
            json_write_escaped(f, meta_value.c_str(), meta_value.size());
        }
        if (query_entity_meta_value(doc, eid, "proxy_kind", &meta_value)) {
            std::fprintf(f, ", \"proxy_kind\": ");
            json_write_escaped(f, meta_value.c_str(), meta_value.size());
        }
        if (query_entity_meta_value(doc, eid, "block_name", &meta_value)) {
            std::fprintf(f, ", \"block_name\": ");
            json_write_escaped(f, meta_value.c_str(), meta_value.size());
        }
        if (query_entity_meta_value(doc, eid, "hatch_id", &meta_value)) {
            int hatch_id = 0;
            if (parse_meta_int(meta_value, &hatch_id)) {
                std::fprintf(f, ", \"hatch_id\": %d", hatch_id);
            }
        }
        if (query_entity_meta_value(doc, eid, "hatch_pattern", &meta_value)) {
            std::fprintf(f, ", \"hatch_pattern\": ");
            json_write_escaped(f, meta_value.c_str(), meta_value.size());
        }
        if (query_entity_meta_value(doc, eid, "dim_type", &meta_value)) {
            int dim_type = 0;
            if (parse_meta_int(meta_value, &dim_type)) {
                std::fprintf(f, ", \"dim_type\": %d", dim_type);
            }
        }
        if (query_entity_meta_value(doc, eid, "dim_style", &meta_value)) {
            std::fprintf(f, ", \"dim_style\": ");
            json_write_escaped(f, meta_value.c_str(), meta_value.size());
        }

        if (entity_type == CADGF_ENTITY_TYPE_POLYLINE) {
            std::vector<cadgf_vec2> pts;
            if (query_polyline_points(doc, eid, pts)) {
                std::fprintf(f, ", \"polyline\": [");
                for (size_t j = 0; j < pts.size(); ++j) {
                    const cadgf_vec2 p = pts[j];
                    std::fprintf(f, "%s[%.6f, %.6f]", (j ? "," : ""), p.x, p.y);
                }
                std::fprintf(f, "]");
            }
        } else if (entity_type == CADGF_ENTITY_TYPE_POINT) {
            cadgf_point pt{};
            if (cadgf_document_get_point(doc, eid, &pt)) {
                std::fprintf(f, ", \"point\": [%.6f, %.6f]", pt.p.x, pt.p.y);
            }
        } else if (entity_type == CADGF_ENTITY_TYPE_LINE) {
            cadgf_line ln{};
            if (cadgf_document_get_line(doc, eid, &ln)) {
                std::fprintf(f, ", \"line\": [[%.6f, %.6f], [%.6f, %.6f]]",
                             ln.a.x, ln.a.y, ln.b.x, ln.b.y);
            }
        } else if (entity_type == CADGF_ENTITY_TYPE_ARC) {
            cadgf_arc arc{};
            if (cadgf_document_get_arc(doc, eid, &arc)) {
                std::fprintf(f, ", \"arc\": {\"c\": [%.6f, %.6f], \"r\": %.6f, \"a0\": %.6f, \"a1\": %.6f, \"cw\": %d}",
                             arc.center.x, arc.center.y, arc.radius, arc.start_angle, arc.end_angle, arc.clockwise);
            }
        } else if (entity_type == CADGF_ENTITY_TYPE_CIRCLE) {
            cadgf_circle circle{};
            if (cadgf_document_get_circle(doc, eid, &circle)) {
                std::fprintf(f, ", \"circle\": {\"c\": [%.6f, %.6f], \"r\": %.6f}",
                             circle.center.x, circle.center.y, circle.radius);
            }
        } else if (entity_type == CADGF_ENTITY_TYPE_ELLIPSE) {
            cadgf_ellipse ellipse{};
            if (cadgf_document_get_ellipse(doc, eid, &ellipse)) {
                std::fprintf(f, ", \"ellipse\": {\"c\": [%.6f, %.6f], \"rx\": %.6f, \"ry\": %.6f, \"rot\": %.6f, \"a0\": %.6f, \"a1\": %.6f}",
                             ellipse.center.x, ellipse.center.y, ellipse.rx, ellipse.ry,
                             ellipse.rotation, ellipse.start_angle, ellipse.end_angle);
            }
        } else if (entity_type == CADGF_ENTITY_TYPE_SPLINE) {
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
        } else if (entity_type == CADGF_ENTITY_TYPE_TEXT) {
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

                    if (query_entity_meta_value(doc, eid, "text_kind", &meta_value)) {
                        std::fprintf(f, ", \"text_kind\": ");
                        json_write_escaped(f, meta_value.c_str(), meta_value.size());
                    }
                    if (query_entity_meta_value(doc, eid, "text_width", &meta_value)) {
                        double text_width = 0.0;
                        if (parse_meta_double(meta_value, &text_width)) {
                            std::fprintf(f, ", \"text_width\": %.6f", text_width);
                        }
                    }
                    if (query_entity_meta_value(doc, eid, "text_width_factor", &meta_value)) {
                        double width_factor = 0.0;
                        if (parse_meta_double(meta_value, &width_factor)) {
                            std::fprintf(f, ", \"text_width_factor\": %.6f", width_factor);
                        }
                    }
                    if (query_entity_meta_value(doc, eid, "text_attachment", &meta_value)) {
                        int attachment = 0;
                        if (parse_meta_int(meta_value, &attachment)) {
                            std::fprintf(f, ", \"text_attachment\": %d", attachment);
                        }
                    }
                    if (query_entity_meta_value(doc, eid, "text_halign", &meta_value)) {
                        int halign = 0;
                        if (parse_meta_int(meta_value, &halign)) {
                            std::fprintf(f, ", \"text_halign\": %d", halign);
                        }
                    }
                    if (query_entity_meta_value(doc, eid, "text_valign", &meta_value)) {
                        int valign = 0;
                        if (parse_meta_int(meta_value, &valign)) {
                            std::fprintf(f, ", \"text_valign\": %d", valign);
                        }
                    }
                    std::string dim_x;
                    std::string dim_y;
                    double dim_pos_x = 0.0;
                    double dim_pos_y = 0.0;
                    if (query_entity_meta_value(doc, eid, "dim_text_pos_x", &dim_x) &&
                        query_entity_meta_value(doc, eid, "dim_text_pos_y", &dim_y) &&
                        parse_meta_double(dim_x, &dim_pos_x) &&
                        parse_meta_double(dim_y, &dim_pos_y)) {
                        std::fprintf(f, ", \"dim_text_pos\": [%.6f, %.6f]", dim_pos_x, dim_pos_y);
                    }
                    if (query_entity_meta_value(doc, eid, "dim_text_rotation", &meta_value)) {
                        double dim_rot = 0.0;
                        if (parse_meta_double(meta_value, &dim_rot)) {
                            std::fprintf(f, ", \"dim_text_rotation\": %.6f", dim_rot);
                        }
                    }
                }
            }
        }

        std::fprintf(f, "}%s\n", (i + 1 < entity_count) ? "," : "");
    }
    std::fprintf(f, "  ]\n");
    std::fprintf(f, "}\n");
    if (std::fflush(f) != 0 || std::ferror(f)) {
        if (err) *err = "write error while flushing document JSON";
        std::fclose(f);
        return false;
    }
    std::fclose(f);
    return true;
}

static bool write_mesh_metadata(const cadgf_document* doc,
                                const std::string& path,
                                const std::string& gltf_path,
                                const std::string& bin_path,
                                const std::vector<MeshSlice>& slices,
                                const std::vector<MeshSlice>* line_slices,
                                std::string* err) {
    FILE* f = std::fopen(path.c_str(), "wb");
    if (!f) {
        if (err) *err = "failed to open metadata JSON";
        return false;
    }

    const std::string gltf_name = fs::path(gltf_path).filename().string();
    const std::string bin_name = fs::path(bin_path).filename().string();
    const std::vector<SpaceSummary> space_summaries = build_space_summaries(doc, slices, line_slices);
    const std::vector<ViewportMetadata> viewports = collect_viewports(doc);
    const auto document_layout_counts = count_document_entities_by_layout(doc);
    const auto mesh_layout_counts = count_mesh_slices_by_layout(slices);
    const auto line_layout_counts = line_slices
        ? count_mesh_slices_by_layout(*line_slices)
        : std::map<std::string, int>{};
    int default_space = -1;
    (void)query_doc_meta_int(doc, "dxf.default_space", &default_space);
    const std::vector<LayoutMetadata> layouts = build_layouts(
        space_summaries, default_space, viewports,
        document_layout_counts, mesh_layout_counts, line_layout_counts);
    const std::vector<InstanceMetadata> instances = build_instance_metadata(doc, slices, line_slices);
    const std::vector<BlockMetadata> blocks = build_block_metadata(instances);
    int document_entity_count = 0;
    (void)cadgf_document_get_entity_count(doc, &document_entity_count);
    const size_t line_entity_count = line_slices ? line_slices->size() : 0;

    std::fprintf(f, "{\n");
    std::fprintf(f, "  \"gltf\": ");
    json_write_escaped(f, gltf_name.c_str(), gltf_name.size());
    std::fprintf(f, ",\n  \"bin\": ");
    json_write_escaped(f, bin_name.c_str(), bin_name.size());
    std::fprintf(f, ",\n  \"summary\": {\n");
    std::fprintf(f, "    \"document_entity_count\": %d,\n", document_entity_count);
    std::fprintf(f, "    \"mesh_entity_count\": %zu,\n", slices.size());
    std::fprintf(f, "    \"line_entity_count\": %zu,\n", line_entity_count);
    std::fprintf(f, "    \"instance_count\": %zu,\n", instances.size());
    std::fprintf(f, "    \"block_count\": %zu,\n", blocks.size());
    if (default_space >= 0) {
        std::fprintf(f, "    \"default_space\": %d,\n", default_space);
    } else {
        std::fprintf(f, "    \"default_space\": null,\n");
    }
    std::fprintf(f, "    \"layout_count\": %zu,\n", layouts.size());
    std::fprintf(f, "    \"viewport_count\": %zu,\n", viewports.size());
    std::fprintf(f, "    \"spaces\": [\n");
    for (size_t i = 0; i < space_summaries.size(); ++i) {
        std::fprintf(f, "      ");
        write_space_summary_json(f, space_summaries[i]);
        std::fprintf(f, "%s\n", (i + 1 < space_summaries.size()) ? "," : "");
    }
    std::fprintf(f, "    ]\n");
    std::fprintf(f, "  },\n");
    std::fprintf(f, "  \"layouts\": [\n");
    for (size_t i = 0; i < layouts.size(); ++i) {
        std::fprintf(f, "    ");
        write_layout_json(f, layouts[i]);
        std::fprintf(f, "%s\n", (i + 1 < layouts.size()) ? "," : "");
    }
    std::fprintf(f, "  ],\n");
    std::fprintf(f, "  \"viewports\": [\n");
    for (size_t i = 0; i < viewports.size(); ++i) {
        std::fprintf(f, "    ");
        write_viewport_json(f, viewports[i]);
        std::fprintf(f, "%s\n", (i + 1 < viewports.size()) ? "," : "");
    }
    std::fprintf(f, "  ],\n");
    std::fprintf(f, "  \"instances\": [\n");
    for (size_t i = 0; i < instances.size(); ++i) {
        std::fprintf(f, "    ");
        write_instance_json(f, instances[i]);
        std::fprintf(f, "%s\n", (i + 1 < instances.size()) ? "," : "");
    }
    std::fprintf(f, "  ],\n");
    std::fprintf(f, "  \"blocks\": [\n");
    for (size_t i = 0; i < blocks.size(); ++i) {
        std::fprintf(f, "    ");
        write_block_json(f, blocks[i]);
        std::fprintf(f, "%s\n", (i + 1 < blocks.size()) ? "," : "");
    }
    std::fprintf(f, "  ],\n");
    std::fprintf(f, "  \"entities\": [\n");
    for (size_t i = 0; i < slices.size(); ++i) {
        const auto& s = slices[i];
        std::fprintf(f, "    ");
        write_mesh_slice_json(f, s);
        std::fprintf(f, "%s\n", (i + 1 < slices.size()) ? "," : "");
    }
    std::fprintf(f, "  ],\n");
    std::fprintf(f, "  \"line_entities\": [\n");
    if (line_slices) {
        for (size_t i = 0; i < line_slices->size(); ++i) {
            const auto& s = (*line_slices)[i];
            std::fprintf(f, "    ");
            write_mesh_slice_json(f, s);
            std::fprintf(f, "%s\n", (i + 1 < line_slices->size()) ? "," : "");
        }
    }
    std::fprintf(f, "  ]\n");
    std::fprintf(f, "}\n");
    if (std::fflush(f) != 0 || std::ferror(f)) {
        if (err) *err = "write error while flushing mesh metadata JSON";
        std::fclose(f);
        return false;
    }
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

static bool is_polyline_closed(const std::vector<cadgf_vec2>& pts) {
    if (pts.size() < 3) return false;
    double min_x = pts.front().x;
    double max_x = pts.front().x;
    double min_y = pts.front().y;
    double max_y = pts.front().y;
    for (const auto& p : pts) {
        min_x = std::min(min_x, p.x);
        max_x = std::max(max_x, p.x);
        min_y = std::min(min_y, p.y);
        max_y = std::max(max_y, p.y);
    }
    const double dx = pts.front().x - pts.back().x;
    const double dy = pts.front().y - pts.back().y;
    const double scale = std::max(max_x - min_x, max_y - min_y);
    const double tol = std::max(1e-9, scale * 1e-6);
    return (dx * dx + dy * dy) <= (tol * tol);
}

static double polygon_area_abs(const std::vector<cadgf_vec2>& pts) {
    if (pts.size() < 3) return 0.0;
    double area = 0.0;
    for (size_t i = 0; i < pts.size(); ++i) {
        const size_t j = (i + 1) % pts.size();
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    return std::abs(area) * 0.5;
}

static bool starts_with(const std::string& value, const char* prefix) {
    if (!prefix) return false;
    const size_t prefix_len = std::strlen(prefix);
    return value.size() >= prefix_len && value.compare(0, prefix_len, prefix) == 0;
}

// Coordinate validity check - filter out invalid/extreme values
static bool is_valid_coordinate(const cadgf_vec2& pt) {
    constexpr double kMaxCoord = 1e9;  // Absolute maximum coordinate value
    if (!std::isfinite(pt.x) || !std::isfinite(pt.y)) return false;
    if (std::abs(pt.x) >= kMaxCoord || std::abs(pt.y) >= kMaxCoord) return false;
    return true;
}

static void append_line_segment(std::vector<float>& positions,
                                std::vector<uint32_t>& indices,
                                const cadgf_vec2& a,
                                const cadgf_vec2& b) {
    if (a.x == b.x && a.y == b.y) return;
    // Skip segments with invalid or extreme coordinates
    if (!is_valid_coordinate(a) || !is_valid_coordinate(b)) return;
    const uint32_t base = static_cast<uint32_t>(positions.size() / 3);
    positions.push_back(static_cast<float>(a.x));
    positions.push_back(static_cast<float>(a.y));
    positions.push_back(0.0f);
    positions.push_back(static_cast<float>(b.x));
    positions.push_back(static_cast<float>(b.y));
    positions.push_back(0.0f);
    indices.push_back(base);
    indices.push_back(base + 1);
}

static void append_polyline_lines(std::vector<float>& positions,
                                  std::vector<uint32_t>& indices,
                                  const std::vector<cadgf_vec2>& pts) {
    if (pts.size() < 2) return;
    for (size_t i = 0; i + 1 < pts.size(); ++i) {
        append_line_segment(positions, indices, pts[i], pts[i + 1]);
    }
}

static int segment_count_for_delta(double delta) {
    const double step = kPi / 18.0; // ~10 degrees
    const int segments = static_cast<int>(std::ceil(std::abs(delta) / step));
    return std::max(8, segments);
}

static void append_arc_lines(std::vector<float>& positions,
                             std::vector<uint32_t>& indices,
                             const cadgf_arc& arc) {
    if (arc.radius <= 0.0) return;
    double start = arc.start_angle;
    double end = arc.end_angle;
    double delta = end - start;
    if (arc.clockwise) {
        if (delta > 0.0) delta -= kTwoPi;
    } else {
        if (delta < 0.0) delta += kTwoPi;
    }
    if (std::abs(delta) < 1e-9) {
        delta = arc.clockwise ? -kTwoPi : kTwoPi;
    }
    const int segments = segment_count_for_delta(delta);
    for (int i = 0; i < segments; ++i) {
        const double t0 = start + delta * (static_cast<double>(i) / segments);
        const double t1 = start + delta * (static_cast<double>(i + 1) / segments);
        cadgf_vec2 a{arc.center.x + arc.radius * std::cos(t0),
                     arc.center.y + arc.radius * std::sin(t0)};
        cadgf_vec2 b{arc.center.x + arc.radius * std::cos(t1),
                     arc.center.y + arc.radius * std::sin(t1)};
        append_line_segment(positions, indices, a, b);
    }
}

static void append_circle_lines(std::vector<float>& positions,
                                std::vector<uint32_t>& indices,
                                const cadgf_circle& circle) {
    if (circle.radius <= 0.0) return;
    cadgf_arc arc{};
    arc.center = circle.center;
    arc.radius = circle.radius;
    arc.start_angle = 0.0;
    arc.end_angle = kTwoPi;
    arc.clockwise = 0;
    append_arc_lines(positions, indices, arc);
}

static void append_ellipse_lines(std::vector<float>& positions,
                                 std::vector<uint32_t>& indices,
                                 const cadgf_ellipse& ellipse) {
    if (ellipse.rx <= 0.0 || ellipse.ry <= 0.0) return;
    double start = ellipse.start_angle;
    double end = ellipse.end_angle;
    double delta = end - start;
    if (std::abs(delta) < 1e-9) {
        delta = kTwoPi;
    }
    const int segments = segment_count_for_delta(delta);
    const double cos_r = std::cos(ellipse.rotation);
    const double sin_r = std::sin(ellipse.rotation);
    for (int i = 0; i < segments; ++i) {
        const double t0 = start + delta * (static_cast<double>(i) / segments);
        const double t1 = start + delta * (static_cast<double>(i + 1) / segments);
        const double x0 = ellipse.rx * std::cos(t0);
        const double y0 = ellipse.ry * std::sin(t0);
        const double x1 = ellipse.rx * std::cos(t1);
        const double y1 = ellipse.ry * std::sin(t1);
        cadgf_vec2 a{ellipse.center.x + x0 * cos_r - y0 * sin_r,
                     ellipse.center.y + x0 * sin_r + y0 * cos_r};
        cadgf_vec2 b{ellipse.center.x + x1 * cos_r - y1 * sin_r,
                     ellipse.center.y + x1 * sin_r + y1 * cos_r};
        append_line_segment(positions, indices, a, b);
    }
}

static bool query_spline_control_points(const cadgf_document* doc,
                                        cadgf_entity_id id,
                                        std::vector<cadgf_vec2>& out) {
    int required_ctrl = 0;
    int required_knots = 0;
    int degree = 0;
    if (!cadgf_document_get_spline(doc, id, nullptr, 0, &required_ctrl,
                                   nullptr, 0, &required_knots, &degree)) {
        return false;
    }
    if (required_ctrl <= 0) return false;
    out.assign(static_cast<size_t>(required_ctrl), {});
    std::vector<double> knots(static_cast<size_t>(std::max(0, required_knots)));
    if (!cadgf_document_get_spline(doc, id, out.data(), required_ctrl, &required_ctrl,
                                   knots.empty() ? nullptr : knots.data(),
                                   required_knots, &required_knots, &degree)) {
        return false;
    }
    if (required_ctrl <= 0) {
        out.clear();
        return false;
    }
    if (static_cast<int>(out.size()) != required_ctrl) {
        out.resize(static_cast<size_t>(required_ctrl));
    }
    return true;
}

static void append_spline_lines(std::vector<float>& positions,
                                std::vector<uint32_t>& indices,
                                const std::vector<cadgf_vec2>& control_points) {
    append_polyline_lines(positions, indices, control_points);
}

static void populate_slice_metadata(const cadgf_document* doc,
                                    cadgf_entity_id id,
                                    const cadgf_entity_info& info,
                                    MeshSlice& slice) {
    slice.id = id;
    slice.layerId = info.layer_id;
    slice.layerName = query_layer_name_utf8(doc, info.layer_id);
    slice.layoutName = query_entity_layout_name(doc, id);
    (void)query_entity_meta_value(doc, id, "source_type", &slice.sourceType);
    (void)query_entity_meta_value(doc, id, "edit_mode", &slice.editMode);
    (void)query_entity_meta_value(doc, id, "proxy_kind", &slice.proxyKind);
    (void)query_entity_meta_value(doc, id, "block_name", &slice.blockName);
    (void)query_entity_meta_value(doc, id, "hatch_pattern", &slice.hatchPattern);
    std::string meta_value;
    if (query_entity_meta_value(doc, id, "hatch_id", &meta_value)) {
        slice.hasHatchId = parse_meta_int(meta_value, &slice.hatchId);
    }
    if (query_entity_meta_value(doc, id, "dim_type", &meta_value)) {
        slice.hasDimType = parse_meta_int(meta_value, &slice.dimType);
    }
    (void)query_entity_meta_value(doc, id, "dim_style", &slice.dimStyle);
    cadgf_layer_info_v2 layer_info{};
    if (cadgf_document_get_layer_info_v2(doc, info.layer_id, &layer_info)) {
        slice.layerColor = layer_info.color;
        slice.hasLayerColor = true;
    } else {
        cadgf_layer_info legacy{};
        if (cadgf_document_get_layer_info(doc, info.layer_id, &legacy)) {
            slice.layerColor = legacy.color;
            slice.hasLayerColor = true;
        }
    }
    slice.name = query_entity_name_utf8(doc, id);
    slice.lineType = query_entity_line_type_utf8(doc, id);
    slice.colorSource = query_entity_color_source_utf8(doc, id);
    slice.hasColorAci = query_entity_color_aci(doc, id, &slice.colorAci);
    cadgf_entity_info_v2 info_v2{};
    if (cadgf_document_get_entity_info_v2(doc, id, &info_v2)) {
        slice.groupId = info_v2.group_id;
        slice.color = info_v2.color;
    }
    (void)cadgf_document_get_entity_line_weight(doc, id, &slice.lineWeight);
    (void)cadgf_document_get_entity_line_type_scale(doc, id, &slice.lineTypeScale);
    slice.space = query_entity_space(doc, id);
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

static bool write_gltf_scene(tinygltf::TinyGLTF* gltf,
                             tinygltf::Model* model,
                             const std::string& gltf_path,
                             std::string* err) {
    try {
        if (!gltf || !model) {
            if (err) *err = "invalid glTF writer";
            return false;
        }
        if (gltf->WriteGltfSceneToFile(model, gltf_path, false, false, true, false)) {
            return true;
        }
        if (err) *err = "failed to write glTF";
        return false;
    } catch (const std::exception& ex) {
        if (err) *err = ex.what();
        return false;
    } catch (...) {
        if (err) *err = "unknown exception writing glTF";
        return false;
    }
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
    if (write_gltf_scene(&gltf, &model, gltf_path, err)) {
        return true;
    }
    model.meshes[0].extras = tinygltf::Value();
    model.nodes[0].extras = tinygltf::Value();
    std::string fallback_err;
    if (write_gltf_scene(&gltf, &model, gltf_path, &fallback_err)) {
        if (err) *err = "glTF extras stripped after write error";
        return true;
    }
    if (err && !fallback_err.empty()) {
        *err = fallback_err;
    }
    return false;
}

static bool write_gltf_combined(const std::string& gltf_path,
                             const std::string& bin_path,
                             const std::vector<float>& positions,
                             const std::vector<uint32_t>& indices,
                             const std::vector<float>& line_positions,
                             const std::vector<uint32_t>& line_indices,
                             const cadgf_document* doc,
                             std::string* err) {
    if (positions.empty() || indices.empty() || line_positions.empty() || line_indices.empty()) {
        if (err) *err = "missing mesh or line data";
        return false;
    }

    tinygltf::Model model;
    tinygltf::Scene scene;
    tinygltf::Mesh mesh;
    model.asset.version = "2.0";
    model.asset.generator = "CADGameFusion_Convert_CLI";

    tinygltf::Buffer buffer;
    const size_t pos_bytes = positions.size() * sizeof(float);
    const size_t idx_bytes = indices.size() * sizeof(uint32_t);
    const size_t line_pos_bytes = line_positions.size() * sizeof(float);
    const size_t line_idx_bytes = line_indices.size() * sizeof(uint32_t);
    buffer.data.resize(pos_bytes + idx_bytes + line_pos_bytes + line_idx_bytes);
    std::memcpy(buffer.data.data(), positions.data(), pos_bytes);
    std::memcpy(buffer.data.data() + pos_bytes, indices.data(), idx_bytes);
    std::memcpy(buffer.data.data() + pos_bytes + idx_bytes, line_positions.data(), line_pos_bytes);
    std::memcpy(buffer.data.data() + pos_bytes + idx_bytes + line_pos_bytes, line_indices.data(), line_idx_bytes);
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

    tinygltf::BufferView line_pos_view;
    line_pos_view.buffer = 0;
    line_pos_view.byteOffset = pos_bytes + idx_bytes;
    line_pos_view.byteLength = line_pos_bytes;
    line_pos_view.target = TINYGLTF_TARGET_ARRAY_BUFFER;
    const int line_pos_view_idx = static_cast<int>(model.bufferViews.size());
    model.bufferViews.push_back(line_pos_view);

    tinygltf::BufferView line_idx_view;
    line_idx_view.buffer = 0;
    line_idx_view.byteOffset = pos_bytes + idx_bytes + line_pos_bytes;
    line_idx_view.byteLength = line_idx_bytes;
    line_idx_view.target = TINYGLTF_TARGET_ELEMENT_ARRAY_BUFFER;
    const int line_idx_view_idx = static_cast<int>(model.bufferViews.size());
    model.bufferViews.push_back(line_idx_view);

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

    float line_min_x = std::numeric_limits<float>::max();
    float line_min_y = std::numeric_limits<float>::max();
    float line_min_z = std::numeric_limits<float>::max();
    float line_max_x = std::numeric_limits<float>::lowest();
    float line_max_y = std::numeric_limits<float>::lowest();
    float line_max_z = std::numeric_limits<float>::lowest();
    for (size_t i = 0; i + 2 < line_positions.size(); i += 3) {
        const float x = line_positions[i];
        const float y = line_positions[i + 1];
        const float z = line_positions[i + 2];
        line_min_x = std::min(line_min_x, x);
        line_min_y = std::min(line_min_y, y);
        line_min_z = std::min(line_min_z, z);
        line_max_x = std::max(line_max_x, x);
        line_max_y = std::max(line_max_y, y);
        line_max_z = std::max(line_max_z, z);
    }

    tinygltf::Accessor line_pos_accessor;
    line_pos_accessor.bufferView = line_pos_view_idx;
    line_pos_accessor.byteOffset = 0;
    line_pos_accessor.componentType = TINYGLTF_COMPONENT_TYPE_FLOAT;
    line_pos_accessor.count = line_positions.size() / 3;
    line_pos_accessor.type = TINYGLTF_TYPE_VEC3;
    line_pos_accessor.minValues = {line_min_x, line_min_y, line_min_z};
    line_pos_accessor.maxValues = {line_max_x, line_max_y, line_max_z};
    const int line_pos_accessor_idx = static_cast<int>(model.accessors.size());
    model.accessors.push_back(line_pos_accessor);

    tinygltf::Accessor line_idx_accessor;
    line_idx_accessor.bufferView = line_idx_view_idx;
    line_idx_accessor.byteOffset = 0;
    line_idx_accessor.componentType = TINYGLTF_COMPONENT_TYPE_UNSIGNED_INT;
    line_idx_accessor.count = line_indices.size();
    line_idx_accessor.type = TINYGLTF_TYPE_SCALAR;
    const int line_idx_accessor_idx = static_cast<int>(model.accessors.size());
    model.accessors.push_back(line_idx_accessor);

    tinygltf::Primitive prim_tri;
    prim_tri.attributes["POSITION"] = pos_accessor_idx;
    prim_tri.indices = idx_accessor_idx;
    prim_tri.mode = TINYGLTF_MODE_TRIANGLES;
    mesh.primitives.push_back(prim_tri);

    tinygltf::Primitive prim_line;
    prim_line.attributes["POSITION"] = line_pos_accessor_idx;
    prim_line.indices = line_idx_accessor_idx;
    prim_line.mode = TINYGLTF_MODE_LINE;
    mesh.primitives.push_back(prim_line);

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
    if (write_gltf_scene(&gltf, &model, gltf_path, err)) {
        return true;
    }
    model.meshes[0].extras = tinygltf::Value();
    model.nodes[0].extras = tinygltf::Value();
    std::string fallback_err;
    if (write_gltf_scene(&gltf, &model, gltf_path, &fallback_err)) {
        if (err) *err = "glTF extras stripped after write error";
        return true;
    }
    if (err && !fallback_err.empty()) {
        *err = fallback_err;
    }
    return false;
}

static bool write_gltf_lines(const std::string& gltf_path,
                             const std::string& bin_path,
                             const std::vector<float>& positions,
                             const std::vector<uint32_t>& indices,
                             const cadgf_document* doc,
                             std::string* err) {
    if (positions.empty() || indices.empty()) {
        if (err) *err = "no line data";
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
    prim.mode = TINYGLTF_MODE_LINE;
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
    if (write_gltf_scene(&gltf, &model, gltf_path, err)) {
        return true;
    }
    model.meshes[0].extras = tinygltf::Value();
    model.nodes[0].extras = tinygltf::Value();
    std::string fallback_err;
    if (write_gltf_scene(&gltf, &model, gltf_path, &fallback_err)) {
        if (err) *err = "glTF extras stripped after write error";
        return true;
    }
    if (err && !fallback_err.empty()) {
        *err = fallback_err;
    }
    return false;
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
    bool wrote_json = false;
    bool wrote_gltf = false;
    bool wrote_bin = false;
    bool wrote_meta = false;

    if (opts.emitJson) {
        if (!write_document_json(doc, json_path, &err)) {
            std::cerr << "JSON export failed: " << err << "\n";
            cadgf_document_destroy(doc);
            return 1;
        }
        wrote_json = true;
    }

    if (opts.emitGltf) {
#if defined(CADGF_HAS_TINYGLTF)
        std::vector<float> positions;
        std::vector<uint32_t> indices;
        std::vector<float> line_positions;
        std::vector<uint32_t> line_indices;
        std::vector<MeshSlice> slices;
        std::vector<MeshSlice> line_slices;
        struct HatchGroup {
            std::vector<std::vector<cadgf_vec2>> rings;
            cadgf_entity_id owner_id = 0;
            cadgf_entity_info owner_info{};
            bool has_owner = false;
        };
        std::unordered_map<std::string, HatchGroup> hatch_groups;
        const char* hatch_prefix = "__cadgf_hatch:";
        const bool line_only = opts.lineOnly;
        int entity_count = 0;
        (void)cadgf_document_get_entity_count(doc, &entity_count);
        for (int i = 0; i < entity_count; ++i) {
            cadgf_entity_id eid = 0;
            if (!cadgf_document_get_entity_id_at(doc, i, &eid)) continue;
            cadgf_entity_info info{};
            (void)cadgf_document_get_entity_info(doc, eid, &info);
            const cadgf_entity_info info_basic = info;
            const std::string name = query_entity_name_utf8(doc, eid);

            switch (info.type) {
                case CADGF_ENTITY_TYPE_POLYLINE: {
                    std::vector<cadgf_vec2> pts;
                    if (!query_polyline_points(doc, eid, pts)) break;
                    // Skip polylines with outlier coordinates (dimension arrows with wrong transforms)
                    bool has_outlier = false;
                    for (const auto& p : pts) {
                        if (p.x < -1000.0) { has_outlier = true; break; }
                    }
                    if (has_outlier) break;
                    const uint32_t line_base = static_cast<uint32_t>(line_positions.size() / 3);
                    const uint32_t line_offset = static_cast<uint32_t>(line_indices.size());
                    append_polyline_lines(line_positions, line_indices, pts);
                    const uint32_t line_vertex_count =
                        static_cast<uint32_t>(line_positions.size() / 3) - line_base;
                    const uint32_t line_index_count =
                        static_cast<uint32_t>(line_indices.size()) - line_offset;
                    if (line_index_count > 0) {
                        MeshSlice line_slice{};
                        populate_slice_metadata(doc, eid, info_basic, line_slice);
                        line_slice.baseVertex = line_base;
                        line_slice.vertexCount = line_vertex_count;
                        line_slice.indexOffset = line_offset;
                        line_slice.indexCount = line_index_count;
                        line_slices.push_back(line_slice);
                    }

                    const bool is_hatch = starts_with(name, hatch_prefix);
                    if (!line_only && is_hatch && is_polyline_closed(pts)) {
                        auto& group = hatch_groups[name];
                        if (!group.has_owner) {
                            group.owner_id = eid;
                            group.owner_info = info_basic;
                            group.has_owner = true;
                        }
                        group.rings.push_back(pts);
                        break;
                    }

                    if (!line_only && is_polyline_closed(pts)) {
                        std::vector<cadgf_vec2> mesh_pts = pts;
                        strip_closing_point(mesh_pts);
                        if (mesh_pts.size() < 3) break;
                        if (mesh_pts.size() > 5000) break;
                        if (polygon_area_abs(mesh_pts) <= 1e-12) break;

                        int index_count = 0;
                        if (!cadgf_triangulate_polygon(mesh_pts.data(), static_cast<int>(mesh_pts.size()), nullptr, &index_count) || index_count <= 0) {
                            break;
                        }
                        std::vector<unsigned int> local_indices(static_cast<size_t>(index_count));
                        int index_count2 = index_count;
                        if (!cadgf_triangulate_polygon(mesh_pts.data(), static_cast<int>(mesh_pts.size()), local_indices.data(), &index_count2) || index_count2 <= 0) {
                            break;
                        }

                        // Filter out invalid coordinates before adding to mesh
                        std::vector<cadgf_vec2> valid_pts;
                        valid_pts.reserve(mesh_pts.size());
                        for (const auto& p : mesh_pts) {
                            if (is_valid_coordinate(p)) {
                                valid_pts.push_back(p);
                            }
                        }
                        if (valid_pts.size() < 3) break;  // Need at least 3 valid points for a polygon

                        const uint32_t base = static_cast<uint32_t>(positions.size() / 3);
                        const uint32_t index_offset = static_cast<uint32_t>(indices.size());
                        for (const auto& p : valid_pts) {
                            positions.push_back(static_cast<float>(p.x));
                            positions.push_back(static_cast<float>(p.y));
                            positions.push_back(0.0f);
                        }
                        for (int k = 0; k < index_count2; ++k) {
                            indices.push_back(base + static_cast<uint32_t>(local_indices[static_cast<size_t>(k)]));
                        }

                        MeshSlice slice;
                        populate_slice_metadata(doc, eid, info_basic, slice);
                        slice.baseVertex = base;
                        slice.vertexCount = static_cast<uint32_t>(mesh_pts.size());
                        slice.indexOffset = index_offset;
                        slice.indexCount = static_cast<uint32_t>(index_count2);
                        slices.push_back(slice);
                    }
                    break;
                }
                case CADGF_ENTITY_TYPE_LINE: {
                    cadgf_line ln{};
                    if (cadgf_document_get_line(doc, eid, &ln)) {
                        // Skip lines with outlier coordinates
                        if (ln.a.x < -1000.0 || ln.b.x < -1000.0) break;
                        const uint32_t line_base = static_cast<uint32_t>(line_positions.size() / 3);
                        const uint32_t line_offset = static_cast<uint32_t>(line_indices.size());
                        append_line_segment(line_positions, line_indices, ln.a, ln.b);
                        const uint32_t line_vertex_count =
                            static_cast<uint32_t>(line_positions.size() / 3) - line_base;
                        const uint32_t line_index_count =
                            static_cast<uint32_t>(line_indices.size()) - line_offset;
                        if (line_index_count > 0) {
                            MeshSlice line_slice{};
                            populate_slice_metadata(doc, eid, info_basic, line_slice);
                            line_slice.baseVertex = line_base;
                            line_slice.vertexCount = line_vertex_count;
                            line_slice.indexOffset = line_offset;
                            line_slice.indexCount = line_index_count;
                            line_slices.push_back(line_slice);
                        }
                    }
                    break;
                }
                case CADGF_ENTITY_TYPE_ARC: {
                    cadgf_arc arc{};
                    if (cadgf_document_get_arc(doc, eid, &arc)) {
                        const uint32_t line_base = static_cast<uint32_t>(line_positions.size() / 3);
                        const uint32_t line_offset = static_cast<uint32_t>(line_indices.size());
                        append_arc_lines(line_positions, line_indices, arc);
                        const uint32_t line_vertex_count =
                            static_cast<uint32_t>(line_positions.size() / 3) - line_base;
                        const uint32_t line_index_count =
                            static_cast<uint32_t>(line_indices.size()) - line_offset;
                        if (line_index_count > 0) {
                            MeshSlice line_slice{};
                            populate_slice_metadata(doc, eid, info_basic, line_slice);
                            line_slice.baseVertex = line_base;
                            line_slice.vertexCount = line_vertex_count;
                            line_slice.indexOffset = line_offset;
                            line_slice.indexCount = line_index_count;
                            line_slices.push_back(line_slice);
                        }
                    }
                    break;
                }
                case CADGF_ENTITY_TYPE_CIRCLE: {
                    cadgf_circle circle{};
                    if (cadgf_document_get_circle(doc, eid, &circle)) {
                        const uint32_t line_base = static_cast<uint32_t>(line_positions.size() / 3);
                        const uint32_t line_offset = static_cast<uint32_t>(line_indices.size());
                        append_circle_lines(line_positions, line_indices, circle);
                        const uint32_t line_vertex_count =
                            static_cast<uint32_t>(line_positions.size() / 3) - line_base;
                        const uint32_t line_index_count =
                            static_cast<uint32_t>(line_indices.size()) - line_offset;
                        if (line_index_count > 0) {
                            MeshSlice line_slice{};
                            populate_slice_metadata(doc, eid, info_basic, line_slice);
                            line_slice.baseVertex = line_base;
                            line_slice.vertexCount = line_vertex_count;
                            line_slice.indexOffset = line_offset;
                            line_slice.indexCount = line_index_count;
                            line_slices.push_back(line_slice);
                        }
                    }
                    break;
                }
                case CADGF_ENTITY_TYPE_ELLIPSE: {
                    cadgf_ellipse ellipse{};
                    if (cadgf_document_get_ellipse(doc, eid, &ellipse)) {
                        const uint32_t line_base = static_cast<uint32_t>(line_positions.size() / 3);
                        const uint32_t line_offset = static_cast<uint32_t>(line_indices.size());
                        append_ellipse_lines(line_positions, line_indices, ellipse);
                        const uint32_t line_vertex_count =
                            static_cast<uint32_t>(line_positions.size() / 3) - line_base;
                        const uint32_t line_index_count =
                            static_cast<uint32_t>(line_indices.size()) - line_offset;
                        if (line_index_count > 0) {
                            MeshSlice line_slice{};
                            populate_slice_metadata(doc, eid, info_basic, line_slice);
                            line_slice.baseVertex = line_base;
                            line_slice.vertexCount = line_vertex_count;
                            line_slice.indexOffset = line_offset;
                            line_slice.indexCount = line_index_count;
                            line_slices.push_back(line_slice);
                        }
                    }
                    break;
                }
                case CADGF_ENTITY_TYPE_SPLINE: {
                    std::vector<cadgf_vec2> control_points;
                    if (query_spline_control_points(doc, eid, control_points)) {
                        const uint32_t line_base = static_cast<uint32_t>(line_positions.size() / 3);
                        const uint32_t line_offset = static_cast<uint32_t>(line_indices.size());
                        append_spline_lines(line_positions, line_indices, control_points);
                        const uint32_t line_vertex_count =
                            static_cast<uint32_t>(line_positions.size() / 3) - line_base;
                        const uint32_t line_index_count =
                            static_cast<uint32_t>(line_indices.size()) - line_offset;
                        if (line_index_count > 0) {
                            MeshSlice line_slice{};
                            populate_slice_metadata(doc, eid, info_basic, line_slice);
                            line_slice.baseVertex = line_base;
                            line_slice.vertexCount = line_vertex_count;
                            line_slice.indexOffset = line_offset;
                            line_slice.indexCount = line_index_count;
                            line_slices.push_back(line_slice);
                        }
                    }
                    break;
                }
                default:
                    break;
            }
        }

        if (!line_only && !hatch_groups.empty()) {
            for (auto& entry : hatch_groups) {
                HatchGroup& group = entry.second;
                if (!group.has_owner) continue;
                std::vector<std::vector<cadgf_vec2>> rings;
                rings.reserve(group.rings.size());
                for (auto ring : group.rings) {
                    strip_closing_point(ring);
                    if (ring.size() < 3) continue;
                    rings.push_back(std::move(ring));
                }
                if (rings.empty()) continue;

                size_t outer_index = 0;
                double max_area = 0.0;
                for (size_t i = 0; i < rings.size(); ++i) {
                    double area = polygon_area_abs(rings[i]);
                    if (area > max_area) {
                        max_area = area;
                        outer_index = i;
                    }
                }
                if (outer_index != 0) {
                    std::swap(rings[0], rings[outer_index]);
                }

                std::vector<cadgf_vec2> flat;
                std::vector<int> ring_counts;
                ring_counts.reserve(rings.size());
                size_t total_points = 0;
                for (const auto& ring : rings) {
                    total_points += ring.size();
                    ring_counts.push_back(static_cast<int>(ring.size()));
                }
                flat.reserve(total_points);
                for (const auto& ring : rings) {
                    flat.insert(flat.end(), ring.begin(), ring.end());
                }
                if (flat.size() < 3) continue;

                int index_count = 0;
                if (!cadgf_triangulate_polygon_rings(flat.data(),
                                                     ring_counts.data(),
                                                     static_cast<int>(ring_counts.size()),
                                                     nullptr,
                                                     &index_count) || index_count <= 0) {
                    continue;
                }
                std::vector<unsigned int> local_indices(static_cast<size_t>(index_count));
                int index_count2 = index_count;
                if (!cadgf_triangulate_polygon_rings(flat.data(),
                                                     ring_counts.data(),
                                                     static_cast<int>(ring_counts.size()),
                                                     local_indices.data(),
                                                     &index_count2) || index_count2 <= 0) {
                    continue;
                }

                // Filter out invalid coordinates before adding to mesh
                std::vector<cadgf_vec2> valid_flat;
                valid_flat.reserve(flat.size());
                for (const auto& p : flat) {
                    if (is_valid_coordinate(p)) {
                        valid_flat.push_back(p);
                    }
                }
                if (valid_flat.size() < 3) continue;  // Need at least 3 valid points

                const uint32_t base = static_cast<uint32_t>(positions.size() / 3);
                const uint32_t index_offset = static_cast<uint32_t>(indices.size());
                for (const auto& p : valid_flat) {
                    positions.push_back(static_cast<float>(p.x));
                    positions.push_back(static_cast<float>(p.y));
                    positions.push_back(0.0f);
                }
                for (int k = 0; k < index_count2; ++k) {
                    indices.push_back(base + static_cast<uint32_t>(local_indices[static_cast<size_t>(k)]));
                }

                MeshSlice slice;
                populate_slice_metadata(doc, group.owner_id, group.owner_info, slice);
                slice.baseVertex = base;
                slice.vertexCount = static_cast<uint32_t>(flat.size());
                slice.indexOffset = index_offset;
                slice.indexCount = static_cast<uint32_t>(index_count2);
                slices.push_back(slice);
            }
        }

        const bool has_mesh = !positions.empty() && !indices.empty();
        const bool has_lines = !line_positions.empty() && !line_indices.empty();
        if (line_only) {
            if (!has_lines) {
                std::cerr << "glTF export failed: no line geometry data\n";
                cadgf_document_destroy(doc);
                return 1;
            }
            if (!write_gltf_lines(gltf_path, bin_path, line_positions, line_indices, doc, &err)) {
                std::cerr << "glTF export failed: " << err << "\n";
                cadgf_document_destroy(doc);
                return 1;
            }
            wrote_gltf = true;
            wrote_bin = true;
            const std::string meta_path = (fs::path(opts.outDir) / "mesh_metadata.json").string();
            if (!write_mesh_metadata(doc, meta_path, gltf_path, bin_path, line_slices, &line_slices, &err)) {
                std::cerr << "metadata export failed: " << err << "\n";
                cadgf_document_destroy(doc);
                return 1;
            }
            wrote_meta = true;
        } else if (has_mesh && has_lines) {
            if (!write_gltf_combined(gltf_path, bin_path, positions, indices, line_positions, line_indices, doc, &err)) {
                std::cerr << "glTF export failed: " << err << "\n";
                cadgf_document_destroy(doc);
                return 1;
            }
            wrote_gltf = true;
            wrote_bin = true;
            const std::string meta_path = (fs::path(opts.outDir) / "mesh_metadata.json").string();
            if (!write_mesh_metadata(doc, meta_path, gltf_path, bin_path, slices, &line_slices, &err)) {
                std::cerr << "metadata export failed: " << err << "\n";
                cadgf_document_destroy(doc);
                return 1;
            }
            wrote_meta = true;
        } else if (has_mesh) {
            if (!write_gltf(gltf_path, bin_path, positions, indices, doc, &err)) {
                std::cerr << "glTF export failed: " << err << "\n";
                cadgf_document_destroy(doc);
                return 1;
            }
            wrote_gltf = true;
            wrote_bin = true;
            const std::string meta_path = (fs::path(opts.outDir) / "mesh_metadata.json").string();
            if (!write_mesh_metadata(doc, meta_path, gltf_path, bin_path, slices, nullptr, &err)) {
                std::cerr << "metadata export failed: " << err << "\n";
                cadgf_document_destroy(doc);
                return 1;
            }
            wrote_meta = true;
        } else if (has_lines) {
            if (!write_gltf_lines(gltf_path, bin_path, line_positions, line_indices, doc, &err)) {
                std::cerr << "glTF export failed: " << err << "\n";
                cadgf_document_destroy(doc);
                return 1;
            }
            wrote_gltf = true;
            wrote_bin = true;
            const std::string meta_path = (fs::path(opts.outDir) / "mesh_metadata.json").string();
            if (!write_mesh_metadata(doc, meta_path, gltf_path, bin_path, line_slices, &line_slices, &err)) {
                std::cerr << "metadata export failed: " << err << "\n";
                cadgf_document_destroy(doc);
                return 1;
            }
            wrote_meta = true;
        } else {
            std::cerr << "glTF export failed: no geometry data\n";
            cadgf_document_destroy(doc);
            return 1;
        }
#else
        std::cerr << "[WARN] TinyGLTF not available; skipping glTF export.\n";
#endif
    }

    if (!write_manifest_json(opts, wrote_json, wrote_gltf, wrote_bin, wrote_meta, &err)) {
        std::cerr << "manifest export failed: " << err << "\n";
        cadgf_document_destroy(doc);
        return 1;
    }

    cadgf_document_destroy(doc);
    std::cout << "Converted: " << opts.inputPath << " -> " << opts.outDir << "\n";
    return 0;
}
