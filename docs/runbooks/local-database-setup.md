# Local Development — Database Setup (Windows)



The web admin needs **PostgreSQL**. Use **local Windows PostgreSQL** (recommended for pgAdmin) or **Docker**.



---



## Option A: Local Windows PostgreSQL + pgAdmin (recommended)



### 1. Install PostgreSQL 16



Download from [https://www.postgresql.org/download/windows/](https://www.postgresql.org/download/windows/) or:



```powershell

winget install PostgreSQL.PostgreSQL.16

```



During setup, note the password for the `postgres` superuser.



If Docker Postgres was already using port **5432**, local PostgreSQL may install on **5433** instead.



### 2. Automated setup



Stop Docker Postgres and configure the app database:



```powershell

cd D:\GMS-SVN

docker stop gms-svn-postgres



# If you know your postgres password:

.\infra\scripts\setup-local-postgresql.ps1 -PostgresSuperPassword "YOUR_PASSWORD" -Port 5433 -SkipPortMove



# If you forgot the postgres password (local dev only):

.\infra\scripts\setup-local-postgresql.ps1 -ResetPostgresPassword "postgres" -Port 5433 -SkipPortMove

```



The script creates `gms_svn` / `gms_svn_dev`, updates `.env`, and runs migrate + seed.



### 3. pgAdmin connection



**Superuser (manage server):**



| Field | Value |

|-------|-------|

| Host | `localhost` |

| Port | `5433` (or `5432` if Docker Postgres is stopped and PG was restarted) |

| Username | `postgres` |

| Password | Your install password (or `postgres` if you used `-ResetPostgresPassword`) |



**App database (view GMS-SVN tables):**



| Field | Value |

|-------|-------|

| Host | `localhost` |

| Port | `5433` |

| Maintenance database | `gms_svn` |

| Username | `gms_svn` |

| Password | `gms_svn_dev` |



> **Common mistake:** "PostgreSQL 16" is only a display name in pgAdmin. The **Host** field must be `localhost`, not the server name.



### 4. Start the app



```powershell

npm run dev

```



Login: org `default` · `admin@gms.local` / `admin123`



---



## Option B: Docker Desktop



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



Docker Postgres uses user `gms_svn` / `gms_svn_dev` — there is no `postgres` superuser with your Windows install password.



---



## Verify connection



```powershell

npm run db:seed

```



Success output:



```

Seed complete:

  tenant: default

  admin@gms.local / admin123 (isAdmin)

  dev1@gms.local / dev123

```



Then open **http://localhost:5173** — login org `default`, `admin@gms.local` / `admin123`.



---



## Common errors



| Error | Fix |

|-------|-----|

| `DATABASE_URL is not set` | Copy `.env.example` to `D:\GMS-SVN\.env` |

| `Can't reach database server at localhost:5432` | Check port in `.env` — local PG may be on **5433** |

| `password authentication failed for user "postgres"` on port 5432 | You are hitting **Docker** Postgres — use `gms_svn`/`gms_svn_dev`, or stop Docker and use local PG on 5433 |

| `failed to resolve host 'PostgreSQL 16'` | Set **Host** to `localhost`, not the server display name |

| Docker pipe not found | Start Docker Desktop application first |

| `migrate` fails (shadow database) | Grant CREATEDB: `ALTER ROLE gms_svn CREATEDB;` as postgres superuser |

