#pragma once

#include <string>
#include <utility>

#if defined(_WIN32)
#  include <windows.h>
#else
#  include <dlfcn.h>
#endif

class SharedLibrary {
public:
    SharedLibrary() = default;
    ~SharedLibrary() { close(); }

    SharedLibrary(const SharedLibrary&) = delete;
    SharedLibrary& operator=(const SharedLibrary&) = delete;

    SharedLibrary(SharedLibrary&& other) noexcept { *this = std::move(other); }
    SharedLibrary& operator=(SharedLibrary&& other) noexcept {
        if (this == &other) return *this;
        close();
        handle_ = other.handle_;
        path_ = std::move(other.path_);
        other.handle_ = nullptr;
        return *this;
    }

    bool open(const std::string& path, std::string* err) {
        close();
        path_ = path;
#if defined(_WIN32)
        const std::wstring wpath = utf8_to_wide(path);
        if (wpath.empty()) {
            set_err(err, "invalid UTF-8 path");
            return false;
        }
        handle_ = ::LoadLibraryW(wpath.c_str());
        if (!handle_) {
            set_err(err, "LoadLibraryW failed: " + win32_last_error_string(::GetLastError()));
            return false;
        }
#else
        handle_ = ::dlopen(path.c_str(), RTLD_NOW | RTLD_LOCAL);
        if (!handle_) {
            const char* msg = ::dlerror();
            set_err(err, msg ? msg : "dlopen failed");
            return false;
        }
#endif
        return true;
    }

    void close() {
        if (!handle_) return;
#if defined(_WIN32)
        ::FreeLibrary(handle_);
#else
        ::dlclose(handle_);
#endif
        handle_ = nullptr;
        path_.clear();
    }

    bool is_open() const { return handle_ != nullptr; }
    const std::string& path() const { return path_; }

    void* symbol(const char* name, std::string* err) const {
        if (!handle_) {
            set_err(err, "library not open");
            return nullptr;
        }
        if (!name || !*name) {
            set_err(err, "invalid symbol name");
            return nullptr;
        }
#if defined(_WIN32)
        FARPROC p = ::GetProcAddress(handle_, name);
        if (!p) {
            set_err(err, std::string("GetProcAddress failed: ") + name);
            return nullptr;
        }
        return reinterpret_cast<void*>(p);
#else
        ::dlerror(); // clear
        void* p = ::dlsym(handle_, name);
        const char* msg = ::dlerror();
        if (msg) {
            set_err(err, msg);
            return nullptr;
        }
        return p;
#endif
    }

    template <typename T>
    T symbol(const char* name, std::string* err) const {
        return reinterpret_cast<T>(symbol(name, err));
    }

private:
    static void set_err(std::string* err, const std::string& msg) {
        if (err) *err = msg;
    }

#if defined(_WIN32)
    static std::wstring utf8_to_wide(const std::string& s) {
        if (s.empty()) return std::wstring();
        const int wlen = ::MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0);
        if (wlen <= 0) return std::wstring();
        std::wstring w(static_cast<size_t>(wlen), L'\0');
        const int written = ::MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, w.data(), wlen);
        if (written <= 0) return std::wstring();
        if (!w.empty() && w.back() == L'\0') w.pop_back();
        return w;
    }

    static std::string wide_to_utf8(const wchar_t* w) {
        if (!w) return std::string();
        const int len = ::WideCharToMultiByte(CP_UTF8, 0, w, -1, nullptr, 0, nullptr, nullptr);
        if (len <= 0) return std::string();
        std::string out(static_cast<size_t>(len), '\0');
        const int written = ::WideCharToMultiByte(CP_UTF8, 0, w, -1, out.data(), len, nullptr, nullptr);
        if (written <= 0) return std::string();
        if (!out.empty() && out.back() == '\0') out.pop_back();
        return out;
    }

    static std::string win32_last_error_string(DWORD code) {
        if (code == 0) return std::string();

        LPWSTR buf = nullptr;
        const DWORD flags = FORMAT_MESSAGE_ALLOCATE_BUFFER | FORMAT_MESSAGE_FROM_SYSTEM | FORMAT_MESSAGE_IGNORE_INSERTS;
        const DWORD len = ::FormatMessageW(flags, nullptr, code, 0, reinterpret_cast<LPWSTR>(&buf), 0, nullptr);
        std::string msg;
        if (len > 0 && buf) msg = wide_to_utf8(buf);
        if (buf) ::LocalFree(buf);

        if (msg.empty()) msg = "code=" + std::to_string(static_cast<unsigned long>(code));
        return msg;
    }

    HMODULE handle_ = nullptr;
#else
    void* handle_ = nullptr;
#endif
    std::string path_;
};

