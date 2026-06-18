# GMS SVN — Explorer Shell Integration (Phase 6)

Context-aware **Windows Explorer** right-click menu for SVN working copies.  
Thin shell layer — all SVN logic runs in **GMS SVN CLIENT** via CLI bridge.

## Components

| Component | Role |
|-----------|------|
| `GmsSvn.ShellExtension` | COM context menu (SharpShell) — only visible inside `.svn` working copies |
| `GmsSvn.ShellBridge.exe` | Launches `GMS SVN CLIENT.exe --action … --path …` |
| `GMS SVN CLIENT` CLI | Headless `--action update|commit|diff|…` using stored credentials |

## Menu items

- SVN Update, Commit, Diff, Revert, Log, Lock, Unlock
- **Open in GMS SVN CLIENT** — full UI with working copy deep link

## Prerequisites

- .NET 8 SDK (build shell extension)
- GMS SVN CLIENT installed and user signed in at least once
- `svn.exe` (TortoiseSVN / SlikSVN) or `CLIENT_SVN_MOCK=true` for dev

## Build

```powershell
cd D:\GMS-SVN
dotnet build apps\shell-extension\GmsSvn.Shell.sln -c Release
npm run build:client
```

## Install (admin PowerShell)

Combined install (copies client + shell, registers COM):

```powershell
.\infra\installer\install-gms-svn-client.ps1 -InstallDir "C:\Program Files\GMS SVN CLIENT"
```

Register only (existing install folder):

```powershell
.\apps\shell-extension\scripts\register-shell-extension.ps1 -InstallDir "C:\Program Files\GMS SVN CLIENT"
```

Uninstall shell registration:

```powershell
.\apps\shell-extension\scripts\unregister-shell-extension.ps1
```

Restart Explorer after install (`taskkill /f /im explorer.exe & start explorer`).

## Dev testing without COM registration

Invoke the bridge directly:

```powershell
$env:GMS_SVN_CLIENT_EXE = "D:\GMS-SVN\node_modules\electron\dist\electron.exe"
$env:GMS_SVN_SHELL_BRIDGE_EXE = "D:\GMS-SVN\apps\shell-extension\src\GmsSvn.ShellBridge\bin\Debug\net8.0-windows\GmsSvn.ShellBridge.exe"

# Terminal 1: API
npm run dev:api

# Terminal 2: sign in via Electron GUI first, then:
dotnet run --project apps\shell-extension\src\GmsSvn.ShellBridge -- update "C:\path\to\working-copy"
```

Or call the client CLI directly:

```powershell
cd D:\GMS-SVN\apps\client
$env:CLIENT_SVN_MOCK="true"
npx electron-vite dev -- --action update --path "C:\path\to\wc"
```

## CLI reference

```
"GMS SVN CLIENT.exe" -- --action <action> --path "<path>" [--message "<text>"] [--quiet]

Actions: update, commit, diff, revert, log, lock, unlock, open
```

Credentials are read from the encrypted auth store (same as the GUI login).

## Code signing

Production deployments should sign `GmsSvn.ShellExtension.dll`, `GmsSvn.ShellBridge.exe`, and `GMS SVN CLIENT.exe` so Explorer trusts the context menu handler.

## Architecture

```
Explorer right-click
    → GmsSvn.ShellExtension (COM, context-aware)
    → GmsSvn.ShellBridge.exe
    → GMS SVN CLIENT.exe --action … --path …
    → svn.exe + POST /client/audit-events
```
