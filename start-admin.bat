@echo off
echo Starting Drape Admin Dashboard...
echo.

:: Start API server in background
start "Drape Admin API" cmd /c "cd /d %~dp0 && npm run server"

:: Wait a moment
timeout /t 2 /nobreak > nul

:: Start HTTP server
start "Drape Admin Site" cmd /c "cd /d %~dp0 && python -m http.server 8000"

:: Wait a moment
timeout /t 2 /nobreak > nul

:: Open browser
start http://localhost:8000/admin/dashboard.html

echo.
echo Dashboard running at: http://localhost:8000/admin/dashboard.html
echo.
echo Press any key to stop servers...
pause > nul

:: Kill servers
taskkill /FI "WINDOWTITLE eq Drape Admin*" /F > nul 2>&1
