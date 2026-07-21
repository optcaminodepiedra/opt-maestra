@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 opt_sync_agent.py
) else (
  python opt_sync_agent.py
)
