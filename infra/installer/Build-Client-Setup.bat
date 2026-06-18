@echo off
setlocal EnableExtensions
title Build GMS SVN CLIENT Setup
cd /d "%~dp0..\.."

set "SERVER_IP=192.168.1.133"
set /p SERVER_IP="Server IP or hostname [%SERVER_IP%]: "
if "%SERVER_IP%"=="" set "SERVER_IP=192.168.1.133"

set "API_URL=http://%SERVER_IP%:3001"
set "SVN_URL=https://%SERVER_IP%/svn"

echo.
echo ========================================
echo   Build client installer for remote PC
echo ========================================
echo   API URL: %API_URL%
echo   SVN URL: %SVN_URL%  (from server settings)
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-client-for-remote.ps1" -ServerHost "%SERVER_IP%" -ApiBaseUrl "%API_URL%" -VisualSvnUrl "%SVN_URL%"
set "RC=%ERRORLEVEL%"
echo.
if %RC% neq 0 (
  echo BUILD FAILED - exit code %RC%
  pause
  exit /b %RC%
)
echo.
echo Copy this ONE file to the client PC:
echo   apps\client\release\GMS-SVN-CLIENT-Setup-0.1.0.exe
echo.
pause
exit /b 0
