#Requires -Version 5.1
<#
.SYNOPSIS
  Quick same-PC smoke test: GMS API + client config + SVN prerequisites.
#>
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host '=== GMS SVN same-PC test ===' -ForegroundColor Cyan
Write-Host ''

# 1. API
Write-Host '[1] API health (http://localhost:3001)...'
try {
  $health = Invoke-RestMethod -Uri 'http://localhost:3001/health' -TimeoutSec 5
  Write-Host "    OK - phase $($health.phase), database $($health.checks.database)" -ForegroundColor Green
} catch {
  Write-Host '    FAIL - start server first:' -ForegroundColor Red
  Write-Host '      cd D:\GMS-SVN'
  Write-Host '      npm run docker:up'
  Write-Host '      npm run db:migrate'
  Write-Host '      npm run dev'
  exit 1
}

# 2. Login
Write-Host '[2] Admin login...'
try {
  $login = Invoke-RestMethod -Uri 'http://localhost:3001/auth/login' -Method POST `
    -Body '{"email":"admin@gms.local","password":"admin123"}' -ContentType 'application/json'
  Write-Host "    OK - logged in as $($login.user.username)" -ForegroundColor Green
  $token = $login.accessToken
} catch {
  Write-Host "    FAIL - $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

# 3. Repos
Write-Host '[3] Client-visible repositories...'
$repos = Invoke-RestMethod -Uri 'http://localhost:3001/client/repos' -Headers @{ Authorization = "Bearer $token" }
if ($repos.Count -eq 0) {
  Write-Host '    No repos yet - create one in Web Admin (http://localhost:5173)' -ForegroundColor Yellow
} else {
  foreach ($r in $repos) {
    Write-Host "    $($r.name) -> $($r.svnUrl)"
  }
}

# 4. SVN server (VisualSVN)
Write-Host '[4] VisualSVN (HTTPS port 443 on this PC)...'
$svn443 = Test-NetConnection -ComputerName localhost -Port 443 -WarningAction SilentlyContinue
if ($svn443.TcpTestSucceeded) {
  Write-Host '    OK - port 443 open (VisualSVN likely running)' -ForegroundColor Green
} else {
  Write-Host '    NOT RUNNING - install VisualSVN Server on this PC for checkout/commit' -ForegroundColor Yellow
  Write-Host '    Download: https://www.visualsvn.com/server/download/'
}

# 5. svn.exe
Write-Host '[5] svn.exe (TortoiseSVN)...'
$svnExe = 'C:\Program Files\TortoiseSVN\bin\svn.exe'
if (Test-Path $svnExe) {
  $ver = & $svnExe --version --quiet 2>$null | Select-Object -First 1
  Write-Host "    OK - $ver" -ForegroundColor Green
} else {
  Write-Host '    NOT FOUND - install TortoiseSVN for client checkout' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '=== Start client (dev) ===' -ForegroundColor Cyan
Write-Host '  Terminal 1: npm run dev          (API + Web Admin)'
Write-Host '  Terminal 2: npm run dev:client   (GMS SVN CLIENT)'
Write-Host ''
Write-Host '  Web Admin:  http://localhost:5173  (admin / admin123)'
Write-Host '  API:        http://localhost:3001'
Write-Host ''
