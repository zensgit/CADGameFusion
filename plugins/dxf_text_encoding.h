#pragma once
// DXF text/encoding utilities extracted from dxf_importer_plugin.cpp.
// Pure string functions with zero internal dependencies.

#include <string>

// Validate that a byte sequence is well-formed UTF-8.
bool is_valid_utf8(const std::string& value);

// Convert Latin-1 (ISO 8859-1) bytes to UTF-8.
std::string latin1_to_utf8(const std::string& value);

// Normalize a DXF $DWGCODEPAGE value to an iconv-compatible encoding name
// (e.g. "ANSI_1252" -> "CP1252", "UTF8" -> "UTF-8").
// Returns empty string if the codepage cannot be mapped.
std::string normalize_dxf_codepage(const std::string& raw);

// Attempt iconv-based conversion.  Returns empty string on failure or when
// iconv is unavailable (Windows).
std::string convert_to_utf8_iconv(const std::string& value,
                                  const std::string& encoding);

// High-level: ensure `value` is valid UTF-8.  Tries iconv with the given
// codepage first; falls back to latin1_to_utf8 if that fails.
std::string sanitize_utf8(const std::string& value,
                          const std::string& codepage);
