@echo off
title Parlor
echo.
echo  Starting Parlor...
echo.

:: Check for Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo  [ERROR] Node.js is not installed.
    echo  Download it from https://nodejs.org/ (v18 or newer)
    echo.
    pause
    exit /b 1
)

:: Check Node version (need 18+)
for /f "tokens=1 delims=." %%v in ('node -v 2^>nul') do set NODE_VER=%%v
set NODE_VER=%NODE_VER:v=%
if %NODE_VER% lss 18 (
    echo  [ERROR] Node.js 18+ is required. You have v%NODE_VER%.
    echo  Download a newer version from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist node_modules (
    echo  Installing dependencies...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] npm install failed.
        pause
        exit /b 1
    )
    echo.
)

:: Build if dist/ doesn't exist
if not exist dist (
    echo  Building Parlor...
    echo.
    call npm run build
    if %errorlevel% neq 0 (
        echo.
        echo  [ERROR] Build failed.
        pause
        exit /b 1
    )
    echo.
)

:: Start the server
echo  Parlor is running at http://localhost:3001
echo  Press Ctrl+C to stop.
echo.
node server.cjs
pause
