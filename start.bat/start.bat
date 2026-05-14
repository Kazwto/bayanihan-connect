@echo off
setlocal

REM Runs backend and frontend from the repo folder (no hardcoded Downloads path)

set "REPO_DIR=%~dp0.."
set "BACKEND_DIR=%REPO_DIR%\backend"
set "FRONTEND_DIR=%REPO_DIR%\frontend"

start "Backend" cmd /k "cd /d ""%BACKEND_DIR%"" && npm install && npm run dev"
start "Frontend" cmd /k "cd /d ""%FRONTEND_DIR%"" && npx http-server -p 3000"
start "" "http://localhost:3000"

endlocal
