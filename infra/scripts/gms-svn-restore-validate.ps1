<#
.SYNOPSIS
  Restore a repository backup to an isolated path for validation.

.DESCRIPTION
  Phase 2 restore validation — never overwrites live VisualSVN repos.
  After validation, remove the restore test path manually.

.PARAMETER BackupPath
  Path to a single repo hotcopy inside a dated backup folder

.PARAMETER RestoreRoot
  Isolated directory for restore test, e.g. D:\SVN\RestoreTest

.PARAMETER RepoName
  Repository folder name under RestoreRoot
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $BackupPath,

  [Parameter(Mandatory = $true)]
  [string] $RestoreRoot,

  [Parameter(Mandatory = $true)]
  [string] $RepoName
)

$ErrorActionPreference = 'Stop'
$dest = Join-Path $RestoreRoot $RepoName

if (-not (Test-Path $BackupPath)) {
  throw "Backup path not found: $BackupPath"
}

if (Test-Path $dest) {
  throw "Restore target already exists (remove first): $dest"
}

New-Item -ItemType Directory -Force -Path $RestoreRoot | Out-Null

Write-Host "Restoring $BackupPath -> $dest"
Copy-Item -Path $BackupPath -Destination $dest -Recurse

$svnlook = Join-Path ${env:ProgramFiles} 'VisualSVN Server\bin\svnlook.exe'
if (Test-Path $svnlook) {
  $latest = & $svnlook youngest $dest
  Write-Host "Restore validation: latest revision = $latest"
} else {
  Write-Warning "svnlook not found — verify revision manually with svn log"
}

Write-Host @"

Restore validation steps:
  1. svn log file:///$($dest -replace '\\','/') 
  2. Compare revision with backup manifest
  3. Remove $dest after sign-off

"@
