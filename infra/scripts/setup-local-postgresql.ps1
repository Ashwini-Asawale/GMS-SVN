#Requires -Version 5.1
<#
.SYNOPSIS
  Switch GMS-SVN from Docker Postgres to local PostgreSQL (pgAdmin).

.USAGE
  cd D:\GMS-SVN
  .\infra\scripts\setup-local-postgresql.ps1 -PostgresSuperPassword "your-postgres-password"

  If you forgot the postgres password (local dev only):
  .\infra\scripts\setup-local-postgresql.ps1 -ResetPostgresPassword "postgres"
#>
param(
  [string]$PostgresSuperPassword = '',
  [string]$ResetPostgresPassword = '',
  [string]$DbUser = 'gms_svn',
  [string]$DbPassword = 'gms_svn_dev',
  [string]$DbName = 'gms_svn',
  [int]$Port = 0,
  [switch]$SkipDockerStop,
  [switch]$SkipMigrate,
  [switch]$SkipPortMove
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$pgData = 'C:\Program Files\PostgreSQL\16\data'
$pgConf = Join-Path $pgData 'postgresql.conf'
$pgHba = Join-Path $pgData 'pg_hba.conf'
$pgService = 'postgresql-x64-16'

function Find-Psql {
  $candidates = @(
    'C:\Program Files\PostgreSQL\16\bin\psql.exe',
    'C:\Program Files\PostgreSQL\17\bin\psql.exe',
    'C:\Program Files\PostgreSQL\15\bin\psql.exe',
    'psql'
  )
  foreach ($p in $candidates) {
    if ($p -eq 'psql') {
      $cmd = Get-Command psql -ErrorAction SilentlyContinue
      if ($cmd) { return $cmd.Source }
    } elseif (Test-Path $p) {
      return $p
    }
  }
  return $null
}

function Get-ConfiguredPgPort {
  if (-not (Test-Path $pgConf)) { return 5432 }
  $line = Select-String -Path $pgConf -Pattern '^\s*port\s*=\s*(\d+)' | Select-Object -First 1
  if ($line) { return [int]$line.Matches[0].Groups[1].Value }
  return 5432
}

function Test-PortListening {
  param([int]$TargetPort)
  return [bool](Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue)
}

function Invoke-Psql {
  param(
    [string]$User,
    [string]$Database,
    [int]$TargetPort,
    [string]$Password = '',
    [string[]]$ExtraArgs
  )
  if ($Password) { $env:PGPASSWORD = $Password }
  try {
    & $script:psql -h localhost -p $TargetPort -U $User -d $Database -v ON_ERROR_STOP=1 @ExtraArgs
    if ($LASTEXITCODE -ne 0) { throw "psql failed (user=$User db=$Database port=$TargetPort)" }
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  }
}

function Set-TextFileNoBom {
  param([string]$Path, [string]$Content)
  $utf8NoBom = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($Path, $Content.TrimEnd() + "`n", $utf8NoBom)
}

function Set-TrustLocalAuth {
  param([bool]$Enable)
  $hbaBackup = Join-Path $pgData 'pg_hba.conf.gms-svn.bak'
  if ($Enable) {
    if (-not (Test-Path $hbaBackup)) {
      Copy-Item $pgHba $hbaBackup -Force
    }
    $content = Get-Content $pgHba -Raw
    $content = $content -replace '(?m)^host\s+all\s+all\s+127\.0\.0\.1/32\s+.*$', 'host    all             all             127.0.0.1/32            trust'
    $content = $content -replace '(?m)^host\s+all\s+all\s+::1/128\s+.*$', 'host    all             all             ::1/128                 trust'
    Set-TextFileNoBom -Path $pgHba -Content $content
  } elseif (Test-Path $hbaBackup) {
    Copy-Item $hbaBackup $pgHba -Force
    Remove-Item $hbaBackup -Force
  }
  & 'C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe' reload -D $pgData | Out-Null
}

function Move-LocalPostgresToPort5432 {
  if (-not (Test-Path $pgConf)) {
    Write-Host '       Local PostgreSQL 16 data dir not found - skipping port move.'
    return (Get-ConfiguredPgPort)
  }

  $currentPort = Get-ConfiguredPgPort
  if ($currentPort -eq 5432) {
    Write-Host '       Local PostgreSQL already on port 5432.'
    return 5432
  }

  if (Test-PortListening -TargetPort 5432) {
    Write-Host "       Port 5432 is in use - keeping local PostgreSQL on port $currentPort." -ForegroundColor Yellow
    return $currentPort
  }

  Write-Host "       Moving local PostgreSQL from port $currentPort to 5432..."
  $content = Get-Content $pgConf -Raw
  $content = $content -replace '(?m)^(\s*port\s*=\s*)\d+', '${1}5432'
  Set-TextFileNoBom -Path $pgConf -Content $content
  Restart-Service $pgService
  Start-Sleep -Seconds 2
  if (-not (Test-PortListening -TargetPort 5432)) {
    throw 'PostgreSQL did not start on port 5432 after restart.'
  }
  Write-Host '       Local PostgreSQL now listens on port 5432.'
  return 5432
}

Write-Host '=== GMS-SVN local PostgreSQL setup ===' -ForegroundColor Cyan
Write-Host ''

if (-not $SkipDockerStop) {
  Write-Host '[1/6] Stopping Docker Postgres (free port 5432)...'
  docker stop gms-svn-postgres 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host '       Stopped gms-svn-postgres container.'
  } else {
    Write-Host '       Docker postgres not running or Docker unavailable - continuing.'
  }
} else {
  Write-Host '[1/6] Skipping Docker stop.'
}

