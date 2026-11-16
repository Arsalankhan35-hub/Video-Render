@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js 18 or newer from https://nodejs.org/
  pause
  exit /b 1
)
start "Motioncraft server" cmd /k "cd /d "%~dp0" ^&^& node server.js"
timeout /t 2 /nobreak >nul
start "" http://localhost:3000
