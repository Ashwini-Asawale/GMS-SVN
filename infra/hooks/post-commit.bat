@echo off
REM VisualSVN post-commit wrapper — calls PowerShell hook asynchronously
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gms-svn-post-commit.ps1" -Repos "%1" -Revision %2
exit /b 0
