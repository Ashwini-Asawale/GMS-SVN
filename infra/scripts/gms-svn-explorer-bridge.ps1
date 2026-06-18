param(
  [Parameter(Mandatory = $true)]
  [string]$Action,
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$ElectronExe = Join-Path $RepoRoot 'node_modules\electron\dist\electron.exe'
$MainJs = Join-Path $RepoRoot 'apps\client\out\main\index.js'

if (-not (Test-Path $ElectronExe)) {
  Write-Error "Electron not found. Run npm install in $RepoRoot"
  exit 1
}

if (-not (Test-Path $MainJs)) {
  Write-Error 'Client not built. Run: npm run build:client'
  exit 1
}

$env:CLIENT_SVN_MOCK = if ($env:CLIENT_SVN_MOCK) { $env:CLIENT_SVN_MOCK } else { 'false' }

$args = @(
  $MainJs,
  '--',
  '--action', $Action,
  '--path', $Path
)

if ($Action -eq 'diff' -or $Action -eq 'log') {
  $args += '--quiet'
}

Start-Process -FilePath $ElectronExe -ArgumentList $args -WorkingDirectory (Join-Path $RepoRoot 'apps\client')
