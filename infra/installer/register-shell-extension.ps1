#Requires -RunAsAdministrator
param(
  [Parameter(Mandatory = $true)]
  [string]$InstallDir
)

$ErrorActionPreference = 'Stop'
$InstallDir = (Resolve-Path $InstallDir).Path
$ShellDir = Join-Path $InstallDir 'explorer'

$clientExe = Join-Path $InstallDir 'GMS SVN CLIENT.exe'
$bridgeExe = Join-Path $ShellDir 'GmsSvn.ShellBridge.exe'
$extensionDll = Join-Path $ShellDir 'GmsSvn.ShellExtension.dll'

if (-not (Test-Path $clientExe)) { throw "Missing $clientExe" }
if (-not (Test-Path $bridgeExe)) { throw "Missing $bridgeExe" }
if (-not (Test-Path $extensionDll)) { throw "Missing $extensionDll" }

$regKey = 'HKLM:\Software\GMS SVN\CLIENT'
New-Item -Path $regKey -Force | Out-Null
Set-ItemProperty -Path $regKey -Name 'InstallPath' -Value $InstallDir

$regasm = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe'
if (-not (Test-Path $regasm)) { throw "RegAsm not found - .NET Framework 4.8 required (built into Windows)" }

Write-Host "Registering COM: $extensionDll"
$proc = Start-Process -FilePath $regasm -ArgumentList @('/codebase', $extensionDll) -Wait -PassThru -NoNewWindow
if ($proc.ExitCode -ne 0) { throw "RegAsm failed with exit code $($proc.ExitCode)" }

  $handlerName = 'GMS SVN CLIENT'
  foreach ($target in @(
    "HKLM:\Software\Classes\Directory\ShellEx\ContextMenuHandlers\$handlerName",
    "HKLM:\Software\Classes\Directory\Background\ShellEx\ContextMenuHandlers\$handlerName",
    "HKLM:\Software\Classes\*\ShellEx\ContextMenuHandlers\$handlerName"
  )) {
    New-Item -Path $target -Force | Out-Null
    Set-ItemProperty -Path $target -Name '(default)' -Value $guid
  }

  $approved = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Approved'
  if (-not (Test-Path $approved)) { New-Item -Path $approved -Force | Out-Null }
  Set-ItemProperty -Path $approved -Name $guid -Value $handlerName

Write-Host "GMS SVN shell extension registered."
