@echo off
cd /d "%~dp0"
call npm run build
if %errorlevel% neq 0 pause & exit /b %errorlevel%
node server.cjs
pause
