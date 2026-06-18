#Requires -Version 5.1

<#

.SYNOPSIS

  Build ONE fast installer for client PCs: desktop app + Explorer menu (self-contained).



  Uses 7-Zip SFX (store/uncompressed) + robocopy — much faster than NSIS on client PCs.



.PARAMETER ApiBaseUrl

  Server API URL baked into gms-svn-client.config.json (e.g. http://192.168.1.133:3001)



.OUTPUTS

  apps/client/release/GMS-SVN-CLIENT-Setup-0.1.0.exe

#>

param(

  [string]$ApiBaseUrl = '',

  [switch]$SkipClientBuild,

  [switch]$SkipShellBuild,

  [switch]$SignInstaller

)



$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

$clientDir = Join-Path $repoRoot 'apps\client'

$shellPublish = Join-Path $clientDir '.shell-publish'
$svnPublish = Join-Path $clientDir '.svn-publish'

$configFile = Join-Path $clientDir 'build\gms-svn-client.config.json'

$clientPkg = Get-Content (Join-Path $clientDir 'package.json') -Raw | ConvertFrom-Json

$version = $clientPkg.version



$clientEnvFile = Join-Path $clientDir '.env'

$clientEnvApi = ''

if (Test-Path $clientEnvFile) {

  Get-Content $clientEnvFile | ForEach-Object {

    if ($_ -match '^\s*VITE_API_BASE_URL\s*=\s*(.+)\s*$') {

      $clientEnvApi = $Matches[1].Trim().Trim('"').Trim("'")

    }

  }

}



$resolvedApi = ($ApiBaseUrl, $env:VITE_API_BASE_URL, $clientEnvApi, 'http://localhost:3001' | Where-Object { $_ } | Select-Object -First 1).Trim().TrimEnd('/')

@{ apiBaseUrl = $resolvedApi } | ConvertTo-Json | Set-Content -Path $configFile -Encoding UTF8

$env:VITE_API_BASE_URL = $resolvedApi

Write-Host "API URL for client: $resolvedApi"



Push-Location $repoRoot

try {

  if (-not $SkipShellBuild) {

    Write-Host '=== Publishing Explorer shell ==='

    & (Join-Path $PSScriptRoot 'publish-shell-extension.ps1') -OutputDir $shellPublish

  } elseif (-not (Test-Path (Join-Path $shellPublish 'GmsSvn.ShellExtension.dll'))) {

    throw 'Shell publish missing. Run without -SkipShellBuild first.'

  } else {

    Write-Host '=== Skipping shell build (using existing .shell-publish) ==='

  }



  Write-Host '=== Publishing SVN CLI (svn.exe) ==='
  try {
    & (Join-Path $PSScriptRoot 'publish-svn-cli.ps1') -OutputDir $svnPublish
  } catch {
    Write-Warning "SVN not bundled in this build: $($_.Exception.Message)"
    Write-Warning 'On build server run: winget install TortoiseSVN.TortoiseSVN then npm run pack:client again'
    Write-Warning 'On client PC run Install-TortoiseSVN.bat once, or install TortoiseSVN manually'
    if (-not (Test-Path $svnPublish)) {
      New-Item -ItemType Directory -Force -Path $svnPublish | Out-Null
    }
  }



  Write-Host '=== Building GMS SVN CLIENT (unpacked) ==='

  $certInfo = & (Join-Path $PSScriptRoot 'ensure-code-signing-cert.ps1')

  Write-Host "Code-signing cert ready: $($certInfo.Subject) ($($certInfo.Thumbprint))"



  Push-Location $clientDir

  if (-not $SkipClientBuild) {

    npm run build | Out-Host

    if ($LASTEXITCODE -ne 0) { throw 'electron-vite build failed' }

  } else {

    Write-Host 'Skipping client build (using existing out/)'

  }



  npx electron-builder --win --dir --config electron-builder.dir.json | Out-Host

  if ($LASTEXITCODE -ne 0) { throw 'electron-builder failed' }



  Pop-Location

  # Optional fast folder install (for dev/reinstall on build server)
  $fastDir = Join-Path $clientDir 'release\GMS-SVN-Client-Fast'
  $fastApp = Join-Path $fastDir 'app'
  $unpacked = Join-Path $clientDir 'release\win-unpacked'
  if (Test-Path $unpacked) {
    if (Test-Path $fastDir) { Remove-Item $fastDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $fastApp | Out-Null
    robocopy $unpacked $fastApp /E /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    Copy-Item (Join-Path $PSScriptRoot 'install-client.ps1') (Join-Path $fastDir 'install-client.ps1') -Force
    Copy-Item (Join-Path $PSScriptRoot 'Install-Client-Fast.bat') (Join-Path $fastDir 'Install-Client.bat') -Force
    Copy-Item (Join-Path $PSScriptRoot 'Restore-Desktop.bat') (Join-Path $fastDir 'Restore-Desktop.bat') -Force
    Copy-Item (Join-Path $PSScriptRoot 'Install-TortoiseSVN.bat') (Join-Path $fastDir 'Install-TortoiseSVN.bat') -Force
    @"
GMS SVN CLIENT - ONE FILE INSTALL
================================

PREFERRED: GMS-SVN-CLIENT-Setup-0.1.0.exe (in release folder on server)
  1. Copy Setup.exe to client PC
  2. Double-click Setup.exe -> Yes on UAC
  3. Wait for SUCCESS message
  4. Windows 11: right-click folder -> Show more options -> GMS SVN CLIENT

OR use this folder: run Install-Client.bat as Administrator

Server URL: see app\gms-svn-client.config.json
Log if menu fails: C:\Program Files\GMS SVN CLIENT\explorer-install.log
"@ | Set-Content -Path (Join-Path $fastDir 'README.txt') -Encoding UTF8
    Write-Host "CLIENT INSTALL (recommended): $fastDir"
  }

  Write-Host ''
  Write-Host '=== Building ONE-FILE Setup.exe ==='
  & (Join-Path $PSScriptRoot 'build-fast-sfx-installer.ps1') -Version $version -SignStub:$SignInstaller
  $setupExe = Join-Path $clientDir "release\GMS-SVN-CLIENT-Setup-$version.exe"
  if (Test-Path $setupExe) {
    $sizeMb = [math]::Round((Get-Item $setupExe).Length / 1MB, 1)
    Write-Host ''
    Write-Host '=== ONE-FILE INSTALLER (copy this to client PCs) ==='
    Write-Host "  $setupExe  ($sizeMb MB)"
    Write-Host '  Double-click Setup.exe on client PC -> Yes on UAC -> done'
  }

  Write-Host ''
  Write-Host '=== Optional: Fast folder (same install logic) ==='
  Write-Host "  $(Join-Path $clientDir 'release\GMS-SVN-Client-Fast')"
  Write-Host '  Run Install-Client.bat on client PC'
  Write-Host "Server URL: $resolvedApi"

} finally {

  Pop-Location

}

