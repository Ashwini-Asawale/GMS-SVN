# GMS SVN — VisualSVN post-commit hook (Phase 9)
# Install via Web Admin → Repository → Pipeline → Install hook
# Or copy to: <VisualSVN Repos>\<RepoName>\hooks\post-commit.bat
#
# VisualSVN passes: %1 = REPOS path, %2 = REVISION
#
# Required env on GMS SVN SERVER:
#   GMS_SVN_API_URL       e.g. http://192.168.1.10:3001
#   PIPELINE_HOOK_SECRET  same as API .env PIPELINE_HOOK_SECRET

param(
  [Parameter(Mandatory = $true)][string]$Repos,
  [Parameter(Mandatory = $true)][int]$Revision
)

$ErrorActionPreference = 'SilentlyContinue'

$apiUrl = $env:GMS_SVN_API_URL
$secret = $env:PIPELINE_HOOK_SECRET
if (-not $apiUrl -or -not $secret) { exit 0 }

$repoName = Split-Path $Repos -Leaf
$bodyObj = @{
  repositoryName = $repoName
  revision       = $Revision
}
$body = $bodyObj | ConvertTo-Json -Compress

$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$hash = $hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($body))
$signature = -join ($hash | ForEach-Object { $_.ToString('x2') })

# Fire-and-forget — must not block SVN commit
Start-Job -ScriptBlock {
  param($Url, $Payload, $Sig)
  try {
    Invoke-RestMethod -Uri $Url -Method POST -ContentType 'application/json' `
      -Headers @{ 'X-GMS-SVN-Signature' = $Sig } -Body $Payload -TimeoutSec 10 | Out-Null
  } catch { }
} -ArgumentList "$apiUrl/hooks/post-commit", $body, $signature | Out-Null

exit 0
