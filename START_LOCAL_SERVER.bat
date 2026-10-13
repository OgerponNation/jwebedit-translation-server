@echo off
setlocal
cd /d "%~dp0"
echo.
echo JWebEdit Translation Server
echo ===========================
echo.
if "%DEEPL_API_KEY%"=="" (
  echo DEEPL_API_KEY is not set in this Command Prompt.
  echo.
  echo Open PowerShell and run:
  echo   $env:DEEPL_API_KEY="YOUR_REAL_KEY"
  echo   cd "%~dp0"
  echo   node server.js
  echo.
  pause
  exit /b 1
)
node server.js
