#Requires -Version 5.1
<#
.SYNOPSIS
  Build Explorer shell extension (.NET Framework 4.8 - built into Windows) for client installer.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDir
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$shellDir = Join-Path $repoRoot 'apps\shell-extension'

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
  throw 'Install .NET 8 SDK on this build machine: winget install Microsoft.DotNet.SDK.8'
}

if (Test-Path $OutputDir) { Remove-Item $OutputDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Write-Host 'Building shell extension (net48 / SharpShell)...'
dotnet build (Join-Path $shellDir 'GmsSvn.Shell.sln') -c Release | Out-Host
if ($LASTEXITCODE -ne 0) { throw 'dotnet build failed for GmsSvn.Shell.sln' }

$bridgeOut = Join-Path $shellDir 'src\GmsSvn.ShellBridge\bin\Release\net48'
$extOut = Join-Path $shellDir 'src\GmsSvn.ShellExtension\bin\Release\net48'

foreach ($src in @($bridgeOut, $extOut)) {
  if (-not (Test-Path $src)) {
    throw "Build output not found: $src"
  }
  Get-ChildItem $src -File | Where-Object {
    $_.Extension -in '.exe', '.dll', '.config'
  } | ForEach-Object {
    Copy-Item $_.FullName -Destination $OutputDir -Force
  }
}

if (-not (Test-Path (Join-Path $OutputDir 'GmsSvn.ShellBridge.exe'))) {
  throw 'Missing GmsSvn.ShellBridge.exe'
}
if (-not (Test-Path (Join-Path $OutputDir 'GmsSvn.ShellExtension.dll'))) {
  throw 'Missing GmsSvn.ShellExtension.dll'
}

Write-Host "Shell extension ready in $OutputDir (uses Windows .NET Framework - no extra install on client)."