$script:psql = Find-Psql
if (-not $script:psql) {
  Write-Host 'ERROR: psql not found. Install PostgreSQL 16 from https://www.postgresql.org/download/windows/' -ForegroundColor Red
  exit 1
}
Write-Host "[2/6] Using psql: $script:psql"

if (-not $SkipPortMove) {
  Write-Host '[3/6] Ensuring local PostgreSQL uses port 5432...'
  if ($Port -eq 0) {
    $Port = Move-LocalPostgresToPort5432
  }
} else {
  Write-Host '[3/6] Skipping port move.'
  if ($Port -eq 0) { $Port = Get-ConfiguredPgPort }
}

Write-Host "[4/6] Preparing postgres superuser (port $Port)..."

if ($ResetPostgresPassword) {
  Write-Host '       Temporarily enabling trust auth on localhost to reset postgres password...'
  Set-TrustLocalAuth -Enable $true
  try {
    Invoke-Psql -User postgres -Database postgres -TargetPort $Port -ExtraArgs @(
      '-c', "ALTER USER postgres WITH PASSWORD '$ResetPostgresPassword';"
    )
    $PostgresSuperPassword = $ResetPostgresPassword
    Write-Host "       postgres password reset. Use this in pgAdmin: $ResetPostgresPassword"
  } finally {
    Set-TrustLocalAuth -Enable $false
  }
} elseif (-not $PostgresSuperPassword) {
  Write-Host '       Testing postgres login...'
  $env:PGPASSWORD = ''
  $test = & $script:psql -h localhost -p $Port -U postgres -d postgres -c 'SELECT 1' 2>&1
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host 'ERROR: postgres password required. Re-run with one of:' -ForegroundColor Red
    Write-Host '  .\infra\scripts\setup-local-postgresql.ps1 -PostgresSuperPassword "YOUR_PASSWORD"' -ForegroundColor Yellow
    Write-Host '  .\infra\scripts\setup-local-postgresql.ps1 -ResetPostgresPassword "postgres"' -ForegroundColor Yellow
    exit 1
  }
}

Write-Host '[5/6] Creating database and user...'
$setupSql = @"
DO `$`$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DbUser') THEN
    CREATE ROLE $DbUser LOGIN PASSWORD '$DbPassword';
  END IF;
END `$`$;
SELECT 'CREATE DATABASE $DbName OWNER $DbUser'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DbName')\gexec
"@

$tempSql = Join-Path $env:TEMP "gms-svn-init-$(Get-Random).sql"
Set-Content -Path $tempSql -Value $setupSql -Encoding UTF8
try {
  Invoke-Psql -User postgres -Database postgres -TargetPort $Port -Password $PostgresSuperPassword -ExtraArgs @('-f', $tempSql)
  Invoke-Psql -User postgres -Database postgres -TargetPort $Port -Password $PostgresSuperPassword -ExtraArgs @(
    '-c', "GRANT ALL ON SCHEMA public TO $DbUser;"
  )
  Invoke-Psql -User postgres -Database $DbName -TargetPort $Port -Password $PostgresSuperPassword -ExtraArgs @(
    '-c', "GRANT ALL ON SCHEMA public TO $DbUser;"
  )
  Invoke-Psql -User postgres -Database postgres -TargetPort $Port -Password $PostgresSuperPassword -ExtraArgs @(
    '-c', "ALTER ROLE $DbUser CREATEDB;"
  )
} finally {
  Remove-Item $tempSql -Force -ErrorAction SilentlyContinue
}

$databaseUrl = "postgresql://${DbUser}:${DbPassword}@localhost:${Port}/${DbName}?schema=public"
Write-Host '[6/6] Updating .env and running migrate/seed...'
$envFile = Join-Path $repoRoot '.env'
if (-not (Test-Path $envFile)) {
  Copy-Item (Join-Path $repoRoot '.env.example') $envFile
}
$content = Get-Content $envFile -Raw
if ($content -match '(?m)^DATABASE_URL=.*$') {
  $content = $content -replace '(?m)^DATABASE_URL=.*$', "DATABASE_URL=$databaseUrl"
} else {
  $content = "DATABASE_URL=$databaseUrl`n$content"
}
Set-TextFileNoBom -Path $envFile -Content $content.TrimEnd()
Write-Host "       DATABASE_URL=$databaseUrl"

if (-not $SkipMigrate) {
  Push-Location $repoRoot
  try {
    npm run db:generate
    if ($LASTEXITCODE -ne 0) { throw 'db:generate failed' }
    npm run db:migrate
    if ($LASTEXITCODE -ne 0) { throw 'db:migrate failed' }
    npm run db:seed
    if ($LASTEXITCODE -ne 0) { throw 'db:seed failed' }
  } finally {
    Pop-Location
  }
}

Write-Host ''
Write-Host 'SUCCESS - local Windows PostgreSQL is ready.' -ForegroundColor Green
Write-Host ''
Write-Host 'pgAdmin (local Windows PostgreSQL):'
Write-Host "  Host: localhost   Port: $Port"
Write-Host '  Superuser: postgres  (password you set or reset above)'
Write-Host '  App database: gms_svn   App user: gms_svn   Password: gms_svn_dev'
Write-Host ''
Write-Host 'Web login: org default, admin@gms.local / admin123'
Write-Host 'Start app: npm run dev'
Write-Host ''
Write-Host 'Docker Postgres is stopped. Redis only: docker start gms-svn-redis' -ForegroundColor DarkGray
