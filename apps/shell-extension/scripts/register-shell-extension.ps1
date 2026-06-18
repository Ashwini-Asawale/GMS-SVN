#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Register GMS SVN Explorer shell extension and install paths.

.PARAMETER InstallDir
  Folder containing GMS SVN CLIENT.exe, GmsSvn.ShellBridge.exe, and GmsSvn.ShellExtension.dll
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir
)

$ErrorActionPreference = 'Stop'
$InstallDir = (Resolve-Path $InstallDir).Path

$clientExe = Join-Path $InstallDir 'GMS SVN CLIENT.exe'
$bridgeExe = Join-Path $InstallDir 'GmsSvn.ShellBridge.exe'
$extensionDll = Join-Path $InstallDir 'GmsSvn.ShellExtension.dll'

if (-not (Test-Path $clientExe)) { throw "Missing $clientExe" }
if (-not (Test-Path $bridgeExe)) { throw "Missing $bridgeExe" }
if (-not (Test-Path $extensionDll)) { throw "Missing $extensionDll" }

$regKey = 'HKLM:\Software\GMS SVN\CLIENT'
New-Item -Path $regKey -Force | Out-Null
Set-ItemProperty -Path $regKey -Name 'InstallPath' -Value $InstallDir

$comhost = Get-ChildItem -Path $InstallDir -Filter 'GmsSvn.ShellExtension.comhost.dll' -ErrorAction SilentlyContinue | Select-Object -First 1
$serverPath = if ($comhost) { $comhost.FullName } else { $extensionDll }

Write-Host "Registering COM server: $serverPath"
& regsvr32.exe /s $serverPath

$guid = '{f4e8b2a1-6c3d-4e5f-9a8b-1c2d3e4f5a6b}'
$handlerKey = "HKLM:\Software\Classes\CLSID\$guid"
$menuName = 'GMS SVN'

foreach ($target in @(
  'HKLM:\Software\Classes\Directory\ShellEx\ContextMenuHandlers\GMS SVN',
  'HKLM:\Software\Classes\Directory\Background\ShellEx\ContextMenuHandlers\GMS SVN',
  'HKLM:\Software\Classes\*\ShellEx\ContextMenuHandlers\GMS SVN'
)) {
  New-Item -Path $target -Force | Out-Null
  Set-ItemProperty -Path $target -Name '(default)' -Value $guid
}

Write-Host "GMS SVN shell extension registered."
Write-Host "  Client:    $clientExe"
Write-Host "  Bridge:    $bridgeExe"
Write-Host "  Extension: $serverPath"

Write-Host ""
Write-Host "Restart Explorer or sign out/in for menu changes to appear."
