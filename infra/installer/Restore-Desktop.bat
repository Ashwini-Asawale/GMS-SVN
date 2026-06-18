@echo off
title Restore Desktop
echo Restoring desktop (explorer.exe)...
start explorer.exe
echo Done. Taskbar and icons should return in a few seconds.
timeout /t 5
