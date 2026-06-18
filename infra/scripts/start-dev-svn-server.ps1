#Requires -Version 5.1
<#
.SYNOPSIS
  Start local SVN server for same-PC / LAN testing (svnserve on port 3690).
  Uses TortoiseSVN svnserve.exe — no VisualSVN required.
#>
param(
  [string]$RepoRoot = 'D:\GMS-SVN\.dev-svn-repos',
  [int]$Port = 3690,
  [string[]]$RepoNames = @('Repo', 'My-Repo', 'TestRepo', 'Vinnet-Repo')
)

$ErrorActionPreference = 'Stop'

function Find-SvnExe {
  foreach ($p in @(
    'C:\Program Files\TortoiseSVN\bin\svn.exe',
    'C:\Program Files\GMS SVN CLIENT\svn\svn.exe',
    'C:\Program Files\SlikSvn\bin\svn.exe'
  )) {
    if (Test-Path $p) { return $p }
  }
  throw 'svn.exe not found. Install TortoiseSVN first.'
}

function Find-SvnAdminExe {
  $svn = Find-SvnExe
  $dir = Split-Path $svn -Parent
  $exe = Join-Path $dir 'svnadmin.exe'
  if (-not (Test-Path $exe)) { throw "svnadmin.exe not found beside $svn" }
  return $exe
}

$svnExe = Find-SvnExe
$svnAdmin = Find-SvnAdminExe
$svnServe = Join-Path (Split-Path $svnExe -Parent) 'svnserve.exe'
if (-not (Test-Path $svnServe)) { throw "svnserve.exe not found" }

New-Item -ItemType Directory -Force -Path $RepoRoot | Out-Null

foreach ($name in $RepoNames) {
  $repoPath = Join-Path $RepoRoot $name
  if (-not (Test-Path $repoPath)) {
    Write-Host "Creating repository: $name"
    New-Item -ItemType Directory -Force -Path (Split-Path $repoPath -Parent) | Out-Null
    & $svnAdmin create $repoPath
    if ($LASTEXITCODE -ne 0) { throw "svnadmin create failed for $name" }
  }

  # Dev: require auth for writes; anonymous read. Passwords in shared auth/passwd.
  $confPath = Join-Path $repoPath 'conf\svnserve.conf'
  if (Test-Path $confPath) {
    $conf = Get-Content $confPath -Raw
    if ($conf -notmatch '(?m)^anon-access\s*=') {
      $conf = $conf -replace '(?m)^(\[general\])', "`$1`r`nanon-access = read`r`nauth-access = write`r`npassword-db = ../../auth/passwd`r`nrealm = GMS SVN"
      Set-Content -Path $confPath -Value $conf -Encoding ASCII
    } else {
      $conf = $conf -replace '(?m)^anon-access\s*=.*', 'anon-access = read'
      $conf = $conf -replace '(?m)^auth-access\s*=.*', 'auth-access = write'
      if ($conf -notmatch '(?m)^password-db\s*=') {
        $conf = $conf -replace '(?m)^(\[general\])', "`$1`r`npassword-db = ../../auth/passwd`r`nrealm = GMS SVN"
      } else {
        $conf = $conf -replace '(?m)^password-db\s*=.*', 'password-db = ../../auth/passwd'
      }
      if ($conf -notmatch '(?m)^realm\s*=') {
        $conf = $conf -replace '(?m)^(\[general\])', "`$1`r`nrealm = GMS SVN"
      }
      Set-Content -Path $confPath -Value $conf -Encoding ASCII
    }
  }

  # Seed passwd file (API also syncs on login / user create)
  $authDir = Join-Path $RepoRoot 'auth'
  New-Item -ItemType Directory -Force -Path $authDir | Out-Null
  $passwdPath = Join-Path $authDir 'passwd'
  if (-not (Test-Path $passwdPath)) {
    @(
      '### GMS SVN dev passwords (same as Web Admin seed users)',
      '[users]',
      'admin = admin123',
      'dev1 = dev123',
      'dev2 = dev123',
      ''
    ) | Set-Content -Path $passwdPath -Encoding ASCII
  }

  # Auto-notify API on every commit (updates revision in Web Admin).
  $hookSrc = Join-Path $PSScriptRoot '..\hooks\svnserve-post-commit.bat'
  if (Test-Path $hookSrc) {
    $hookDst = Join-Path $repoPath 'hooks\post-commit.bat'
    Copy-Item -LiteralPath $hookSrc -Destination $hookDst -Force
  }
}

# Stop existing svnserve on this port
Get-Process svnserve -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "Starting svnserve on port $Port (root: $RepoRoot) ..."
Start-Process -FilePath $svnServe -ArgumentList @('-d', '-r', $RepoRoot, "--listen-port=$Port", '--listen-host=0.0.0.0') -WindowStyle Hidden

Start-Sleep -Seconds 2
$listening = netstat -ano | Select-String ":$Port\s"
if (-not $listening) { throw "svnserve did not start on port $Port" }

Write-Host ''
Write-Host 'SVN server ready.' -ForegroundColor Green
Write-Host "  Base URL: svn://192.168.1.133:$Port"
Write-Host "  Example:  svn://192.168.1.133:$Port/Repo"
Write-Host ''
Write-Host 'Set Web Admin Settings -> VisualSVN URL to:'
Write-Host "  svn://192.168.1.133:$Port"
