@echo off
:: Run as Administrator — opens firewall for GMS SVN dev ports
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0open-dev-firewall.ps1"
pause
