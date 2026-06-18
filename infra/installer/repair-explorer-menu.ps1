# Repair Explorer menu on client PC (run as Administrator).
param(
  [string]$InstallDir = "$env:ProgramFiles\GMS SVN CLIENT"
)

$ErrorActionPreference = 'Stop'
$repoScript = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'apps\client\build\register-shell.ps1'
if (Test-Path -LiteralPath $repoScript) {
  Copy-Item -LiteralPath $repoScript -Destination (Join-Path $InstallDir 'register-shell.ps1') -Force
}

if (-not (Test-Path (Join-Path $InstallDir 'GMS SVN CLIENT.exe'))) {
  Write-Error "GMS SVN CLIENT not found at: $InstallDir"
}

Write-Host 'Closing GMS SVN CLIENT...'
cmd /c 'taskkill /F /IM "GMS SVN CLIENT.exe" >nul 2>&1'
Write-Host 'Unblocking files...'
Get-ChildItem $InstallDir -File -Recurse | ForEach-Object {
  Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue
}
Write-Host 'Restarting Explorer...'
cmd /c 'taskkill /F /IM explorer.exe >nul 2>&1'
Start-Sleep -Seconds 2
Start-Process explorer.exe | Out-Null
Start-Sleep -Seconds 1
Write-Host 'Registering shell extension...'
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $InstallDir 'register-shell.ps1')
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $InstallDir 'refresh-explorer.ps1')
Write-Host 'Done. Right-click a folder - on Windows 11 use Show more options.'
