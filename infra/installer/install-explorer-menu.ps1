#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Install GMS SVN Explorer right-click menu on a PC that already has GMS SVN CLIENT.

.DESCRIPTION
  The NSIS client installer (GMS-SVN-CLIENT-Setup-*.exe) does NOT register the Explorer menu.
  Run this script after installing the client. Place it in the deployment folder next to the
  "shell" subfolder (from bundle-client-deployment.ps1), or pass -ShellSource.

.PARAMETER InstallDir
  Folder containing GMS SVN CLIENT.exe (default: auto-detect common install paths)

.PARAMETER ShellSource
  Folder containing GmsSvn.ShellBridge.exe and GmsSvn.ShellExtension.dll
  (default: .\shell next to this script)
#>
param(
  [string]$InstallDir = '',
  [string]$ShellSource = ''
)

$ErrorActionPreference = 'Stop'

function Find-ClientInstallDir {
  $reg = 'HKLM:\Software\GMS SVN\CLIENT'
  if (Test-Path $reg) {
    $p = (Get-ItemProperty -Path $reg -Name 'InstallPath' -ErrorAction SilentlyContinue).InstallPath
    if ($p -and (Test-Path (Join-Path $p 'GMS SVN CLIENT.exe'))) { return $p }
  }

  $candidates = @(
    "${env:ProgramFiles}\GMS SVN CLIENT",
    "${env:ProgramFiles(x86)}\GMS SVN CLIENT",
    "${env:LocalAppData}\Programs\GMS SVN CLIENT",
    "${env:LocalAppData}\Programs\gms-svn-client"
  )
  foreach ($c in $candidates) {
    if (Test-Path (Join-Path $c 'GMS SVN CLIENT.exe')) { return $c }
  }
  return $null
}

if (-not $ShellSource) {
  $ShellSource = Join-Path $PSScriptRoot 'shell'
}
$ShellSource = (Resolve-Path $ShellSource).Path

if (-not $InstallDir) {
  $InstallDir = Find-ClientInstallDir
}
if (-not $InstallDir) {
  throw @"
Could not find GMS SVN CLIENT.exe.
Install the client first, then re-run:

  .\install-explorer-menu.ps1 -InstallDir 'C:\Program Files\GMS SVN CLIENT'
"@
}
$InstallDir = (Resolve-Path $InstallDir).Path

$clientExe = Join-Path $InstallDir 'GMS SVN CLIENT.exe'
if (-not (Test-Path $clientExe)) {
  throw "GMS SVN CLIENT.exe not found in $InstallDir"
}

$bridgeSrc = Join-Path $ShellSource 'GmsSvn.ShellBridge.exe'
$extSrc = Join-Path $ShellSource 'GmsSvn.ShellExtension.dll'
if (-not (Test-Path $bridgeSrc)) { throw "Missing $bridgeSrc - use the full deployment bundle from bundle-client-deployment.ps1" }
if (-not (Test-Path $extSrc)) { throw "Missing $extSrc" }

Write-Host "Installing Explorer shell integration..."
Write-Host "  Client dir: $InstallDir"
Write-Host "  Shell from: $ShellSource"

$ShellDest = Join-Path $InstallDir 'explorer'
New-Item -ItemType Directory -Force -Path $ShellDest | Out-Null
Get-ChildItem -Path $ShellSource -Force | ForEach-Object {
  Copy-Item -Path $_.FullName -Destination $ShellDest -Recurse -Force
}

$registerScript = Join-Path $PSScriptRoot 'register-shell-extension.ps1'
if (Test-Path $registerScript) {
  & $registerScript -InstallDir $InstallDir
} else {
  throw 'Missing register-shell-extension.ps1'
}

Write-Host ''
Write-Host 'Restarting Explorer...'
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Process explorer

Write-Host ''
Write-Host 'Done. Important:'
Write-Host '  1. Sign in to GMS SVN CLIENT at least once (stores credentials for Explorer actions).'
Write-Host '  2. The menu appears ONLY inside SVN working copies (folders that contain a .svn folder).'
Write-Host '     Checkout a repo first, then right-click inside that folder.'
