#Requires -Version 5.1
<#
.SYNOPSIS
  Ensure GMS code-signing cert exists and export .cer for embedding in the installer.
.OUTPUTS
  PSCustomObject with Thumbprint and CerPath
#>
param(
  [string]$ExportDir = ''
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
if (-not $ExportDir) {
  $ExportDir = Join-Path $repoRoot 'apps\client\build\signing'
}

$certSubject = 'CN=GMS'
$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
  Where-Object { $_.Subject -eq $certSubject } |
  Sort-Object NotAfter -Descending |
  Select-Object -First 1

if (-not $cert) {
  Write-Host "Creating code-signing certificate ($certSubject)..."
  $cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject $certSubject `
    -CertStoreLocation Cert:\CurrentUser\My `
    -KeyExportPolicy Exportable `
    -KeyLength 2048 `
    -HashAlgorithm SHA256 `
    -NotAfter (Get-Date).AddYears(5)
}

New-Item -ItemType Directory -Force -Path $ExportDir | Out-Null
$cerPath = Join-Path $ExportDir 'GMS-CodeSigning.cer'
Export-Certificate -Cert $cert -FilePath $cerPath -Force | Out-Null

[PSCustomObject]@{
  Thumbprint = $cert.Thumbprint
  CerPath    = $cerPath
  Subject    = $cert.Subject
}
