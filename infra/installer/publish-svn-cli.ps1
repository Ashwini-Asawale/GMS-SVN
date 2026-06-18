#Requires -Version 5.1
<#
.SYNOPSIS
  Copy svn.exe and dependencies into apps/client/.svn-publish for client installer bundling.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$OutputDir,
  [switch]$InstallIfMissing
)

$ErrorActionPreference = 'Stop'

function Find-SvnBinDir {
  foreach ($bin in @(
    'C:\Program Files\TortoiseSVN\bin',
    'C:\Program Files\SlikSvn\bin',
    'C:\Program Files (x86)\Subversion\bin'
  )) {
    if (Test-Path (Join-Path $bin 'svn.exe')) { return $bin }
  }
  return $null
}

$binDir = Find-SvnBinDir
if (-not $binDir -and $InstallIfMissing) {
  Write-Host 'Installing TortoiseSVN (includes svn.exe) for client bundling...'
  winget install TortoiseSVN.TortoiseSVN --accept-package-agreements --accept-source-agreements --silent | Out-Host
  Start-Sleep -Seconds 5
  $binDir = Find-SvnBinDir
}

if (-not $binDir) {
  throw @(
    'svn.exe not found on this build PC.',
    'Install TortoiseSVN: winget install TortoiseSVN.TortoiseSVN',
    'Or run: publish-svn-cli.ps1 -InstallIfMissing'
  ) -join ' '
}

if (Test-Path $OutputDir) { Remove-Item $OutputDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Get-ChildItem $binDir -File | Where-Object { $_.Extension -in '.exe', '.dll' } | ForEach-Object {
  Copy-Item $_.FullName -Destination $OutputDir -Force
}

if (-not (Test-Path (Join-Path $OutputDir 'svn.exe'))) {
  throw "Copy failed - svn.exe missing in $OutputDir"
}

Write-Host "SVN CLI ready in $OutputDir (from $binDir)"
