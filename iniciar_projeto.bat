@echo off
title Indicadores EM
color 0A

echo ============================================
echo   Indicadores EM - Iniciando Sistema
echo ============================================
echo.

:: ── BACKEND ────────────────────────────────────────────────
echo [1/2] Iniciando Backend (FastAPI porta 8000)...
start "ERP - Backend" "%~dp0backend\_start.bat"

timeout /t 3 /nobreak >nul

:: ── FRONTEND ────────────────────────────────────────────────
echo [2/2] Iniciando Frontend (Next.js porta 3000)...
start "ERP - Frontend" "%~dp0frontend\_start.bat"

:: ── NAVEGADOR (abre apos compilacao) ────────────────────────
echo.
echo Aguardando compilacao inicial (25s)...
timeout /t 25 /nobreak >nul
start http://localhost:3000

echo.
echo ============================================
echo   Backend:  http://127.0.0.1:8000
echo   Frontend: http://localhost:3000
echo   API Docs: http://127.0.0.1:8000/docs
echo ============================================
timeout /t 4 /nobreak >nul
exit
