# Phase 1 — Core Web Platform

**Previous:** [Phase 0 — Foundation](./Phase_00_Foundation.md)  
**Next:** [Phase 2 — VisualSVN & Storage](./Phase_02_VisualSVN_Storage.md)  
**Duration:** 2–3 weeks  
**Approach:** Simple SVN-like — same concepts as VisualSVN Server Manager

---

## Goal

Login, users, groups, group members, basic admin dashboard, repository list (metadata only). No multi-tenant, no roles, no approval workflows.

---

## Data Model

```
User
Group
GroupMember (User ↔ Group)
Repository (name, url, status, latestRevision — cached)
```

| Model | Purpose |
|-------|---------|
| `User` | SVN/web login account (`username`, `password`, `email`, `isAdmin`) |
| `Group` | Named group — same idea as VisualSVN group |
| `GroupMember` | Which users belong to which group |
| `Repository` | Repo metadata synced from VisualSVN (Phase 3+) |

**Not used:** `Tenant`, `Role`, `UserRole`, `Department`, `PermissionGroup`

### Access model (simple)

| Who | Web admin | SVN access |
|-----|-----------|------------|
| `User.isAdmin = true` | Full web console | All repos (or via admin group) |
| Normal user | Read-only dashboard, own profile | Defined by repo access rules (Phase 4) |
| Group member | — | Inherited from group access rules (Phase 4) |

Repo/path permissions (read / write / no access) are set in **Phase 4** — applied to **users and groups**, exactly like VisualSVN.

---

## Deliverables

### Backend (`apps/api`)

- Auth: login/logout, JWT access + refresh, bcrypt password hashing
- CRUD APIs: `User`, `Group`, `GroupMember`
- `Repository` metadata table (empty until Phase 3 sync)
- Simple middleware: `isAdmin` guard for admin routes; everything else open to logged-in users
- Basic audit log: login, logout, failed login, user/group changes
- Settings stub: VisualSVN server URL, repo root path (used in Phase 2–3)

### Frontend (`apps/web`)

- Login page
- **Dashboard:** repo count, user count, last revision (placeholder until Phase 3)
- **Users:** list, create, edit, disable, set `isAdmin`
- **Groups:** list, create, edit, add/remove members
- **Repositories:** list only (create/manage in Phase 4)
- Simple sidebar — no disabled future-module stubs

### Database (Prisma)

- Tables: `User`, `Group`, `GroupMember`, `Repository`, `AuditLog`, `RefreshToken`
- Seed: 1 admin user, 2–3 sample users, 1–2 groups with members, 0 repos

---

## Acceptance Criteria

- [ ] Admin logs in and manages users and groups
- [ ] Normal user logs in and sees limited dashboard
- [ ] Group membership add/remove works
- [ ] User create/edit/disable writes audit log
- [ ] Failed login attempts logged

---

## Dependencies

- [Phase 0 — Foundation](./Phase_00_Foundation.md)

---

## Out of Scope (this phase)

- Repo create/delete (Phase 4)
- Path permissions (Phase 4)
- SVN operations (Phase 5)
- Multi-tenant / organizations
- Approval workflows
- Issues, wiki, Kanban

---

## Team Focus

| Role | Focus |
|------|-------|
| Backend dev | Auth, User/Group/GroupMember APIs, audit log |
| Frontend dev | Login, users, groups, simple dashboard |
| QA | Admin vs normal user access |
