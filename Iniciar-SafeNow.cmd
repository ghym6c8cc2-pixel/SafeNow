@echo off
setlocal
cd /d "%~dp0"
set "SAFENOW_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "SAFENOW_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  ) else (
    echo Instale Node.js 22.13 ou superior para iniciar o SafeNow.
    pause
    exit /b 1
  )
)
if not exist "dist\index.html" (
  echo A previa ainda nao foi compilada. Execute npm ci e npm run export:web.
  pause
  exit /b 1
)
echo Abra http://localhost:3000 no navegador.
echo Mantenha esta janela aberta enquanto usa o aplicativo.
"%SAFENOW_NODE%" scripts\preview.mjs
pause
