cmake_minimum_required(VERSION 3.20)
project(LoginGuardsPwdFilter LANGUAGES CXX)

add_library(LoginGuardsPwdFilter SHARED
    LoginGuardsPwdFilter.cpp
    LoginGuardsPwdFilter.def
)

# Unicode, secure warnings off for system context
if (MSVC)
  target_compile_definitions(LoginGuardsPwdFilter PRIVATE UNICODE _UNICODE)
  target_compile_options(LoginGuardsPwdFilter PRIVATE /W3 /guard:cf-)
endif()

set_target_properties(LoginGuardsPwdFilter PROPERTIES
  OUTPUT_NAME "LoginGuardsPwdFilter"
  CXX_STANDARD 17
  CXX_STANDARD_REQUIRED YES
  WINDOWS_EXPORT_ALL_SYMBOLS OFF
)

# No extra deps; win32 API only

