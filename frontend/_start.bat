@echo off
cd /d "%~dp0"
echo Frontend iniciando em %CD%...
if exist .next (
    echo Limpando cache .next...
    rmdir /s /q .next
)
if not exist node_modules\ (
    echo Instalando dependencias...
    npm install
)
npm run dev
pause
