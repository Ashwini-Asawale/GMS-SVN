# GMS SVN — Complete Setup Guide (Start to Finish)

**Audience:** Administrators and IT staff  
**Covers:** GMS SVN SERVER, GMS SVN Web Admin, repositories, user/branch permissions, and GMS SVN CLIENT deployment on developer PCs

---

## Architecture overview

```mermaid
flowchart LR
  subgraph devPC [Developer PC]
    Client[GMS SVN CLIENT]
    Explorer[Windows Explorer shell menu]
  end

  subgraph adminHost [Admin / Docker host]
    Web[GMS SVN Web Admin UI]
    API[Web Admin API]
    DB[(PostgreSQL)]
    Redis[(Redis)]
  end

  subgraph svnServer [GMS SVN SERVER - Windows Server]
    Agent[GMS SVN SERVER Agent]
    VSVN[VisualSVN Server]
    Repos[(SVN Repositories)]
  end

  Web --> API
  Client --> API
  API --> DB
  API --> Redis
  API -->|HMAC signed commands| Agent
  Agent --> VSVN
  VSVN --> Repos
  Client -->|svn.exe HTTPS| VSVN
  Explorer --> Client
```

| Component | Where it runs | Purpose |
|-----------|---------------|---------|
| **GMS SVN SERVER** | Windows Server | VisualSVN, repository files, server agent |
| **GMS SVN Web Admin** | Docker host or dev machine | Users, groups, repos, access rules, audit |
| **GMS SVN CLIENT** | Each developer PC | Checkout, update, commit, diff, log |

---

## Prerequisites

### GMS SVN SERVER (Windows Server)

- Windows Server 2019+ with static IP or DNS (e.g. `gms-svn-server.local`)
- VisualSVN Server installed and licensed — see [visualsvn-install-hardening.md](./visualsvn-install-hardening.md)
- Repository root on local or iSCSI disk (e.g. `D:\SVN\Repositories`)
- NAS paths for backups/reports (optional but recommended)
- .NET 8 SDK (to build/install the server agent)

### GMS SVN Web Admin host

- Node.js 20+
- Docker Desktop **or** local PostgreSQL — see [local-database-setup.md](./local-database-setup.md)
- Network access to GMS SVN SERVER agent port (default `8443`)

### Developer PC (GMS SVN CLIENT)

