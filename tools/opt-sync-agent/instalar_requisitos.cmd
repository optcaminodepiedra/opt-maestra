@echo off
setlocal
where py >nul 2>nul
if %errorlevel%==0 goto :ok
where python >nul 2>nul
if %errorlevel%==0 goto :ok

echo Python 3 no esta instalado. Se intentara instalar con Winget.
where winget >nul 2>nul
if not %errorlevel%==0 (
  echo.
  echo Winget no esta disponible.
  echo Instala Python 3 desde Microsoft Store y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

winget install --exact --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
if not %errorlevel%==0 (
  echo No se pudo instalar Python automaticamente.
  pause
  exit /b 1
)

echo.
echo Python fue instalado. Cierra esta ventana y vuelve a abrir la carpeta del agente.
pause
exit /b 0

:ok
for /f "delims=" %%V in ('py -3 --version 2^>nul') do echo %%V
if errorlevel 1 python --version
echo Requisitos listos.
pause
