#Requires -Version 5.1
<#
.SYNOPSIS
  Apply GMS platform settings for dev testing (API + svnserve on this PC).
#>
param(
  [string]$ServerHost = '',
  [string]$ApiBaseUrl = '',
  [string]$SvnBaseUrl = '',
  [string]$RepoRoot = ''
)

$ErrorActionPreference = 'Stop'
$getEnv = Join-Path $PSScriptRoot 'Get-EnvValue.ps1'

if (-not $ServerHost) { $ServerHost = & $getEnv -Name 'GMS_SVN_SERVER_HOST' -Default '192.168.1.133' }
if (-not $RepoRoot) { $RepoRoot = & $getEnv -Name 'VISUALSVN_REPO_ROOT' -Default 'D:\GMS-SVN\.dev-svn-repos' }
$svnPort = & $getEnv -Name 'SVN_PORT' -Default '3690'
if (-not $SvnBaseUrl) {
  $fromEnv = & $getEnv -Name 'VISUALSVN_URL' -Default ''
  $SvnBaseUrl = if ($fromEnv) { $fromEnv } else { "svn://${ServerHost}:$svnPort" }
}
if (-not $ApiBaseUrl) {
  $apiPort = & $getEnv -Name 'API_PORT' -Default '3001'
  $ApiBaseUrl = "http://${ServerHost}:$apiPort"
}

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
