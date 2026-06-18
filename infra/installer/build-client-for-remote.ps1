#Requires -Version 5.1
param(
  [Parameter(Mandatory = $true)]
  [string]$ServerHost,
  [Parameter(Mandatory = $true)]
  [string]$ApiBaseUrl,
  [string]$VisualSvnUrl = '',
  [switch]$SkipClientBuild,
  [switch]$SkipShellBuild,
  [switch]$SignInstaller
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$clientDir = Join-Path $repoRoot 'apps\client'
$releaseDir = Join-Path $clientDir 'release'

if (-not $VisualSvnUrl) {
  $VisualSvnUrl = "https://$ServerHost/svn"
}

$ApiBaseUrl = $ApiBaseUrl.Trim().TrimEnd('/')
$VisualSvnUrl = $VisualSvnUrl.Trim().TrimEnd('/')

Write-Host "Updating server platform settings (VisualSVN URL for checkout)..."
Push-Location (Join-Path $repoRoot 'apps\api')
try {
  npx dotenv -e ../../.env -- tsx scripts/apply-dev-settings.ts $ServerHost $VisualSvnUrl
  if ($LASTEXITCODE -ne 0) { throw 'Failed to update platform settings in database' }
} finally {
  Pop-Location
}

Write-Host "Building installer (API -> $ApiBaseUrl)..."
& (Join-Path $PSScriptRoot 'build-single-client-installer.ps1') `
  -ApiBaseUrl $ApiBaseUrl `
  -SkipClientBuild:$SkipClientBuild `
  -SkipShellBuild:$SkipShellBuild `
  -SignInstaller:$SignInstaller

$version = (Get-Content (Join-Path $clientDir 'package.json') -Raw | ConvertFrom-Json).version
$setupExe = Join-Path $releaseDir "GMS-SVN-CLIENT-Setup-$version.exe"

$readme = @"
GMS SVN CLIENT - Install on another PC
======================================

ONE FILE: GMS-SVN-CLIENT-Setup-$version.exe

SERVER (this build)
  Web Admin API: $ApiBaseUrl
  SVN checkout:  $VisualSvnUrl/<repo-name>
  Example:       $VisualSvnUrl/My-Repo

INSTALL ON CLIENT PC
  1. Copy GMS-SVN-CLIENT-Setup-$version.exe to the client PC
  2. Double-click -> Yes on UAC -> wait for SUCCESS
  3. Windows 11: right-click folder -> Show more options -> GMS SVN CLIENT

FIRST USE
  1. Open GMS SVN CLIENT from Desktop
  2. Sign in (user created in Web Admin on server)
  3. SVN Checkout: pick repo, local folder e.g. C:\Projects\my-repo
  4. Add or edit files in that folder
  5. SVN Commit (Explorer menu or app) - enter message

NOTE: SVN checkout uses the URL shown in the app (from server settings).
For dev testing this build uses: $VisualSvnUrl/<repo-name>

Web Admin: $($ApiBaseUrl -replace ':3001$', ':5173')
If checkout fails: ensure SVN server is running and firewall allows the SVN port.
"@

$readmePath = Join-Path $releaseDir 'CLIENT-INSTALL-README.txt'
Set-Content -Path $readmePath -Value $readme -Encoding UTF8

Write-Host ''
Write-Host '=== READY FOR CLIENT PC ===' -ForegroundColor Green
Write-Host "  Installer: $setupExe"
Write-Host "  Readme:    $readmePath"
if (Test-Path $setupExe) {
  $sizeMb = [math]::Round((Get-Item $setupExe).Length / 1MB, 1)
  Write-Host "  Size:      $sizeMb MB"
}
