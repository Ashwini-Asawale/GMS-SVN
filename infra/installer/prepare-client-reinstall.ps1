# Release file locks before reinstall/upgrade.
param(
  [string]$InstallDir = "$env:ProgramFiles\GMS SVN CLIENT"
)

Write-Host 'Preparing for install (releasing locked files)...'

Write-Host 'Closing GMS SVN CLIENT if running...'
cmd /c 'taskkill /F /IM "GMS SVN CLIENT.exe" >nul 2>&1'

Write-Host 'Refreshing File Explorer to release locked files...'
cmd /c 'taskkill /F /IM explorer.exe >nul 2>&1'
Start-Sleep -Seconds 2
Start-Process explorer.exe | Out-Null
Start-Sleep -Seconds 2

Write-Host 'Ready to copy files.'
exit 0
