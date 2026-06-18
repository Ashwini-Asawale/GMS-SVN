#Requires -Version 5.1
<#
.SYNOPSIS
  Sign GMS SVN CLIENT Setup.exe so Windows UAC shows a Publisher name.

.DESCRIPTION
  Internal builds: creates/uses a self-signed code-signing cert (GMS SVN CLIENT).
  Deploy the exported root CA to client PCs (Trusted Root + Trusted Publishers) so
  UAC shows "GMS" instead of a blank publisher.

  Production: set CSC_LINK + CSC_KEY_PASSWORD and use electron-builder signing instead,
  or pass -CertificateThumbprint for an existing cert in CurrentUser\My.

.PARAMETER SetupPath
  Path to GMS-SVN-CLIENT-Setup-*.exe. Defaults to newest in apps/client/release.

.PARAMETER CertificateThumbprint
  Thumbprint of an existing code-signing cert. If omitted, uses or creates "GMS SVN CLIENT".
#>
param(
  [string]$SetupPath = '',
  [string]$CertificateThumbprint = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$releaseDir = Join-Path $repoRoot 'apps\client\release'

if (-not $SetupPath) {
  $setup = Get-ChildItem $releaseDir -Filter 'GMS-SVN-CLIENT-Setup-*.exe' |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $setup) { throw "No Setup.exe found in $releaseDir. Run pack:client first." }
  $SetupPath = $setup.FullName
} elseif (-not (Test-Path $SetupPath)) {
  throw "Setup not found: $SetupPath"
}

$signtool = @(
  "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x64\signtool.exe",
  "${env:ProgramFiles(x86)}\Windows Kits\10\bin\*\x86\signtool.exe"
) | ForEach-Object { Resolve-Path $_ -ErrorAction SilentlyContinue } |
  Sort-Object Path -Descending | Select-Object -First 1

if (-not $signtool) {
  throw 'signtool.exe not found. Install Windows SDK (Signing Tools for Desktop Apps).'
}

$certSubject = 'CN=GMS'
$cert = $null

if ($CertificateThumbprint) {
  $cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Thumbprint -eq $CertificateThumbprint } | Select-Object -First 1
  if (-not $cert) {
    $cert = Get-ChildItem Cert:\LocalMachine\My | Where-Object { $_.Thumbprint -eq $CertificateThumbprint } | Select-Object -First 1
  }
  if (-not $cert) { throw "Certificate thumbprint not found: $CertificateThumbprint" }
} else {
  $cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
    Where-Object { $_.Subject -eq $certSubject } |
    Sort-Object NotAfter -Descending |
    Select-Object -First 1

  if (-not $cert) {
    Write-Host "Creating self-signed code-signing certificate ($certSubject) in CurrentUser\My ..."
    $cert = New-SelfSignedCertificate `
      -Type CodeSigningCert `
      -Subject $certSubject `
      -CertStoreLocation Cert:\CurrentUser\My `
      -KeyExportPolicy Exportable `
      -KeyLength 2048 `
      -HashAlgorithm SHA256 `
      -NotAfter (Get-Date).AddYears(5)
    Write-Host "Created cert thumbprint: $($cert.Thumbprint)"
    Write-Host 'Export this cert to client PCs (Trusted Root + Trusted Publishers) for UAC to show GMS as publisher.'
  }
}

Write-Host "Signing: $SetupPath"
& $signtool.Path sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /a /sha1 $cert.Thumbprint $SetupPath
if ($LASTEXITCODE -ne 0) { throw 'signtool sign failed' }

Write-Host 'Verifying signature...'
& $signtool.Path verify /pa $SetupPath | Out-Null
$auth = Get-AuthenticodeSignature -FilePath $SetupPath
if ($auth.Status -eq 'HashMismatch') {
  throw 'Signature hash mismatch - file may be corrupt.'
}
if (-not $auth.SignerCertificate) {
  throw 'No signature found on Setup.exe.'
}
if ($LASTEXITCODE -ne 0) {
  Write-Host "Signature present ($($auth.SignerCertificate.Subject)). Chain not trusted until cert is deployed to client PCs (expected for internal signing)."
} else {
  Write-Host "Signature verified ($($auth.SignerCertificate.Subject))."
}

$exportDir = Join-Path $repoRoot 'apps\client\release\signing'
New-Item -ItemType Directory -Force -Path $exportDir | Out-Null
$cerPath = Join-Path $exportDir 'GMS-CodeSigning.cer'
Export-Certificate -Cert $cert -FilePath $cerPath -Force | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'Trust-GMS-CodeSigning.bat') (Join-Path $exportDir 'Trust-GMS-CodeSigning.bat') -Force
Write-Host "Exported cert for client trust: $cerPath"
Write-Host 'On client PCs (as admin): import GMS-CodeSigning.cer into Trusted Root and Trusted Publishers.'

Write-Host 'Setup.exe signed successfully.'
