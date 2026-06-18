#Requires -Version 5.1
<#
.SYNOPSIS
  Copy the single client installer to a deployment folder for other PCs.
#>
param(
  [switch]$SkipPack
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$deployDir = Join-Path $repoRoot 'apps\client\release\GMS-SVN-Client-Deploy'

Push-Location $repoRoot
try {
  if (-not $SkipPack) {
    Write-Host '=== Building client installer (app + Explorer menu) ==='
    npm run pack:client | Out-Host
  }

  if (Test-Path $deployDir) { Remove-Item $deployDir -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $deployDir | Out-Null

  $setup = Get-ChildItem (Join-Path $repoRoot 'apps\client\release') -Filter 'GMS-SVN-CLIENT-Setup-*.exe' |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $setup) { throw 'No GMS-SVN-CLIENT-Setup-*.exe found — run npm run pack:client first' }

  Copy-Item $setup.FullName -Destination $deployDir -Force

  @"
GMS SVN CLIENT — install on another PC
======================================

1. Copy GMS-SVN-CLIENT-Setup-*.exe to the target PC.
2. Double-click the installer and approve UAC (Administrator).
3. Open GMS SVN CLIENT from the desktop shortcut and sign in.
4. Install SlikSVN or TortoiseSVN (svn.exe on PATH) if not already installed.
5. Checkout a repo, then right-click inside that folder in File Explorer.

The Explorer SVN menu is registered automatically during install.
Close and reopen File Explorer if the menu is not visible immediately.

Server URL is embedded at build time (see apps/client/.env on the build machine).
"@ | Set-Content -Path (Join-Path $deployDir 'README.txt') -Encoding UTF8

  Write-Host ''
  Write-Host "Deployment folder ready: $deployDir"
  Write-Host "Copy the Setup exe to each client PC — no extra scripts required."
} finally {
  Pop-Location
}
