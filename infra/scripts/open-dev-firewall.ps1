#Requires -RunAsAdministrator
# Opens Windows Firewall for GMS SVN dev stack (API, Web Admin, svnserve).
param(
  [string]$ServerHost = '192.168.1.133'
)

$ErrorActionPreference = 'Stop'

$rules = @(
  @{ Name = 'GMS SVN API'; Port = 3001; Protocol = 'TCP' },
  @{ Name = 'GMS SVN Web Admin'; Port = 5173; Protocol = 'TCP' },
  @{ Name = 'GMS SVN Client Dev'; Port = 5175; Protocol = 'TCP' },
  @{ Name = 'GMS SVN svnserve'; Port = 3690; Protocol = 'TCP' }
)

foreach ($r in $rules) {
  $existing = Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Rule exists: $($r.Name) (port $($r.Port))"
    continue
  }
  New-NetFirewallRule `
    -DisplayName $r.Name `
    -Direction Inbound `
    -Action Allow `
    -Protocol $r.Protocol `
    -LocalPort $r.Port `
    -Profile Domain,Private | Out-Null
  Write-Host "Added firewall rule: $($r.Name) port $($r.Port)"
}

Write-Host ''
Write-Host 'Firewall rules ready for LAN access from other PCs.'
Write-Host "  API:       http://${ServerHost}:3001"
Write-Host "  Web Admin: http://${ServerHost}:5173"
Write-Host "  SVN:       svn://${ServerHost}:3690/Repo"
