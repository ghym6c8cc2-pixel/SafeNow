@echo off
setlocal
cd /d "%~dp0"
set "SAFENOW_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "SAFENOW_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  ) else (
    echo Instale Node.js 22.13 ou superior.
    pause
    exit /b 1
  )
)
if not exist "node_modules\expo\bin\cli" (
  echo Instale as dependencias com npm ci antes de iniciar o desenvolvimento.
  pause
  exit /b 1
)
"%SAFENOW_NODE%" node_modules\expo\bin\cli start --web --port 3000
pause