- Windows 10/11
- **svn.exe** — install [TortoiseSVN](https://tortoisesvn.net/) or [SlikSVN](https://sliksvn.com/) (command-line tools only is enough)
- Outbound HTTPS to VisualSVN URL and Web Admin API URL

---

## Step 1 — Install GMS SVN SERVER (VisualSVN)

1. Install VisualSVN Server on the Windows Server.
2. Set **Repositories root** to your storage path, e.g. `D:\SVN\Repositories`.
3. Enable **HTTPS** with a valid certificate (internal CA is fine).
4. Create a **repository template** with standard layout so new repos get:

   ```
   /trunk
   /branches
   /tags
   ```

5. Note these values — you will enter them in Web Admin **Settings** later:

   | Setting | Example |
   |---------|---------|
   | Server hostname | `gms-svn-server.local` |
   | VisualSVN URL | `https://gms-svn-server.local/svn` |
   | Repository root | `D:\SVN\Repositories` |

6. Validate manually: create one test repo in VisualSVN Manager, checkout and commit from a test machine.

Full checklist: [visualsvn-install-hardening.md](./visualsvn-install-hardening.md)

---

## Step 2 — Install GMS SVN SERVER Agent

The agent is the secure bridge between Web Admin and VisualSVN.

### Build and install as Windows Service

On the **GMS SVN SERVER** (or build machine with repo access):

```powershell
cd D:\GMS-SVN\apps\agent
dotnet build GmsSvn.Agent.sln
dotnet publish src\GmsSvn.Agent\GmsSvn.Agent.csproj -c Release -o publish
.\scripts\install-service.ps1 -PublishDir (Resolve-Path publish)
```

Service name: **GmsSvnServerAgent** (automatic start).

### Agent configuration

Edit `appsettings.json` in the publish folder:

| Setting | Description |
|---------|-------------|
| `Agent:HmacSecret` | Shared secret — must match Web Admin `.env` |
| `Agent:RepoRoot` | Same as VisualSVN repo root, e.g. `D:\SVN\Repositories` |
| `Agent:MockMode` | `false` in production |

Open firewall port **8443** (or your chosen agent port) from the Web Admin host only.

See [apps/agent/README.md](../../apps/agent/README.md) for details.

---

## Step 3 — Start GMS SVN Web Admin

On the machine that hosts the API and web UI (dev laptop or Docker server):

```powershell
cd D:\GMS-SVN
copy .env.example .env
# Edit .env — see configuration table below

npm run docker:up          # PostgreSQL + Redis
npm install
npm run build --workspace=@gms-svn/shared
npm run db:migrate
npm run db:seed            # creates demo users (optional in prod)
npm run dev                # API :3001 + Web UI :5173
```

For production, build and serve the web app behind a reverse proxy and run the API as a service. Dev URLs:

| Service | URL |
|---------|-----|
| Web Admin | http://localhost:5173 |
| API health | http://localhost:3001/health |

### Required `.env` values (production)

```env
# Database & Redis (from docker-compose or your own)
DATABASE_URL=postgresql://gms_svn:...@localhost:5432/gms_svn?schema=public
REDIS_URL=redis://localhost:6379

# JWT — change secrets in production
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...

# API
API_HOST=0.0.0.0
API_PORT=3001
CORS_ORIGIN=http://your-web-admin-host,http://localhost:5175

# GMS SVN SERVER Agent — production
AGENT_BASE_URL=http://gms-svn-server.local:8443
AGENT_HMAC_SECRET=<same-as-agent-appsettings>
AGENT_MOCK=false

# VisualSVN (used when creating repos / building SVN URLs)
GMS_SVN_SERVER_HOST=gms-svn-server.local
VISUALSVN_REPO_ROOT=D:\SVN\Repositories
VISUALSVN_URL=https://gms-svn-server.local/svn

# Public API URL (for post-commit hooks, Phase 9)
API_PUBLIC_URL=https://gms-svn-admin.yourcompany.local
PIPELINE_HOOK_SECRET=<random-secret>
```

**Dev without VisualSVN:** set `AGENT_MOCK=true` — repos activate immediately without the agent.

---

## Step 4 — Configure Web Admin Settings

1. Sign in as **admin** (default after seed: `admin` / `admin123` — change in production).
2. Open **Settings** in the sidebar.
3. Fill in:

   - Server hostname
   - VisualSVN URL
   - Repository root path
   - Storage backend (iSCSI recommended)
   - NAS paths (backup, reports, attachments, logs)

4. Click **Save settings**.
5. Click **Test connection** and fix any failed checks before creating repositories.

---

## Step 5 — Create users and groups

Permissions are assigned to **users** or **groups**, not directly to Windows accounts. VisualSVN receives the same principal names via the agent.

### Create users

1. Go to **Users** → **Add user**.
2. Enter username, email, password.
3. Check **Admin** only for platform administrators (full access to all repos in Web Admin and CLIENT).
4. Click **Add user**.

### Create groups (recommended)

Use groups for team-based access (e.g. `Developers`, `QA`, `Release-Managers`):

1. Go to **Groups** → enter name and description → **Add group**.
2. Select a user from the dropdown → **Add** to attach members.

> **Tip:** Assign access rules to **groups** whenever possible. Add/remove users from the group instead of editing repo rules per person.

---

## Step 6 — Create a repository

### From Web Admin (recommended)

1. Go to **Repositories**.
2. Enter a name (letters, numbers, `.`, `_`, `-` only; e.g. `my-project`).
3. Click **Create repository**.

What happens:

- Web Admin sends `CreateRepository` to the GMS SVN SERVER Agent.
- VisualSVN creates the repo with standard `/trunk`, `/branches`, `/tags` layout.
- Status changes from **PENDING** → **ACTIVE** when complete (page auto-refreshes for admins).

### Import existing repos from VisualSVN

If repos already exist on the server:

1. Go to **Repositories** → **Sync from server**.
2. Web Admin pulls the list from the agent and registers them.

### Verify

- Status column shows **ACTIVE**.
- **SVN URL** column shows e.g. `https://gms-svn-server.local/svn/my-project`.
- Open the repo → **Browse** tab lists `/trunk`, `/branches`, `/tags`.

---

## Step 7 — Assign users to a repository or branch path

Access is **path-based**, matching VisualSVN semantics. You grant READ or WRITE on a specific path inside a repo — not on the repo name alone.

### Common path examples

| Path | Meaning |
|------|---------|
| `/` | Entire repository |
| `/trunk` | Trunk only |
| `/branches` | All branches folder |
| `/branches/release-2.0` | One specific branch |
| `/tags` | Tags folder (often read-only) |

### Add an access rule

1. Open **Repositories** → click the repo name.
2. Go to the **Access rules** tab.
3. Fill in the form:

   | Field | Example |
   |-------|---------|
   | Path | `/trunk` or `/branches/feature-x` |
   | Principal type | `Group` or `User` |
   | Principal | `Developers` or `dev1` |
   | Access | `Read` or `Read / Write` |

4. Click **Save to VisualSVN**.

The rule is pushed to VisualSVN immediately and stored in Web Admin. Removing a rule deletes it from VisualSVN as well.

### Example scenarios

**Developers — write on trunk and branches, read-only on tags:**

| Path | Principal | Access |
|------|-----------|--------|
| `/trunk` | Group: Developers | Read / Write |
| `/branches` | Group: Developers | Read / Write |
| `/tags` | Group: Developers | Read |

**QA — read-only on entire repo:**

| Path | Principal | Access |
|------|-----------|--------|
| `/` | Group: QA | Read |

**One developer — single feature branch only:**

| Path | Principal | Access |
|------|-----------|--------|
| `/branches/feature-login` | User: dev1 | Read / Write |
| `/trunk` | User: dev1 | Read |

### What users see in GMS SVN CLIENT

- **Admin** users see all **ACTIVE** repositories.
- Non-admin users see repos where they (or a group they belong to) have a rule with access **READ** or **WRITE** (not `NONE`).
- Actual SVN enforcement (commit denied, etc.) is done by **VisualSVN** — the client calls `svn.exe` against the server URL.

---

## Step 8 — Build GMS SVN CLIENT (installer)

Build on a machine with Node.js 20+ and .NET 8 SDK.

### Option A — One file for client PC (recommended)

Installs desktop app **and** Explorer right-click menu. No .NET needed on client PCs.

```powershell
cd D:\GMS-SVN
npm run pack:client:full
```

**Output (copy this ONE file to each PC):**

```
apps\client\release\GMS-SVN-CLIENT-Full-Setup-0.1.0.exe
```

### Option B — Client app only (no Explorer menu)

```powershell
npm run pack:client
```

Output: `apps\client\release\GMS-SVN-CLIENT-Setup-0.1.0.exe`

### Option C — Folder bundle (manual Explorer script)

```powershell
npm run bundle:client
```

Output folder: `apps\client\release\GMS-SVN-Client-Deploy\` (setup exe + `install-explorer-menu.ps1` + `shell\`)

### Build with custom API URL (production)

Before `npm run pack:client:full`, set your server IP in `apps/client/build/gms-svn-client.config.json` or:

```powershell
$env:VITE_API_BASE_URL="http://YOUR-SERVER-IP:3001"
npm run pack:client:full
```

Users only see **username** and **password** on login — the server URL is embedded in the installer config.

If unset, the client defaults to `http://localhost:3001` (dev only).

---

## Step 9 — Install GMS SVN CLIENT on another PC

### One-file install (recommended)

1. Copy **`GMS-SVN-CLIENT-Full-Setup-0.1.0.exe`** to the PC (from `npm run pack:client:full`).
2. Run the installer **as Administrator** (registers Explorer menu automatically).
3. Install **TortoiseSVN** or **SlikSVN** (for `svn.exe`).
4. Open **GMS SVN CLIENT** — on the login screen set **Server URL** to your API machine, e.g. `http://192.168.1.133:3001` (not `localhost` unless the API runs on that same PC).
5. Sign in, checkout a repo, then right-click **inside** that working copy (folder must contain `.svn`).

No .NET install required on the client PC.

**Optional:** pre-set the server URL for all users — copy `gms-svn-client.config.json.example` to `gms-svn-client.config.json` next to `GMS SVN CLIENT.exe` and edit `apiBaseUrl` before users sign in.

**On the API server** ensure `.env` has:

```env
API_HOST=0.0.0.0
API_PORT=3001
```

Allow inbound **TCP 3001** in Windows Firewall on the server machine.

### Legacy: folder bundle (two steps)

If you used `npm run bundle:client` instead, see `GMS-SVN-Client-Deploy\README.txt` and run `install-explorer-menu.ps1` after the setup exe.

### Install TortoiseSVN / SlikSVN (required)

Install one of:

- [TortoiseSVN](https://tortoisesvn.net/) — ensure **command line client tools** are installed
- [SlikSVN](https://sliksvn.com/)

Default path used by the platform:

```
C:\Program Files\TortoiseSVN\bin\svn.exe
```

Or set `GMS_SVN_CLIENT_SVN_EXE` in the environment if installed elsewhere.

---

## Step 10 — First login and checkout on developer PC

1. Launch **GMS SVN CLIENT**.
2. Sign in with a Web Admin user (e.g. `dev1` / `dev123` in dev, or your production account).
3. The app loads repositories visible to that user (based on access rules).
4. Select a repository → **Checkout** → choose a local folder (e.g. `C:\Projects\my-project`).
5. Work in the folder — use the client or Explorer right-click menu for Update, Commit, Diff, Log.

Credentials are stored encrypted (Windows DPAPI). SVN operations use VisualSVN HTTPS; use the same username/password VisualSVN expects (platform users may need to be mapped in VisualSVN auth settings depending on your AD/integration setup).

### Explorer integration (after Option B install)

Inside any SVN working copy folder (contains `.svn`):

- Right-click → **SVN Update**, **Commit**, **Diff**, **Log**, etc.
- **Open in GMS SVN CLIENT** — opens the full UI

User must sign in to the client **at least once** before Explorer actions work (credentials are read from the encrypted store).

---

## Quick reference — demo accounts (after `db:seed`)

| User | Password | Role |
|------|----------|------|
| admin | admin123 | Full admin — all repos, user management |
| dev1 | dev123 | Standard user — sees repos with matching access rules |
| dev2 | dev123 | Standard user |

Change passwords before production use.

---

## Troubleshooting

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| Repo stuck **PENDING** | Agent unreachable or `AGENT_MOCK=false` without agent | Check agent service; or use `AGENT_MOCK=true` for dev |
| Access rule save fails | Agent/VisualSVN error | Check agent logs; verify principal name exists in Web Admin |
| Client shows no repos | No access rules for user | Add rules on **Access rules** tab; or sign in as admin |
| `db:generate` EPERM on Windows | API still running, locks Prisma DLL | Stop `npm run dev:api`, then `npm run db:generate` |
| `pack:client` — cannot compute electron version | Electron hoisted to monorepo root | Fixed in `apps/client/package.json` via `"electronVersion": "34.5.8"` |
| `pack:client` — symlink / winCodeSign error | Windows needs Developer Mode or admin for code-sign cache | Fixed via `"signAndEditExecutable": false`; or enable **Developer Mode** in Windows Settings |
| Pipeline / Issues 404 | Old API process on port 3001 | Stop duplicate API instances; restart once; verify `/health` phase |
| Explorer menu missing | Shell extension not registered | Re-run `register-shell-extension.ps1`; restart Explorer |
| SVN command failed | `svn.exe` not found | Install TortoiseSVN CLI or set `GMS_SVN_CLIENT_SVN_EXE` |

---

## Related documentation

| Topic | Document |
|-------|----------|
| VisualSVN install | [visualsvn-install-hardening.md](./visualsvn-install-hardening.md) |
| Database without Docker | [local-database-setup.md](./local-database-setup.md) |
| Server agent | [apps/agent/README.md](../../apps/agent/README.md) |
| Desktop client | [apps/client/README.md](../../apps/client/README.md) |
| Explorer shell menu | [apps/shell-extension/README.md](../../apps/shell-extension/README.md) |
| Backup / restore | [backup-restore.md](./backup-restore.md) |
| Phase plans | [docs/phases/README.md](../phases/README.md) |
