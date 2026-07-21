@echo off
setlocal
cd /d "%~dp0"
if not exist config.json (
  echo Primero se abrira la configuracion del agente.
  call configurar_agente.cmd
)
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "TARGET=%STARTUP%\OPT Sync Agent.cmd"
> "%TARGET%" echo @echo off
>> "%TARGET%" echo start "" /min cmd /c call "%~dp0iniciar_agente.cmd"
echo.
echo Inicio automatico instalado correctamente.
echo Archivo creado: %TARGET%
echo El agente se iniciara al entrar a Windows.
pause
