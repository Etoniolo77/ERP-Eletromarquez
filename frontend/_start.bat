@echo off
title Indicadores EM - Frontend
color 0B
cd /d "%~dp0.."
echo.
echo ============================================
echo   Iniciando Indicadores EM (Next.js) em %CD%
echo ============================================
echo.

if not exist node_modules (
    echo [AVISO] node_modules nao encontrado. Instalando dependencias...
    call npm install
)

npm run dev
pause
