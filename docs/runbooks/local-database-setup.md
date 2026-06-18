# Local Development — Database Setup (Windows)

The web admin needs **PostgreSQL**. You can use **Docker** (recommended) or **PostgreSQL installed on Windows**.

---

## Option A: Docker Desktop (recommended)

### Error you may see

```
failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine
The system cannot find the file specified.
```

**Meaning:** Docker Desktop is **not running** or **not installed**.

### Fix

1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/) if not installed
2. **Start Docker Desktop** from the Start menu
3. Wait until the tray icon shows **Docker Desktop is running**
4. In terminal:

```powershell
cd D:\GMS-SVN
npm run docker:up
npm run db:migrate
npm run db:seed
npm run dev
```

Verify Postgres:

```powershell
docker ps
```

You should see `gms-svn-postgres` running on port `5432`.

---

## Option B: PostgreSQL installed on Windows (no Docker)

### 1. Install PostgreSQL

Download from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/) (PostgreSQL 16).

During setup, note:
- Password for `postgres` superuser
- Port (default `5432`)

### 2. Create database and user

Open **pgAdmin** or `psql` and run:

```sql
CREATE USER gms_svn WITH PASSWORD 'gms_svn_dev';
CREATE DATABASE gms_svn OWNER gms_svn;
GRANT ALL PRIVILEGES ON DATABASE gms_svn TO gms_svn;
```

### 3. Update `.env` at repo root

```env
DATABASE_URL=postgresql://gms_svn:gms_svn_dev@localhost:5432/gms_svn?schema=public
```

### 4. Migrate and seed

```powershell
cd D:\GMS-SVN
npm run db:migrate
npm run db:seed
npm run dev
```

---

## Verify connection

```powershell
npm run db:seed
```

Success output:

```
Seed complete:
  admin / admin123 (isAdmin)
  dev1  / dev123
  dev2  / dev123
```

Then open **http://localhost:5173** — login `admin` / `admin123`.

---

## Common errors

| Error | Fix |
|-------|-----|
| `DATABASE_URL is not set` | Copy `.env.example` to `D:\GMS-SVN\.env` |
| `Can't reach database server at localhost:5432` | Start Docker (`npm run docker:up`) or Windows PostgreSQL service |
| Docker pipe not found | Start Docker Desktop application first |
| `migrate` fails | Ensure Postgres is running, then `npm run db:push --workspace=@gms-svn/api` |
