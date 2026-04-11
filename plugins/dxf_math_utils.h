#pragma once
// DXF math/parse utilities extracted from dxf_importer_plugin.cpp.
// Pure leaf module -- no internal project dependencies beyond the C ABI header.

#include "core/plugin_abi_c_v1.h"

#include <cmath>
#include <cstdint>
#include <string>

// ---------- constants --------------------------------------------------------
constexpr double kPi = 3.14159265358979323846;
constexpr double kTwoPi = kPi * 2.0;
constexpr double kDegToRad = kPi / 180.0;

// ---------- cadgf_string_view helper ----------------------------------------
cadgf_string_view sv(const char* s);

// ---------- numeric comparison -----------------------------------------------
bool nearly_equal(double a, double b, double eps = 1e-6);
bool points_nearly_equal(const cadgf_vec2& a, const cadgf_vec2& b, double eps = 1e-6);

// ---------- parsing ----------------------------------------------------------
bool parse_int(const std::string& s, int* out);
bool parse_double(const std::string& s, double* out);

// ---------- line helpers -----------------------------------------------------
void trim_code_line(std::string* line);
void strip_cr(std::string* line);

// ---------- error helper -----------------------------------------------------
void set_error(cadgf_error_v1* err, int32_t code, const char* msg);
