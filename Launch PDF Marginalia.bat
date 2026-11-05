@echo off
cd /d "%~dp0"
start "PDF Marginalia server (close to stop)" /min cmd /c "node server.js"
timeout /t 2 /nobreak >nul
start "" http://localhost:8787
