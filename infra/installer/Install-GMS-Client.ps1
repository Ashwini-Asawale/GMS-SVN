#Requires -Version 5.1
# Wrapper for Fast-folder install (calls unified install-client.ps1).
param(
  [string]$SourceDir = '',
  [string]$DestDir = "$env:ProgramFiles\GMS SVN CLIENT"
)

$script = Join-Path $PSScriptRoot 'install-client.ps1'
if (-not (Test-Path $script)) {
  $script = Join-Path $PSScriptRoot 'Install-GMS-Client.ps1'
  if (-not (Test-Path $script)) { throw 'install-client.ps1 not found next to this script.' }
}

if ($script -like '*Install-GMS-Client.ps1') {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script @PSBoundParameters
} else {
  if (-not $SourceDir) {
    $beside = Join-Path $PSScriptRoot 'app'
    if (Test-Path (Join-Path $beside 'GMS SVN CLIENT.exe')) { $SourceDir = $beside }
  }
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $script -SourceDir $SourceDir -DestDir $DestDir
}
