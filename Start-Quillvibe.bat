@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

set "FILE_ARG="
if not "%~1"=="" set "FILE_ARG=%~f1"

if exist "src-tauri\target\release\quillvibe.exe" (
    if defined FILE_ARG (
        start "" "src-tauri\target\release\quillvibe.exe" "%FILE_ARG%"
    ) else (
        start "" "src-tauri\target\release\quillvibe.exe"
    )
    exit /b 0
)

if exist "src-tauri\target\debug\quillvibe.exe" (
    if defined FILE_ARG (
        start "" "src-tauri\target\debug\quillvibe.exe" "%FILE_ARG%"
    ) else (
        start "" "src-tauri\target\debug\quillvibe.exe"
    )
    exit /b 0
)

if not exist "node_modules" (
    where npm >nul 2>&1
    if errorlevel 1 (
        echo Quillvibe executable not built and Node.js/npm was not found in PATH.
        echo Install Node.js or download a prebuilt Quillvibe release from GitHub.
        pause
        exit /b 1
    )
    echo Installing Quillvibe local dependencies for first run...
    call npm install
    if errorlevel 1 exit /b 1
)

where cargo >nul 2>&1
if not errorlevel 1 (
    echo Building Quillvibe native desktop app...
    call npm run tauri:build
    if exist "src-tauri\target\release\quillvibe.exe" (
        if defined FILE_ARG (
            start "" "src-tauri\target\release\quillvibe.exe" "%FILE_ARG%"
        ) else (
            start "" "src-tauri\target\release\quillvibe.exe"
        )
        exit /b 0
    )
)

echo Launching Quillvibe local studio...
start "" http://localhost:1420
call npm run dev
