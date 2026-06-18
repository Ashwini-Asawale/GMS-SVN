#Requires -Version 5.1
<#
.SYNOPSIS
  Read a variable from the repo root .env file.
#>
param(
  [Parameter(Mandatory = $true)]
  [string]$Name,
  [string]$Default = ''
)

$envFile = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) '.env'
if (-not (Test-Path $envFile)) { return $Default }

$escaped = [regex]::Escape($Name)
$line = Select-String -Path $envFile -Pattern "^$escaped=(.*)$" | Select-Object -First 1
if (-not $line) { return $Default }
return $line.Matches[0].Groups[1].Value.Trim()
