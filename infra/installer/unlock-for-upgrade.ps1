# Unlock shell extension DLLs before upgrade copy (reg.exe only - fast, no hang).
param(
  [string]$InstallDir = "$env:ProgramFiles\GMS SVN CLIENT"
)

$dll = Join-Path $InstallDir 'explorer\GmsSvn.ShellExtension.dll'
if (-not (Test-Path $dll)) { return }

Write-Host 'Updating previous install (desktop may blink once)...'
foreach ($key in @(
  'HKLM\Software\Classes\Directory\ShellEx\ContextMenuHandlers\GMS SVN CLIENT',
  'HKLM\Software\Classes\Directory\Background\ShellEx\ContextMenuHandlers\GMS SVN CLIENT',
  'HKLM\Software\Classes\*\ShellEx\ContextMenuHandlers\GMS SVN CLIENT',
  'HKLM\Software\Classes\Directory\ShellEx\ContextMenuHandlers\GMS SVN',
  'HKLM\Software\Classes\Directory\Background\ShellEx\ContextMenuHandlers\GMS SVN',
  'HKLM\Software\Classes\*\ShellEx\ContextMenuHandlers\GMS SVN'
)) {
  cmd /c "reg delete `"$key`" /f" 2>$null | Out-Null
}

cmd /c 'taskkill /F /IM "GMS SVN CLIENT.exe" >nul 2>&1'
cmd /c 'taskkill /F /IM explorer.exe >nul 2>&1'
Start-Sleep -Seconds 2
