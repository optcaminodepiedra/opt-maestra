@echo off
setlocal
set "TARGET=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\OPT Sync Agent.cmd"
if exist "%TARGET%" del /q "%TARGET%"
echo Inicio automatico eliminado.
pause
