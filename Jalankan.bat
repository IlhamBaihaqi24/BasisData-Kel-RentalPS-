@echo off
chcp 65001 >nul
title TitikTemu - Server
cd /d "%~dp0backend"

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js belum terpasang. Unduh versi LTS di https://nodejs.org lalu jalankan file ini lagi.
  pause
  exit /b
)

if not exist node_modules (
  echo Memasang kebutuhan program ^(hanya sekali, butuh internet^)...
  call npm install
)

echo.
echo ===============================================
echo   TitikTemu menyala. Browser akan terbuka.
echo   Kalau tidak, buka: http://localhost:3000
echo   Tutup jendela ini untuk mematikan server.
echo ===============================================
echo.
start "" http://localhost:3000
node src/server.js
pause
