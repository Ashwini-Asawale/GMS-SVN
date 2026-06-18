#Requires -Version 5.1
<#
.SYNOPSIS
  Apply GMS platform settings for dev testing (API + svnserve on this PC).
#>
param(
  [string]$ServerHost = '192.168.1.133',
  [string]$ApiBaseUrl = 'http://192.168.1.133:3001',
  [string]$SvnBaseUrl = 'svn://192.168.1.133:3690',
  [string]$RepoRoot = 'D:\GMS-SVN\.dev-svn-repos'
)

$ErrorActionPreference = 'Stop'
$repoRoot = $RepoRoot

Push-Location (Join-Path $PSScriptRoot '..\..\apps\api')
try {
  npx dotenv -e ../../.env -- tsx scripts/apply-dev-settings.ts $ServerHost $SvnBaseUrl $RepoRoot
  if ($LASTEXITCODE -ne 0) { throw 'Failed to update platform settings' }
} finally {
  Pop-Location
}

Write-Host "API URL:  $ApiBaseUrl"
Write-Host "SVN URL:  $SvnBaseUrl"
Write-Host "Repo root: $RepoRoot"
