#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Install GMS SVN SERVER Agent as a Windows Service.

.EXAMPLE
  .\install-service.ps1 -PublishDir "D:\GMS-SVN\apps\agent\src\GmsSvn.Agent\bin\Release\net8.0\publish"
#>
param(
  [Parameter(Mandatory = $true)]
  [string] $PublishDir,

  [string] $ServiceName = 'GmsSvnServerAgent',
  [string] $DisplayName = 'GMS SVN SERVER Agent'
)

$exe = Join-Path $PublishDir 'GmsSvn.Agent.exe'
if (-not (Test-Path $exe)) {
  throw "Agent executable not found: $exe. Run: dotnet publish -c Release"
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.Status -eq 'Running') { Stop-Service $ServiceName -Force }
  sc.exe delete $ServiceName | Out-Null
  Start-Sleep -Seconds 2
}

New-Service -Name $ServiceName -BinaryPathName $exe -DisplayName $DisplayName -StartupType Automatic | Out-Null
Start-Service $ServiceName
Write-Host "Installed and started $ServiceName"
