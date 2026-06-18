# GMS SVN Platform



Simple SVN management built around two named components:



| Component | Name | Runs on |

|-----------|------|---------|

| Server | **GMS SVN SERVER** | Windows Server — VisualSVN, repos, server agent |

| Client | **GMS SVN CLIENT** | Windows PC — Checkout, Update, Commit, Diff, Log |

| Web Admin | **GMS SVN Web Admin** | Docker — users, groups, repo permissions |



## Phase 6 — Explorer Integration (current)

Right-click SVN actions in Windows File Explorer via shell extension + client CLI bridge.

```powershell
npm run dev:api          # terminal 1
npm run dev:client       # terminal 2 — sign in once
dotnet build apps/shell-extension/GmsSvn.Shell.sln -c Release
```

See [apps/shell-extension/README.md](./apps/shell-extension/README.md) and [apps/client/README.md](./apps/client/README.md).

---

## Phase 5 — GMS SVN CLIENT

Windows Electron desktop client for SVN operations.

```powershell
npm run dev:api          # terminal 1
npm run dev:client       # terminal 2 (set CLIENT_SVN_MOCK=true if no svn.exe)
```

See [apps/client/README.md](./apps/client/README.md).

---

## Phase 4 — Repository Web UI

VisualSVN-style repo management in the browser: access rules, browse, log, diff.

### Dev mode

Ensure `.env` has `AGENT_MOCK=true`, then:

```bash
npm run db:migrate
npm run dev
```

Open **Repositories** → click a repo → tabs: **Browse**, **Log**, **Access rules**.

---

Signed command bridge between Web Admin API and VisualSVN on GMS SVN SERVER.

### Dev mode (no .NET agent required)

In `.env`:

```env
AGENT_MOCK=true
```

Create repositories from **Repositories** page as admin — mock agent activates repo immediately.

### Production agent

See [apps/agent/README.md](./apps/agent/README.md) — requires .NET 8 SDK on GMS SVN SERVER.

Apply database migration:

```bash
npm run db:migrate
```

---

## Phase 1 — Core Web Platform



### Demo login



| User | Password | Access |

|------|----------|--------|

| admin | admin123 | Full admin — users, groups, settings |

| dev1 | dev123 | Dashboard + repositories (read-only admin) |

| dev2 | dev123 | Dashboard + repositories (read-only admin) |



### Prerequisites



- Node.js 20+
- **PostgreSQL** — Docker Desktop **or** PostgreSQL for Windows

> **Error `dockerDesktopLinuxEngine`?** Docker Desktop is not running. Open **Docker Desktop** from the Start menu and wait until it says *Running*, then run `npm run docker:up` again.  
> Alternative (no Docker): [docs/runbooks/local-database-setup.md](./docs/runbooks/local-database-setup.md)



### Quick start



```bash

cp .env.example .env

npm run docker:up

npm install

npm run build --workspace=@gms-svn/shared

npm run db:migrate

npm run db:seed

npm run dev

```



- **Web Admin:** http://localhost:5173

- **API:** http://localhost:3001/health



### Project structure



```

apps/api/              GMS SVN Web Admin API

apps/web/              GMS SVN Web Admin UI

apps/agent/            GMS SVN SERVER Agent (Phase 3)

apps/client/           GMS SVN CLIENT (Phase 5)
apps/shell-extension/  Explorer context menu (Phase 6)

docs/phases/           Phase-wise plans

```



See [docs/phases/README.md](./docs/phases/README.md) for implementation plans.

### Full setup guide (admin)

End-to-end instructions: server, Web Admin, create repos, assign users/branches, build and install **GMS SVN CLIENT** on developer PCs — [docs/runbooks/complete-setup-guide.md](./docs/runbooks/complete-setup-guide.md).


