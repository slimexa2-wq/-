@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-mineradio-companion.ps1"
if errorlevel 1 (
  echo.
  echo 启动失败，请查看上方错误信息。
  pause
)
endlocal
