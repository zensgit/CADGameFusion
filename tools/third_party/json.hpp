// nlohmann/json single-header (minimal stub note)
// For brevity in this patch, we assume the full header is provided in the repo.
// If missing, add the official single-header from https://github.com/nlohmann/json/releases
#pragma once
#include <map>
#include <vector>
#include <string>
#include <variant>
#include <initializer_list>
#include <stdexcept>
#include <type_traits>
#include <cstddef>
#include <istream>

// This is a very small compatibility shim to satisfy compilation in this environment.
// In your real repo, replace this file with the official nlohmann/json.hpp.
namespace nlohmann {
class json {
public:
    using object_t = std::map<std::string, json>;
    using array_t  = std::vector<json>;
    using string_t = std::string;
    using number_t = double;
    using boolean_t = bool;

    json() : data_(nullptr) {}
    json(std::nullptr_t) : data_(nullptr) {}
    json(const object_t& v) : data_(v) {}
    json(object_t&& v) : data_(std::move(v)) {}
    json(const array_t& v) : data_(v) {}
    json(array_t&& v) : data_(std::move(v)) {}
    json(const string_t& v) : data_(v) {}
    json(string_t&& v) : data_(std::move(v)) {}
    json(const char* v) : data_(string_t(v)) {}
    json(double v) : data_(v) {}
    json(int v) : data_(static_cast<double>(v)) {}
    json(bool v) : data_(v) {}

    bool is_object() const { return std::holds_alternative<object_t>(data_); }
    bool is_array() const { return std::holds_alternative<array_t>(data_); }
    bool is_string() const { return std::holds_alternative<string_t>(data_); }

    object_t& get_object() { return std::get<object_t>(data_); }
    const object_t& get_object() const { return std::get<object_t>(data_); }
    array_t& get_array() { return std::get<array_t>(data_); }
    const array_t& get_array() const { return std::get<array_t>(data_); }
    string_t& get_string() { return std::get<string_t>(data_); }
    const string_t& get_string() const { return std::get<string_t>(data_); }

    // Lookup
    bool contains(const std::string& k) const {
        if (!is_object()) return false;
        return get_object().count(k) > 0;
    }
    json& operator[](const std::string& k) { return get_object()[k]; }
    const json& operator[](const std::string& k) const { return get_object().at(k); }

    // Array access
    json& operator[](size_t i) { return get_array()[i]; }
    const json& operator[](size_t i) const { return get_array()[i]; }
    size_t size() const { return is_array() ? get_array().size() : 0; }

    // Iteration
    array_t::const_iterator begin() const { return get_array().begin(); }
    array_t::const_iterator end() const { return get_array().end(); }

    // value with default
    template<typename T>
    T value(const std::string& key, const T& def) const {
        if (!is_object()) return def;
        auto it = get_object().find(key);
        if (it == get_object().end()) return def;
        return it->second.get<T>();
    }

    template<typename T>
    T get() const {
        if constexpr (std::is_same_v<T, int>) {
            if (std::holds_alternative<number_t>(data_)) return static_cast<int>(std::get<number_t>(data_));
            throw std::runtime_error("json: not a number");
        } else if constexpr (std::is_same_v<T, double>) {
            if (std::holds_alternative<number_t>(data_)) return std::get<number_t>(data_);
            throw std::runtime_error("json: not a number");
        } else if constexpr (std::is_same_v<T, bool>) {
            if (std::holds_alternative<boolean_t>(data_)) return std::get<boolean_t>(data_);
            throw std::runtime_error("json: not a bool");
        } else if constexpr (std::is_same_v<T, std::string>) {
            if (std::holds_alternative<string_t>(data_)) return std::get<string_t>(data_);
            throw std::runtime_error("json: not a string");
        } else {
            static_assert(sizeof(T) == 0, "json::get<T> not implemented in stub");
        }
    }

    // Basic stream parser: this is not a real JSON parser.
    // It's a stub and will throw to force replacement with real header.
    friend std::istream& operator>>(std::istream& is, json& j) {
        throw std::runtime_error("Stub json.hpp in use. Replace with nlohmann/json.hpp");
    }

private:
    std::variant<std::nullptr_t, object_t, array_t, string_t, number_t, boolean_t> data_;
};
} // namespace nlohmann

