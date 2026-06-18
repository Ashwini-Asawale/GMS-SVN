@echo off
:: Apply TortoiseSVN-style GMS SVN CLIENT Explorer menu (Administrator required)
setlocal EnableExtensions
title GMS SVN CLIENT - Apply Explorer Menu
cd /d "%~dp0..\.."

net session >nul 2>&1
if errorlevel 1 (
  echo Requesting Administrator rights...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs -Wait"
  exit /b %ERRORLEVEL%
)

echo.
echo Applying GMS SVN CLIENT Explorer menu (TortoiseSVN-style submenu)...
echo.

set "INSTALL=C:\Program Files\GMS SVN CLIENT"
if not exist "%INSTALL%\GMS SVN CLIENT.exe" set "INSTALL=%~dp0..\..\apps\client\release\win-unpacked"

copy /Y "%~dp0..\..\apps\client\build\register-shell.ps1" "%INSTALL%\register-shell.ps1" >nul 2>&1

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0repair-explorer-menu.ps1" -InstallDir "%INSTALL%"
exit /b %ERRORLEVEL%
