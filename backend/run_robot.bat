@echo off
echo ==========================================
echo INICIANDO ROBO DE SINCRONIZACAO - PORTAL
echo ==========================================

cd /d "%~dp0"

REM Ativa o ambiente virtual local se existir
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

REM Executa o script Python
python robot_sync.py

echo.
echo ==========================================
echo SINCRONIZACAO CONCLUIDA
echo Aguardando fechamento...
timeout /t 10
