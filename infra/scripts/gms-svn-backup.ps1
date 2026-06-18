<#
.SYNOPSIS
  Backup VisualSVN repositories to NAS with retention policy.

.DESCRIPTION
  Phase 2 template for GMS SVN SERVER. Uses svnadmin hotcopy for each repo
  under RepoRoot and stores dated folders under BackupRoot.

.PARAMETER RepoRoot
  VisualSVN repository root (local or iSCSI mount), e.g. D:\SVN\Repositories

.PARAMETER BackupRoot
  NAS backup UNC path, e.g. \\GMS-NAS\SVN\Backups

.PARAMETER RetentionDays
  Delete backup folders older than this many days (default 30)
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string] $RepoRoot,

  [Parameter(Mandatory = $true)]
  [string] $BackupRoot,

  [int] $RetentionDays = 30
)

$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyy-MM-dd'
$destRoot = Join-Path $BackupRoot $stamp

if (-not (Test-Path $RepoRoot)) {
  throw "Repository root not found: $RepoRoot"
}

New-Item -ItemType Directory -Force -Path $destRoot | Out-Null

$svnadmin = Join-Path ${env:ProgramFiles} 'VisualSVN Server\bin\svnadmin.exe'
if (-not (Test-Path $svnadmin)) {
  $svnadmin = 'svnadmin'
}

$repos = Get-ChildItem -Path $RepoRoot -Directory | Where-Object {
  Test-Path (Join-Path $_.FullName 'db')
}

if ($repos.Count -eq 0) {
  Write-Warning "No FSFS repositories found under $RepoRoot"
}

foreach ($repo in $repos) {
  $target = Join-Path $destRoot $repo.Name
  Write-Host "Backing up $($repo.Name) -> $target"
  & $svnadmin hotcopy $repo.FullName $target --clean-log
}

# Retention: remove dated folders older than RetentionDays
$cutoff = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $BackupRoot -Directory | Where-Object {
  $_.Name -match '^\d{4}-\d{2}-\d{2}$' -and $_.LastWriteTime -lt $cutoff
} | ForEach-Object {
  Write-Host "Removing expired backup: $($_.FullName)"
  Remove-Item -LiteralPath $_.FullName -Recurse -Force
}

Write-Host "Backup complete: $destRoot"
