# GMS SVN CLIENT

Windows desktop application — **GMS SVN CLIENT** (Electron + React)

## Operations

SVN Checkout, Update, Commit, Diff, Log, Revert, Lock/Unlock via `svn.exe`.

Connects to **GMS SVN Web Admin** API for login, visible repositories, and audit events.  
Access enforcement is on **VisualSVN** — the client does not duplicate permission logic.

## Prerequisites

- Node.js 20+
- GMS SVN Web Admin API running (`npm run dev:api` or `npm run dev`)
- **svn.exe** — TortoiseSVN or SlikSVN (or set `CLIENT_SVN_MOCK=true` for dev without SVN)

## Dev

```powershell
cd D:\GMS-SVN
npm install
npm run build --workspace=@gms-svn/shared

# Terminal 1 — API
npm run dev:api

# Terminal 2 — Client
cd apps\client
copy .env.example .env
$env:CLIENT_SVN_MOCK="true"   # optional, if no svn.exe
npm run dev
```

Or from repo root: `npm run dev:client`

## Explorer CLI (Phase 6)

Headless mode for Windows Explorer / shell integration:

```powershell
npm run dev -- -- --action update --path "C:\Projects\my-repo"
npm run dev -- -- --action open --path "C:\Projects\my-repo"
```

Packaged install:

```
"GMS SVN CLIENT.exe" -- --action commit --path "C:\Projects\my-repo" --message "Fix"
```

See [apps/shell-extension/README.md](../shell-extension/README.md) for Explorer menu install.

## Package (Windows installer)

### One file for client PC (app + Explorer menu)

```powershell
cd D:\GMS-SVN
npm run pack:client:full
```

Output: `apps/client/release/GMS-SVN-CLIENT-Full-Setup-0.1.0.exe`

On each client PC: run that **one exe as Administrator**, install TortoiseSVN/SlikSVN, sign in once. No .NET on client PC.

### Client app only (no Explorer menu)

```powershell
npm run pack:client
```

Output: `apps/client/release/GMS-SVN-CLIENT-Setup-0.1.0.exe`

## Configuration

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Web Admin API (default `http://localhost:3001`) |
| `CLIENT_SVN_MOCK` | Mock svn commands when `true` |
| `GMS_SVN_CLIENT_SVN_EXE` | Path to `svn.exe` |

## Auth storage

Tokens are stored encrypted via Electron **safeStorage** (Windows DPAPI) in the app user data folder.

## Audit

Each SVN operation posts to `POST /client/audit-events`. Failed posts are queued locally and retried on next login.

## Demo login

| User | Password |
|------|----------|
| admin | admin123 |
| dev1 | dev123 |

Admin sees all active repos; dev1 sees repos with matching access rules (add rules in Web Admin → Repositories).
