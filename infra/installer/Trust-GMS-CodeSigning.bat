@echo off
setlocal
echo GMS SVN CLIENT - trust code signing certificate
echo ==============================================
echo.
echo Run this ONCE on each client PC as Administrator before installing Setup.exe.
echo This makes UAC show Publisher: GMS instead of blank / unknown.
echo.
pause

set "CERT=%~dp0GMS-CodeSigning.cer"
if not exist "%CERT%" (
  echo Certificate not found: %CERT%
  echo Copy the signing folder from the build machine release folder.
  pause
  exit /b 1
)

certutil -addstore Root "%CERT%"
if errorlevel 1 goto fail
certutil -addstore TrustedPublisher "%CERT%"
if errorlevel 1 goto fail

echo.
echo Certificate trusted. You can now run GMS-SVN-CLIENT-Setup-0.1.0.exe
echo UAC should show Publisher: GMS
pause
exit /b 0

:fail
echo Failed to import certificate. Run this batch file as Administrator.
pause
exit /b 1
