#include "dxf_math_utils.h"

#include <cstdio>
#include <cstdlib>
#include <cstring>

// ---------- cadgf_string_view helper ----------------------------------------
cadgf_string_view sv(const char* s) {
    cadgf_string_view v;
    v.data = s;
    v.size = s ? static_cast<int32_t>(std::strlen(s)) : 0;
    return v;
}

// ---------- numeric comparison -----------------------------------------------
bool nearly_equal(double a, double b, double eps) {
    return std::fabs(a - b) <= eps;
}

bool points_nearly_equal(const cadgf_vec2& a, const cadgf_vec2& b, double eps) {
    return nearly_equal(a.x, b.x, eps) && nearly_equal(a.y, b.y, eps);
}

// ---------- parsing ----------------------------------------------------------
bool parse_int(const std::string& s, int* out) {
    if (!out) return false;
    char* end = nullptr;
    long v = std::strtol(s.c_str(), &end, 10);
    if (!end || *end != '\0') return false;
    *out = static_cast<int>(v);
    return true;
}

bool parse_double(const std::string& s, double* out) {
    if (!out) return false;
    char* end = nullptr;
    double v = std::strtod(s.c_str(), &end);
    if (!end || *end != '\0') return false;
    if (!std::isfinite(v)) return false;
    *out = v;
    return true;
}

// ---------- line helpers -----------------------------------------------------
void trim_code_line(std::string* line) {
    if (!line) return;
    while (!line->empty()) {
        char ch = line->back();
        if (ch == '\r' || ch == ' ' || ch == '\t') {
            line->pop_back();
            continue;
        }
        break;
    }
    size_t start = 0;
    while (start < line->size()) {
        char ch = (*line)[start];
        if (ch == ' ' || ch == '\t') {
            ++start;
            continue;
        }
        break;
    }
    if (start > 0) {
        line->erase(0, start);
    }
}

void strip_cr(std::string* line) {
    if (!line || line->empty()) return;
    if (line->back() == '\r') {
        line->pop_back();
    }
}

// ---------- error helper -----------------------------------------------------
void set_error(cadgf_error_v1* err, int32_t code, const char* msg) {
    if (!err) return;
    err->code = code;
    if (!msg) {
        err->message[0] = 0;
        return;
    }
    std::snprintf(err->message, sizeof(err->message), "%s", msg);
    err->message[sizeof(err->message) - 1] = 0;
}
