# Phase 5 — GMS SVN CLIENT

**Previous:** [Phase 4 — Repository Web UI](./Phase_04_Repository_Web_UI.md)  
**Next:** [Phase 6 — Explorer Integration](./Phase_06_Explorer_Integration.md)  
**Duration:** 4–5 weeks  
**Component name:** **GMS SVN CLIENT**  
**Approach:** Simple SVN-like — TortoiseSVN-style operations with GMS login

---

## Goal

Windows client for standard SVN operations. VisualSVN enforces access rules — client does not duplicate permission logic.

---

## Deliverables

### Electron App (`apps/client`)

- Login to GMS API; token stored in Windows Credential Manager
- Show repos user can access (from API — based on user/group access rules)
- SVN operations via `svn.exe`:
  - **SVN Checkout** — pick repo URL and local folder
  - **SVN Update**
  - **SVN Commit** — commit message required
  - **Diff** — local changes or revision compare
  - **Log** — revision history
  - **Revert** — uncommitted changes, with confirmation
  - **Lock / Unlock** (if repo uses locking)
- Working copy list: local path, repo URL, last updated revision
- Send audit event after each operation (user, action, repo, revision, PC name)
- Offline audit queue: retry when API is back

### Backend (minimal)

- `GET /client/repos` — repos visible to logged-in user
- `POST /client/audit-events` — record client operation

Access denied errors come from **SVN server** (VisualSVN), not a separate policy engine.

---

## Acceptance Criteria

- [ ] User Checkouts repo they have read access to
- [ ] Commit fails on SVN server if user lacks write access (VisualSVN rule)
- [ ] Update, Diff, Log, Revert work on working copy
- [ ] Each operation recorded in audit log
- [ ] Token refresh without re-login

---

## Dependencies

- [Phase 4](./Phase_04_Repository_Web_UI.md) repos and access rules
- [Phase 2](./Phase_02_VisualSVN_Storage.md) VisualSVN reachable from PC
- `svn.exe` installed (TortoiseSVN or SlikSVN)

---

## Out of Scope

- Branch/tag wizard (use repo browser or command line)
- Issue/review references in commit message
- Backend policy engine (VisualSVN handles this)
- Auto-update (can add later)

---

## Team Focus

| Role | Focus |
|------|-------|
| Electron dev | Client UI, svn.exe wrapper, Credential Manager |
| Backend dev | `/client/repos`, `/client/audit-events` |
| QA | Checkout → Update → Commit flow on test repo |

---

## Implementation status (code)

| Deliverable | Status |
|-------------|--------|
| Electron app — login, working copies, SVN ops | Done (`apps/client`) |
| Token storage (Electron safeStorage / Windows DPAPI) | Done |
| Offline audit queue + flush on login | Done |
| `GET /client/repos` | Done |
| `POST /client/audit-events` | Done |
| Explorer shell extension | Phase 6 |
