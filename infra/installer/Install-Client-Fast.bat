@echo off
setlocal EnableExtensions EnableDelayedExpansion
title GMS SVN CLIENT Install
cd /d "%~dp0"

echo.
echo ========================================
echo   GMS SVN CLIENT - Install
echo ========================================
echo.

:: Must have full folder from server (not just app\)
if not exist "%~dp0install-client.ps1" (
  echo ERROR: Missing install-client.ps1
  echo.
  echo You copied an INCOMPLETE folder. Copy the ENTIRE folder from server:
  echo   GMS-SVN-Client-Fast\
  echo     Install-Client.bat       ^<-- this file
  echo     install-client.ps1   ^<-- MISSING on your PC
  echo     README.txt
  echo     app\GMS SVN CLIENT.exe
  echo     app\explorer\...
  echo.
  goto :finish_bad
)
if not exist "%~dp0app\GMS SVN CLIENT.exe" (
  echo ERROR: Missing app\GMS SVN CLIENT.exe
  echo Copy the full GMS-SVN-Client-Fast folder from the server.
  echo.
  goto :finish_bad
)

:: Request Administrator (UAC) if needed
net session >nul 2>&1
if !errorlevel! neq 0 (
  echo Administrator rights required.
  echo Click YES on the UAC prompt to continue...
  echo.
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs -Wait"
  set "ERR=!ERRORLEVEL!"
  if "!ERR!"=="0" goto :finish_ok
  if "!ERR!"=="1223" (
    echo UAC was cancelled. Right-click Install-Client.bat - Run as administrator.
    goto :finish_bad
  )
  goto :finish_err
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0prepare-client-reinstall.ps1"
if errorlevel 1 goto :fail

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-client.ps1"
set "ERR=!ERRORLEVEL!"
if "!ERR!"=="0" goto :finish_ok
goto :finish_err

:finish_ok
echo.
echo Install finished successfully.
echo.
pause
exit /b 0

:finish_err
echo.
echo Install finished with errors. Code: !ERR!
if "!ERR!"=="2" (
  echo.
  echo Code 2 = a required file was not found.
  echo Make sure the FULL GMS-SVN-Client-Fast folder is copied to this PC.
)
echo.
pause
exit /b !ERR!

:finish_bad
pause
exit /b 2
