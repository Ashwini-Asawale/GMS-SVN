# GMS SVN SERVER Agent

Windows service on **GMS SVN SERVER** — secure bridge between GMS SVN Web Admin and VisualSVN.

## Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- VisualSVN Server (production) or `MockMode: true` for development

## Build and run (console)

```powershell
cd D:\GMS-SVN\apps\agent
dotnet build GmsSvn.Agent.sln
dotnet run --project src\GmsSvn.Agent\GmsSvn.Agent.csproj
```

Agent listens on `http://0.0.0.0:8443` by default.

## Configuration

Edit `src/GmsSvn.Agent/appsettings.json`:

| Setting | Description |
|---------|-------------|
| `Agent:HmacSecret` | Must match `AGENT_HMAC_SECRET` in Web Admin `.env` |
| `Agent:RepoRoot` | VisualSVN repository root (iSCSI mount) |
| `Agent:MockMode` | `true` — simulate commands without VisualSVN |

## Install as Windows Service

```powershell
dotnet publish src\GmsSvn.Agent\GmsSvn.Agent.csproj -c Release -o publish
.\scripts\install-service.ps1 -PublishDir (Resolve-Path publish)
```

Service name: **GmsSvnServerAgent** — set to automatic start.

## Web Admin integration

In repo root `.env`:

```env
AGENT_BASE_URL=http://gms-svn-server.local:8443
AGENT_HMAC_SECRET=change-me-agent-hmac-secret-min-32-chars
AGENT_MOCK=false
```

For local dev without the agent process:

```env
AGENT_MOCK=true
```

## Allowed commands

- `CreateRepository`, `SetAccessRule`, `RemoveAccessRule`
- `GetRepositoryStatus`, `ListRepositories`
- `ExecuteBackup`, `InstallHook`

All requests must be HMAC-signed. Unsigned requests are rejected.

See [ADR-003](../../docs/adr/ADR-003-agent-allowlist.md) and [Phase 3 plan](../../docs/phases/Phase_03_Server_Agent.md).
