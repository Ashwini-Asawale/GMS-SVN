#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Unregister GMS SVN Explorer shell extension and remove install registry keys.
#>
param(
  [string]$InstallDir
)

$ErrorActionPreference = 'Stop'
$guid = '{f4e8b2a1-6c3d-4e5f-9a8b-1c2d3e4f5a6b}'

if (-not $InstallDir) {
  $regKey = 'HKLM:\Software\GMS SVN\CLIENT'
  if (Test-Path $regKey) {
    $InstallDir = (Get-ItemProperty -Path $regKey -ErrorAction SilentlyContinue).InstallPath
  }
}

foreach ($target in @(
  'HKLM:\Software\Classes\Directory\ShellEx\ContextMenuHandlers\GMS SVN',
  'HKLM:\Software\Classes\Directory\Background\ShellEx\ContextMenuHandlers\GMS SVN',
  'HKLM:\Software\Classes\*\ShellEx\ContextMenuHandlers\GMS SVN'
)) {
  if (Test-Path $target) {
    Remove-Item -Path $target -Recurse -Force
  }
}

if ($InstallDir -and (Test-Path $InstallDir)) {
  $comhost = Get-ChildItem -Path $InstallDir -Filter 'GmsSvn.ShellExtension.comhost.dll' -ErrorAction SilentlyContinue | Select-Object -First 1
  $extensionDll = Join-Path $InstallDir 'GmsSvn.ShellExtension.dll'
  $serverPath = if ($comhost) { $comhost.FullName } elseif (Test-Path $extensionDll) { $extensionDll } else { $null }

  if ($serverPath) {
    Write-Host "Unregistering COM server: $serverPath"
    & regsvr32.exe /s /u $serverPath
  }
}

if (Test-Path 'HKLM:\Software\GMS SVN\CLIENT') {
  Remove-Item -Path 'HKLM:\Software\GMS SVN\CLIENT' -Recurse -Force
}

Write-Host 'GMS SVN shell extension unregistered.'
