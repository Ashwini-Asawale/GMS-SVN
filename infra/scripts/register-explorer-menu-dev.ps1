#Requires -Version 5.1
<#
.SYNOPSIS
  Register GMS SVN Explorer menu for D:\GMS-SVN monorepo (HKCU — no admin required).

  Uses registry cascade menu + PowerShell bridge (no .NET COM build needed for dev).

.PARAMETER Unregister
  Remove registry entries created by this script.
#>
param(
  [switch]$Unregister
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ClientDir = Join-Path $RepoRoot 'apps\client'
$BridgeScript = Join-Path $RepoRoot 'infra\scripts\gms-svn-explorer-bridge.ps1'
$ElectronExe = Join-Path $RepoRoot 'node_modules\electron\dist\electron.exe'
$MainJs = Join-Path $ClientDir 'out\main\index.js'

function Test-ClientReady {
  if (-not (Test-Path $ElectronExe)) {
    Write-Host "Missing Electron: $ElectronExe"
    Write-Host "Run: cd $RepoRoot && npm install"
    return $false
  }
  if (-not (Test-Path $MainJs)) {
    Write-Host "Missing client build: $MainJs"
    Write-Host "Run: cd $RepoRoot && npm run build:client"
    return $false
  }
  return $true
}

$targets = @(
  'Registry::HKEY_CURRENT_USER\Software\Classes\Directory\shell\GmsSvnMenu',
  'Registry::HKEY_CURRENT_USER\Software\Classes\Directory\Background\shell\GmsSvnMenu',
  'Registry::HKEY_CURRENT_USER\Software\Classes\*\shell\GmsSvnMenu'
)

if ($Unregister) {
  foreach ($target in $targets) {
    if (Test-Path $target) {
      Remove-Item -Path $target -Recurse -Force
    }
  }
  Write-Host 'GMS SVN Explorer menu removed (HKCU). Restart Explorer or sign out/in.'
  exit 0
}

if (-not (Test-ClientReady)) { exit 1 }

$bridgeCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$BridgeScript`""

$menuItems = @(
  @{ Key = '00checkout'; Label = 'SVN Checkout';              Action = 'checkout' },
  @{ Key = '01add';      Label = 'SVN Add';                  Action = 'add' },
  @{ Key = '02commit';   Label = 'SVN Commit';               Action = 'commit' },
  @{ Key = '03update';   Label = 'SVN Update';                Action = 'update' },
  @{ Key = '04status';   Label = 'Check for Modifications';  Action = 'status' },
  @{ Key = '05diff';     Label = 'SVN Diff';                 Action = 'diff' },
  @{ Key = '06revert';   Label = 'SVN Revert';               Action = 'revert' },
  @{ Key = '07log';      Label = 'SVN Log';                  Action = 'log' },
  @{ Key = '08lock';     Label = 'SVN Lock';                 Action = 'lock' },
  @{ Key = '09unlock';   Label = 'SVN Unlock';               Action = 'unlock' },
  @{ Key = '10open';     Label = 'Open in GMS SVN CLIENT';   Action = 'open' }
)

foreach ($target in $targets) {
  New-Item -Path $target -Force | Out-Null
  Set-ItemProperty -Path $target -Name 'MUIVerb' -Value 'GMS SVN CLIENT'
  Set-ItemProperty -Path $target -Name 'Icon' -Value "$ElectronExe,0"
  Set-ItemProperty -Path $target -Name 'SubCommands' -Value ''

  $pathArg = if ($target -match 'Background') { '%V' } else { '%1' }

  foreach ($item in $menuItems) {
    $itemKey = Join-Path $target "shell\$($item.Key)"
    New-Item -Path $itemKey -Force | Out-Null
    Set-ItemProperty -Path $itemKey -Name '(default)' -Value $item.Label

    $cmdKey = Join-Path $itemKey 'command'
    New-Item -Path $cmdKey -Force | Out-Null
    $command = "$bridgeCmd -Action $($item.Action) -Path `"$pathArg`""
    Set-ItemProperty -Path $cmdKey -Name '(default)' -Value $command
  }
}

Write-Host 'GMS SVN CLIENT Explorer menu registered (current user).'
Write-Host ''
Write-Host 'Next steps:'
Write-Host '  1. Restart Explorer:  taskkill /f /im explorer.exe & start explorer'
Write-Host '  2. Start API:         npm run dev:api'
Write-Host '  3. Sign in once:      npm run dev:client'
Write-Host '  4. Right-click any folder — use SVN Checkout on empty folders, Update/Commit on working copies'
Write-Host ''
Write-Host "Note: On Windows 11 use right-click -> Show more options to see classic menu items."
