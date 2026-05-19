@echo off
title Parlor Server
echo [Parlor] Starting server...

:: Kill any existing server on port 3001
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3001.*LISTENING" 2^>nul') do (
    echo [Parlor] Stopping previous server (PID %%p)...
    taskkill /F /PID %%p >nul 2>nul
    timeout /t 1 /nobreak >nul
)

:: Start the server in background
echo [Parlor] Parlor is running at http://localhost:3001
echo.
start /b node "%~dp0..\server.cjs"
