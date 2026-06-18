#Requires -RunAsAdministrator
# Move local Windows PostgreSQL 16 to port 5432 (after Docker Postgres is stopped).
$ErrorActionPreference = 'Stop'
$pgData = 'C:\Program Files\PostgreSQL\16\data'
$pgConf = Join-Path $pgData 'postgresql.conf'
$utf8 = New-Object System.Text.UTF8Encoding $false

docker stop gms-svn-postgres 2>$null | Out-Null

$conf = [IO.File]::ReadAllText($pgConf)
if ($conf.StartsWith([char]0xFEFF)) { $conf = $conf.Substring(1) }
$conf = $conf -replace '(?m)^(\s*port\s*=\s*)\d+', '${1}5432'
[IO.File]::WriteAllText($pgConf, $conf.TrimEnd() + "`n", $utf8)

Restart-Service postgresql-x64-16
Start-Sleep -Seconds 2

$listening = Get-NetTCPConnection -LocalPort 5432 -State Listen -ErrorAction SilentlyContinue
if (-not $listening) {
  Write-Host 'ERROR: PostgreSQL is not listening on port 5432.' -ForegroundColor Red
  exit 1
}

Write-Host 'SUCCESS: PostgreSQL is now on port 5432.' -ForegroundColor Green
Write-Host 'pgAdmin: Host localhost, Port 5432, User postgres, Password root'

# Update .env if repo is alongside this script
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$envFile = Join-Path $repoRoot '.env'
if (Test-Path $envFile) {
  $content = Get-Content $envFile -Raw
  $content = $content -replace '(?m)^DATABASE_URL=.*$', 'DATABASE_URL=postgresql://gms_svn:gms_svn_dev@localhost:5432/gms_svn?schema=public'
  [IO.File]::WriteAllText($envFile, $content.TrimEnd() + "`n", $utf8)
  Write-Host 'Updated .env DATABASE_URL to port 5432.'
}
