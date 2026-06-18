@echo off
setlocal EnableExtensions
title GMS SVN - Start Dev Stack
cd /d "%~dp0..\.."

echo.
echo ========================================
echo   GMS SVN - Same PC dev stack
echo ========================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-dev-svn-server.ps1"
if errorlevel 1 goto :fail

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0apply-dev-settings.ps1"
if errorlevel 1 goto :fail

echo.
echo Starting API + Web Admin (new window)...
start "GMS API+Web" powershell -NoExit -Command "cd '%CD%'; npm run dev"

echo.
echo Done.
echo   Web Admin: http://192.168.1.133:5173  (admin / admin123)
echo   API:       http://192.168.1.133:3001
echo   SVN:       svn://192.168.1.133:3690/Repo
echo.
echo Restart GMS SVN CLIENT and checkout again.
pause
exit /b 0

:fail
echo.
echo FAILED - see messages above.
pause
exit /b 1
