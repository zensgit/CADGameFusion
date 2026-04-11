#include "dxf_text_encoding.h"

#include <cctype>

#if defined(__APPLE__) || defined(__linux__)
#include <iconv.h>
#define CADGF_HAVE_ICONV 1
#else
#define CADGF_HAVE_ICONV 0
#endif

// ---------- internal helpers (file-scope only) --------------------------------
namespace {

bool all_digits(const std::string& value) {
    if (value.empty()) return false;
    for (char c : value) {
        if (!std::isdigit(static_cast<unsigned char>(c))) return false;
    }
    return true;
}

} // anonymous namespace

// ---------- public API -------------------------------------------------------

bool is_valid_utf8(const std::string& value) {
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

std::string latin1_to_utf8(const std::string& value) {
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

std::string normalize_dxf_codepage(const std::string& raw) {
    std::string cleaned;
    cleaned.reserve(raw.size());
    for (char c : raw) {
        if (std::isalnum(static_cast<unsigned char>(c))) {
            cleaned.push_back(static_cast<char>(std::toupper(static_cast<unsigned char>(c))));
        }
    }
    if (cleaned.empty()) return {};
    if (cleaned == "UTF8" || cleaned == "UTF") return "UTF-8";
    if (cleaned == "GBK" || cleaned == "GB2312" || cleaned == "ANSI936") return "CP936";
    if (cleaned == "BIG5" || cleaned == "BIG5HKSCS" || cleaned == "ANSI950") return "CP950";
    if (cleaned == "ANSI949" || cleaned == "KSC5601") return "CP949";
    if (cleaned == "ANSI932" || cleaned == "SJIS" || cleaned == "SHIFTJIS") return "CP932";
    if (cleaned.rfind("ANSI", 0) == 0) {
        const std::string digits = cleaned.substr(4);
        if (all_digits(digits)) {
            return "CP" + digits;
        }
    }
    if (cleaned.rfind("DOS", 0) == 0) {
        const std::string digits = cleaned.substr(3);
        if (all_digits(digits)) {
            return "CP" + digits;
        }
    }
    if (cleaned.rfind("CP", 0) == 0) {
        const std::string digits = cleaned.substr(2);
        if (all_digits(digits)) {
            return "CP" + digits;
        }
    }
    return {};
}

std::string convert_to_utf8_iconv(const std::string& value,
                                  const std::string& encoding) {
#if CADGF_HAVE_ICONV
    if (encoding.empty()) return {};
    iconv_t cd = iconv_open("UTF-8", encoding.c_str());
    if (cd == reinterpret_cast<iconv_t>(-1)) return {};
    size_t in_left = value.size();
    size_t out_left = value.size() * 4 + 8;
    std::string out(out_left, '\0');
    char* in_buf = const_cast<char*>(value.data());
    char* out_buf = out.data();
    size_t result = iconv(cd, &in_buf, &in_left, &out_buf, &out_left);
    iconv_close(cd);
    if (result == static_cast<size_t>(-1)) return {};
    out.resize(out.size() - out_left);
    return out;
#else
    (void)value;
    (void)encoding;
    return {};
#endif
}

std::string sanitize_utf8(const std::string& value,
                          const std::string& codepage) {
    if (value.empty()) {
        return value;
    }
    if (is_valid_utf8(value)) {
        return value;
    }
    const std::string encoding = normalize_dxf_codepage(codepage);
    if (!encoding.empty() && encoding != "UTF-8") {
        const std::string converted = convert_to_utf8_iconv(value, encoding);
        if (!converted.empty() && is_valid_utf8(converted)) {
            return converted;
        }
    }
    return latin1_to_utf8(value);
}
