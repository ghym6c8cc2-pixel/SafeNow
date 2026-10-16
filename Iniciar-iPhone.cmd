@echo off
setlocal
title SafeNow - iPhone
cd /d "%~dp0"
set "SAFENOW_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    set "SAFENOW_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  ) else (
    echo Nao foi encontrado o Node.js. Instale Node.js 22.13 ou superior.
    pause
    exit /b 1
  )
)
if not exist "node_modules\expo\bin\cli" (
  echo As dependencias do projeto nao foram encontradas nesta pasta.
  echo Abra a pasta completa do SafeNow, incluindo node_modules.
  pause
  exit /b 1
)
echo SafeNow no iPhone
echo.
echo Entre no navegador com a MESMA conta Expo usada no Expo Go do iPhone.
echo Conclua a autorizacao do Expo CLI e volte a esta janela.
echo A conta Expo e separada da conta do SafeNow.
echo.
"%SAFENOW_NODE%" node_modules\expo\bin\cli whoami >nul 2>nul
if not errorlevel 1 goto ready
"%SAFENOW_NODE%" scripts\iphone-login.mjs
if errorlevel 1 goto login_failed
"%SAFENOW_NODE%" node_modules\expo\bin\cli whoami
if errorlevel 1 goto login_failed

:ready
echo.
echo Deixe o computador e o iPhone na mesma rede Wi-Fi.
echo Escaneie o QR Code usando a camera do iPhone e abra no Expo Go.
echo Mantenha esta janela aberta enquanto usa o aplicativo.
echo Se o Windows solicitar, permita acesso do Node na sua rede privada.
echo.
"%SAFENOW_NODE%" node_modules\expo\bin\cli start --go --clear --port 8083
pause
exit /b

:login_failed
echo.
echo O login no Expo nao foi concluido. Nenhum servidor foi iniciado.
echo Confira a mensagem acima e tente abrir este arquivo novamente.
pause
exit /b 1
