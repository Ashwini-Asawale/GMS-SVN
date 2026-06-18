# Phase 0 — Project Foundation and Environments

**Previous:** —  
**Next:** [Phase 1 — Core Web Platform](./Phase_01_Core_Web_Platform.md)  
**Duration:** 1–2 weeks  
**Index:** [Phase Plans README](./README.md)

---

## Goal

Establish repo structure, local dev stack, CI skeleton, and architecture decision records before feature work.

---

## Deliverables

- Monorepo scaffold with TypeScript project references
- Docker Compose: PostgreSQL, Redis (dev profile) — OpenSearch deferred to optional Phase 7
- Prisma initialized with empty migration pipeline
- Fastify health-check API stub + React shell with login placeholder route
- GitHub Actions: lint, typecheck, test, Docker image build (no deploy yet)
- ADR documents for: Electron client, hybrid deployment, agent allowlist pattern

---

## Key Tasks

1. Define environment variable contract (`.env.example`): DB, Redis, JWT secrets, agent endpoint, NAS path placeholders
2. Establish SVN naming conventions:
   - "SVN Checkout" not "Clone"
   - "SVN Review Request" not "Pull Request"
3. Define core data model: `User`, `Group`, `GroupMember`, `Repository` (no Tenant, Role, UserRole, Department)
4. Define basic audit event schema: login, user/group changes, SVN ops

---

## Recommended Monorepo Layout

```
gms-svn/
  apps/web/               # React + TSX + Tailwind + shadcn/ui
  apps/api/               # Fastify + TypeScript + Prisma
  apps/agent/             # .NET Windows Service
  apps/client/            # Electron + React
  apps/shell-extension/   # Native Windows context menu
  packages/shared/        # Shared types, Zod schemas
  packages/svn-contracts/ # Agent command + audit event contracts
  infra/docker/           # docker-compose, OpenSearch, Redis, Postgres
  infra/scripts/          # VisualSVN setup, hooks, backup scripts
  docs/                   # Architecture, runbooks, ADRs
```

---

## Acceptance Criteria

- [ ] `docker compose up` starts web stack locally
- [ ] API returns 200 on `/health`; frontend loads
- [ ] CI passes on stub codebase
- [ ] ADRs documented for Electron, hybrid deployment, agent allowlist
- [ ] `.env.example` covers all required variables

---

## Dependencies

None (entry point)

---

## Team Focus

| Role | Focus |
|------|-------|
| Full-stack dev | Monorepo scaffold, API stub, React shell |
| DevOps | Docker Compose, CI pipeline |
| Architect | ADRs, audit schema, naming conventions |
