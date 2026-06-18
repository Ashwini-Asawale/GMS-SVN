#Requires -Version 5.1
# GMS SVN CLIENT - unified install (Setup.exe, Fast folder, or extracted app).
param(
  [string]$SourceDir = '',
  [string]$DestDir = "$env:ProgramFiles\GMS SVN CLIENT",
  [switch]$SkipCopy
)

$ErrorActionPreference = 'Stop'

function Test-IsAdmin {
  $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Release-InstallLocks {
  Write-Host '       Closing GMS SVN CLIENT if running...'
  cmd /c 'taskkill /F /IM "GMS SVN CLIENT.exe" >nul 2>&1'
  cmd /c 'taskkill /F /IM "GmsSvn.ShellBridge.exe" >nul 2>&1'
  Start-Sleep -Seconds 1

  Remove-OldExplorerMenus

  $regScript = Join-Path $DestDir 'register-shell.ps1'
  if ((Test-Path -LiteralPath $regScript) -and (Test-Path -LiteralPath $DestDir)) {
    Write-Host '       Unregistering previous Explorer menu...'
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $regScript -InstallDir $DestDir -Unregister | Out-Null
    Start-Sleep -Seconds 1
  }

  Write-Host '       Refreshing File Explorer...'
  cmd /c 'taskkill /F /IM explorer.exe >nul 2>&1'
  Start-Sleep -Seconds 2
  Start-Process explorer.exe | Out-Null
  Start-Sleep -Seconds 2
}

function Remove-OldExplorerMenus {
  foreach ($key in @(
    'HKLM\Software\Classes\Directory\ShellEx\ContextMenuHandlers\GMS SVN CLIENT',
    'HKLM\Software\Classes\Directory\Background\ShellEx\ContextMenuHandlers\GMS SVN CLIENT',
    'HKLM\Software\Classes\*\ShellEx\ContextMenuHandlers\GMS SVN CLIENT',
    'HKLM\Software\Classes\Directory\ShellEx\ContextMenuHandlers\GMS SVN',
    'HKLM\Software\Classes\Directory\Background\ShellEx\ContextMenuHandlers\GMS SVN',
    'HKLM\Software\Classes\*\ShellEx\ContextMenuHandlers\GMS SVN'
  )) {
    cmd /c "reg delete `"$key`" /f >nul 2>&1"
  }
}

function Test-ExplorerMenuRegistered {
  $out = cmd /c 'reg query "HKLM\Software\Classes\Directory\shell\GmsSvnMenu" /v MUIVerb 2>nul'
  return ($LASTEXITCODE -eq 0) -and ($out -match 'GMS SVN CLIENT')
}

function Invoke-RefreshExplorerShell {
  Write-Host '       Refreshing Explorer menu...'
  $refreshScript = Join-Path $DestDir 'refresh-explorer.ps1'
  if (Test-Path -LiteralPath $refreshScript) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $refreshScript | Out-Null
    return
  }
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class GmsShellNotify {
  [DllImport("shell32.dll")]
  public static extern void SHChangeNotify(int eventId, int flags, IntPtr item1, IntPtr item2);
  public static void Refresh() { SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero); }
}
"@
  [GmsShellNotify]::Refresh()
}

function Show-ErrorAndExit([string]$Message, [int]$Code = 1) {
  Write-Host ''
  Write-Host "ERROR: $Message" -ForegroundColor Red
  try {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($Message, 'GMS SVN CLIENT Setup', 'OK', 'Error') | Out-Null
  } catch { }
  Read-Host 'Press Enter to close'
  exit $Code
}

if (-not (Test-IsAdmin)) {
  $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $MyInvocation.MyCommand.Path)
  if ($SourceDir) { $argList += '-SourceDir', $SourceDir }
  if ($DestDir) { $argList += '-DestDir', $DestDir }
  if ($SkipCopy) { $argList += '-SkipCopy' }
  Start-Process powershell.exe -Verb RunAs -ArgumentList $argList -Wait
  exit $LASTEXITCODE
}

try {
  if ($SkipCopy) {
    $DestDir = $PSScriptRoot
  } else {
    if (-not $SourceDir) {
      $beside = Join-Path $PSScriptRoot 'app'
      $SourceDir = if (Test-Path (Join-Path $beside 'GMS SVN CLIENT.exe')) { $beside } else { $PSScriptRoot }
    }
    $SourceDir = (Resolve-Path -LiteralPath $SourceDir).Path.TrimEnd('\')
    $DestDir = $DestDir.TrimEnd('\')

    $required = @(
      (Join-Path $SourceDir 'GMS SVN CLIENT.exe'),
      (Join-Path $SourceDir 'explorer\GmsSvn.ShellExtension.dll'),
      (Join-Path $SourceDir 'register-shell.ps1')
    )
    foreach ($f in $required) {
      if (-not (Test-Path -LiteralPath $f)) { Show-ErrorAndExit "Missing file: $f" }
    }
  }

  $DestDir = (Resolve-Path -LiteralPath $DestDir).Path.TrimEnd('\')

  Write-Host ''
  Write-Host '========================================'
  Write-Host '  GMS SVN CLIENT - Install'
  Write-Host '========================================'
  Write-Host ''
  Write-Host "To: $DestDir"
  Write-Host ''

  Write-Host '[1/4] Preparing...'
  Release-InstallLocks

  if (-not $SkipCopy) {
    Write-Host '[2/4] Copying files...'
    if (-not (Test-Path $DestDir)) { New-Item -ItemType Directory -Force -Path $DestDir | Out-Null }
    & robocopy $SourceDir $DestDir /E /IS /IT /MT:8 /R:2 /W:1 /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    if ($LASTEXITCODE -ge 8) {
      Write-Host '       Copy blocked — refreshing Explorer and retrying once...' -ForegroundColor Yellow
      Release-InstallLocks
      & robocopy $SourceDir $DestDir /E /IS /IT /MT:8 /R:2 /W:1 /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    }
    if ($LASTEXITCODE -ge 8) {
      Show-ErrorAndExit @(
        'Could not copy files (folder is locked).',
        '',
        'Close GMS SVN CLIENT, close File Explorer windows on the install folder,',
        'then run setup again as Administrator.'
      ) -join "`n"
    }
  } else {
    Write-Host '[2/4] Files already in place.'
  }

  Write-Host '[3/4] Registering Explorer menu (GMS SVN CLIENT)...'
  Get-ChildItem $DestDir -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
    Unblock-File -LiteralPath $_.FullName -ErrorAction SilentlyContinue
  }

  Remove-OldExplorerMenus
  $regScript = Join-Path $DestDir 'register-shell.ps1'
  if (-not (Test-Path -LiteralPath $regScript)) {
    Show-ErrorAndExit "Missing register-shell.ps1 in $DestDir"
  }

  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $regScript -InstallDir $DestDir
  $regOk = ($LASTEXITCODE -eq 0) -and (Test-ExplorerMenuRegistered)

  if (-not $regOk) {
    Write-Host '       Retrying registration once...' -ForegroundColor Yellow
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $regScript -InstallDir $DestDir
    $regOk = ($LASTEXITCODE -eq 0) -and (Test-ExplorerMenuRegistered)
  }

  if ($regOk) { Invoke-RefreshExplorerShell }

  Write-Host '[4/4] Creating desktop shortcut...'
  $wsh = New-Object -ComObject WScript.Shell
  $sc = $wsh.CreateShortcut((Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'GMS SVN CLIENT.lnk'))
  $sc.TargetPath = Join-Path $DestDir 'GMS SVN CLIENT.exe'
  $sc.WorkingDirectory = $DestDir
  $sc.Save()

  Write-Host ''
  if ($regOk) {
    Write-Host 'SUCCESS - GMS SVN CLIENT installed with Explorer menu.' -ForegroundColor Green
    $msg = @(
      'GMS SVN CLIENT installed successfully.',
      '',
      'Right-click any folder in File Explorer:',
      '  Windows 11: click "Show more options" first',
      '  Then: GMS SVN CLIENT -> SVN Checkout / Commit ...',
      '',
      'Use SVN Checkout before Commit on a new folder.',
      '',
      'Explorer was refreshed automatically — you can use the app right away.'
    ) -join "`n"
    try {
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.MessageBox]::Show($msg, 'GMS SVN CLIENT', 'OK', 'Information') | Out-Null
    } catch { }
  } else {
    Write-Host 'App installed but Explorer menu failed.' -ForegroundColor Yellow
    Write-Host "Log: $(Join-Path $DestDir 'explorer-install.log')"
    Show-ErrorAndExit 'Explorer menu registration failed. Run setup again as Administrator.'
  }

  exit 0
}
catch {
  Show-ErrorAndExit $_.Exception.Message
}
