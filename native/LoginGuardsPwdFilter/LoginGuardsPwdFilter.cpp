// LoginGuardsPwdFilter - Windows Password Filter DLL (x64)
// Exports: InitializeChangeNotify, PasswordFilter, PasswordChangeNotify
// LSASS-safe: no network calls; minimal Win32 API; named pipe client only.
// Default policy on error: fail-open (allow), with 1500ms timeout.

#include <windows.h>
#include <string>
#include <vector>
#include <stdint.h>

// UNICODE_STRING from WinNT headers; ensure linkage
#include <ntsecapi.h>

// Constants
static const wchar_t* PIPE_NAME = L"\\\\.\\pipe\\LoginGuardsPwdFilter";
static const DWORD DEFAULT_TIMEOUT_MS = 1500; // per requirements

// Minimal JSON writer (no dependencies)
static std::string Utf16ToUtf8(const std::wstring& ws) {
    if (ws.empty()) return std::string();
    int len = WideCharToMultiByte(CP_UTF8, 0, ws.c_str(), (int)ws.size(), nullptr, 0, nullptr, nullptr);
    std::string out((size_t)len, '\0');
    WideCharToMultiByte(CP_UTF8, 0, ws.c_str(), (int)ws.size(), &out[0], len, nullptr, nullptr);
    return out;
}

static std::wstring UnicodeStringToWString(PUNICODE_STRING us) {
    if (!us || !us->Buffer || us->Length == 0) return std::wstring();
    return std::wstring(us->Buffer, us->Length / sizeof(WCHAR));
}

static std::string JsonEscape(const std::string& s) {
    std::string out; out.reserve(s.size() + 16);
    for (char c : s) {
        switch (c) {
        case '"': out += "\\\""; break;
        case '\\': out += "\\\\"; break;
        case '\b': out += "\\b"; break;
        case '\f': out += "\\f"; break;
        case '\n': out += "\\n"; break;
        case '\r': out += "\\r"; break;
        case '\t': out += "\\t"; break;
        default:
            if ((unsigned char)c < 0x20) {
                char buf[7];
                wsprintfA(buf, "\\u%04x", (unsigned char)c);
                out += buf;
            } else { out += c; }
        }
    }
    return out;
}

static ULONGLONG GetNowMs() { return GetTickCount64(); }

static bool PipeExchangeJSONL(const std::string& jsonLine, std::string& response, DWORD timeoutMs) {
    ULONGLONG deadline = GetNowMs() + timeoutMs;

    // Wait for pipe availability within timeout
    DWORD wait = timeoutMs;
    if (!WaitNamedPipeW(PIPE_NAME, wait)) {
        return false; // fail-open
    }

    HANDLE h = CreateFileW(PIPE_NAME, GENERIC_READ | GENERIC_WRITE, 0, nullptr, OPEN_EXISTING,
                            FILE_ATTRIBUTE_NORMAL /*non-overlapped for simplicity*/, nullptr);
    if (h == INVALID_HANDLE_VALUE) {
        return false;
    }

    // Write JSON + \n
    std::string payload = jsonLine;
    if (payload.empty() || payload.back() != '\n') payload.push_back('\n');

    DWORD written = 0;
    BOOL ok = WriteFile(h, payload.data(), (DWORD)payload.size(), &written, nullptr);
    if (!ok) { CloseHandle(h); return false; }

    // Read until newline or timeout
    response.clear();
    char buf[256];
    while (GetNowMs() < deadline) {
        DWORD avail = 0;
        if (!PeekNamedPipe(h, nullptr, 0, nullptr, &avail, nullptr)) { break; }
        if (avail == 0) {
            Sleep(5);
            continue;
        }
        DWORD read = 0;
        if (!ReadFile(h, buf, min<DWORD>(sizeof(buf), avail), &read, nullptr)) { break; }
        response.append(buf, buf + read);
        // Check for newline
        size_t pos = response.find('\n');
        if (pos != std::string::npos) {
            response.resize(pos);
            break;
        }
    }

    CloseHandle(h);
    return !response.empty();
}

static bool ShouldAllowFromResponse(const std::string& respJson) {
    // Very small parser: look for '"allow":true' or '"allow":false'
    const char* s = respJson.c_str();
    const char* p = strstr(s, "\"allow\"");
    if (!p) return true; // default allow
    p = strchr(p, ':');
    if (!p) return true;
    while (*p == ':' || *p == ' ' || *p == '\t') ++p;
    if (strncmp(p, "true", 4) == 0) return true;
    if (strncmp(p, "false", 5) == 0) return false;
    return true;
}

// Exported functions
BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
    switch (ul_reason_for_call) {
    case DLL_PROCESS_ATTACH:
    case DLL_THREAD_ATTACH:
    case DLL_THREAD_DETACH:
    case DLL_PROCESS_DETACH:
        break;
    }
    return TRUE;
}

extern "C" __declspec(dllexport) BOOLEAN __stdcall InitializeChangeNotify(void) {
    return TRUE; // minimal init OK
}

extern "C" __declspec(dllexport) BOOLEAN __stdcall PasswordFilter(
    PUNICODE_STRING AccountName,
    PUNICODE_STRING FullName,
    PUNICODE_STRING Password,
    BOOLEAN SetOperation
) {
    // Build JSON: {"password":"...","username":"...","op":"set|change"}
    std::wstring wPwd = UnicodeStringToWString(Password);
    std::wstring wUser = UnicodeStringToWString(AccountName);
    std::string pwdUtf8 = Utf16ToUtf8(wPwd);
    std::string userUtf8 = Utf16ToUtf8(wUser);

    // Construct JSON line without logging secrets
    std::string json = "{";
    json += "\"password\":\"" + JsonEscape(pwdUtf8) + "\",";
    if (!userUtf8.empty()) json += "\"username\":\"" + JsonEscape(userUtf8) + "\",";
    json += "\"op\":\"";
    json += SetOperation ? "reset" : "change";
    json += "\"}";

    std::string resp;
    bool ok = PipeExchangeJSONL(json, resp, DEFAULT_TIMEOUT_MS);
    if (!ok) {
        // fail-open default
        return TRUE;
    }
    bool allow = ShouldAllowFromResponse(resp);
    return allow ? TRUE : FALSE;
}

extern "C" __declspec(dllexport) NTSTATUS __stdcall PasswordChangeNotify(
    PUNICODE_STRING UserName,
    ULONG RelativeId,
    PUNICODE_STRING NewPassword
) {
    // Post-change notification; we return success to avoid blocking.
    return 0; // STATUS_SUCCESS
}
