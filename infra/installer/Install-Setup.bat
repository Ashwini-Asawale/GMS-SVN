@echo off
title GMS SVN CLIENT Setup
cd /d "%~dp0"
setlocal

set "SETUP="
for %%F in ("%~dp0GMS-SVN-CLIENT-Setup-*.exe") do set "SETUP=%%~fF"
if not defined SETUP (
  echo Could not find GMS-SVN-CLIENT-Setup-*.exe in this folder.
  pause
  exit /b 1
)

echo.
echo  GMS SVN CLIENT Setup
echo  ====================
echo.
echo  If double-click on Setup.exe does nothing:
echo    1. Copy this folder to C:\GMS-Install on the client PC
echo    2. Run this file as Administrator
echo.

net session >nul 2>&1
if errorlevel 1 (
  echo Requesting Administrator rights...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

powershell -NoProfile -Command "Unblock-File -LiteralPath '%SETUP%' -ErrorAction SilentlyContinue"
echo Starting: %SETUP%
echo Please wait - install can take 1-2 minutes...
echo.
start "" /wait "%SETUP%"
set "RC=%ERRORLEVEL%"
echo.
if %RC% neq 0 (
  echo Setup did not complete successfully. Error code: %RC%
) else (
  echo Setup finished. Open GMS SVN CLIENT from the desktop.
)
echo.
pause
exit /b %RC%
