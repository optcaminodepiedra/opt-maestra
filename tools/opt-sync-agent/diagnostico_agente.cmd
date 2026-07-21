@echo off
setlocal
cd /d "%~dp0"
echo ===== PYTHON =====
where py
where python
echo.
echo ===== CONFIGURACION =====
if exist config.json type config.json
if not exist config.json echo No existe config.json
echo.
echo ===== ESTADO =====
if exist state.json type state.json
if not exist state.json echo No existe state.json
echo.
echo ===== ULTIMAS 80 LINEAS DEL LOG =====
if exist logs\agent.log powershell -NoProfile -Command "Get-Content -Path 'logs\agent.log' -Tail 80"
if not exist logs\agent.log echo Todavia no existe log.
pause
