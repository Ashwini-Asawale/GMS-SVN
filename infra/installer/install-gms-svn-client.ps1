#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Build and install GMS SVN CLIENT + Explorer shell extension (dev or release folder).

.PARAMETER InstallDir
  Target install directory (default: C:\Program Files\GMS SVN CLIENT)
#>
param(
  [string]$InstallDir = 'C:\Program Files\GMS SVN CLIENT'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host 'Building shared package...'
Push-Location $repoRoot
npm run build --workspace=@gms-svn/shared | Out-Host

Write-Host 'Building Electron client...'
npm run build --workspace=@gms-svn/client | Out-Host
Pop-Location

Write-Host 'Building shell extension (.NET)...'
$shellDir = Join-Path $repoRoot 'apps\shell-extension'
dotnet build (Join-Path $shellDir 'GmsSvn.Shell.sln') -c Release | Out-Host

$clientOut = Join-Path $repoRoot 'apps\client\out'
$shellOut = Join-Path $shellDir 'src\GmsSvn.ShellExtension\bin\Release\net8.0-windows'
$bridgeOut = Join-Path $shellDir 'src\GmsSvn.ShellBridge\bin\Release\net8.0-windows'

if (-not (Test-Path $clientOut)) {
  throw "Client build output not found at $clientOut. Run electron-vite build and package first."
}

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Write-Host "Copying files to $InstallDir ..."
Copy-Item -Path (Join-Path $clientOut '*') -Destination $InstallDir -Recurse -Force
Copy-Item -Path (Join-Path $bridgeOut 'GmsSvn.ShellBridge.exe') -Destination $InstallDir -Force
Copy-Item -Path (Join-Path $shellOut 'GmsSvn.ShellExtension.dll') -Destination $InstallDir -Force
$comhost = Get-ChildItem -Path $shellOut -Filter 'GmsSvn.ShellExtension.comhost.dll' -ErrorAction SilentlyContinue
if ($comhost) {
  Copy-Item -Path $comhost.FullName -Destination $InstallDir -Force
}

& (Join-Path $shellDir 'scripts\register-shell-extension.ps1') -InstallDir $InstallDir

Write-Host ''
Write-Host "GMS SVN CLIENT installed to $InstallDir"
