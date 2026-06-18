@echo off
REM GMS SVN — svnserve post-commit hook (dev). Args: REPOS REVISION
setlocal
set REPOS=%~1
set REV=%~2
if "%REPOS%"=="" exit 0
if "%REV%"=="" exit 0

if "%GMS_SVN_API_URL%"=="" set GMS_SVN_API_URL=http://192.168.1.133:3001
if "%PIPELINE_HOOK_SECRET%"=="" set PIPELINE_HOOK_SECRET=change-me-pipeline-hook-secret

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0gms-svn-post-commit.ps1" "%REPOS%" %REV%
exit /b 0
