# Phase 4 — Repository Management Web UI

**Previous:** [Phase 3 — Server Agent](./Phase_03_Server_Agent.md)  
**Next:** [Phase 5 — Electron Client](./Phase_05_Electron_Client.md)  
**Duration:** 3–4 weeks  
**Approach:** Simple SVN-like — VisualSVN Server Manager in a web UI

---

## Goal

Create repos, set user/group access on paths, browse source, view log and diff. Direct admin actions — no approval workflows.

---

## Deliverables

### Repository Management (admin)

- Create repository → agent `CreateRepository` → standard `/trunk`, `/branches`, `/tags`
- List repositories with size and latest revision
- Rename, archive (admin only, direct action)

### Access Rules (core SVN feature)

Same as VisualSVN — assign to **user** or **group**:

| Path | User/Group | Access |
|------|------------|--------|
| `/` | Developers | Read |
| `/trunk` | Developers | Read/Write |
| `/branches` | Developers | Read/Write |

- UI: pick repo → pick user or group → pick path → read / write / no access
- Save → agent `SetAccessRule` → VisualSVN
- Remove rule → agent `RemoveAccessRule`

### Source Browser

- Folder/file tree (`svn list` via agent)
- Revision log: author, date, message, changed paths
- Diff viewer: file or revision range

### Background Job

- Nightly sync: repo size, HEAD revision, repo list from agent

---

## Implementation status (code)

| Deliverable | Status |
|-------------|--------|
| Create / list / rename / archive repositories | Done |
| Access rules UI + `SetAccessRule` / `RemoveAccessRule` | Done |
| Source browser (`ListPath` via agent) | Done |
| Revision log + diff viewer | Done |
| Nightly BullMQ sync job | Done (02:00 cron, requires Redis) |
| VisualSVN live SVN on production agent | Mock in dev; real `svn` on agent when deployed |

---

## Acceptance Criteria

- [ ] Admin creates repo; it appears in VisualSVN and web list
- [ ] Access rule for group applies to all group members on SVN Checkout
- [ ] Access rule for single user works independently
- [ ] Source browser shows trunk/branches/tags
- [ ] Log and diff viewer work for selected path/revision
- [ ] No approval step required for any admin action

---

## Dependencies

- [Phase 3](./Phase_03_Server_Agent.md) agent commands
- [Phase 1](./Phase_01_Core_Web_Platform.md) User, Group, GroupMember

---

## Out of Scope (this phase)

- Approval workflows
- Email notifications
- Permission drift reports (keep sync simple; re-save if needed)
- Issues, review requests, wiki

---

## Team Focus

| Role | Focus |
|------|-------|
| Backend dev | Repo CRUD via agent, access rule API, source browser proxy |
| Frontend dev | Repo list, access rule form, log/diff viewer |
| QA | Access rule → SVN Checkout verify on test client |
