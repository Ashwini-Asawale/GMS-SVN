# Phase 7 — Audit Log and Simple Reports

**Previous:** [Phase 6 — Explorer Integration](./Phase_06_Explorer_Integration.md)  
**Next:** — (Phase 8 deferred)  
**Duration:** 2–3 weeks  
**Status:** Optional add-on after MVP  
**Approach:** Simple SVN-like — basic logs and CSV/PDF export, no OpenSearch

---

## Goal

View who did what (login, commit, permission changes). Export simple reports. No enterprise search engine.

---

## Deliverables

### Audit Log UI

- Filterable table: user, action, repo, date
- Actions logged:
  - Login / logout / failed login
  - User and group changes
  - Repo create / rename / archive
  - Access rule add / remove
  - SVN Checkout, Update, Commit (from client — Phase 5)

### Simple Reports (CSV + PDF)

- User list with group membership
- Repo list with size and latest revision
- Access rules per repo (user/group × path × access)
- Commit history per repo (from SVN log via agent)
- Audit log export (date range filter)

- Generated on demand or scheduled; saved to NAS reports folder
- No BullMQ required for MVP — synchronous for small datasets, async job only if slow

---

## Acceptance Criteria

- [ ] Admin views and filters audit log
- [ ] Export audit log to CSV
- [ ] Export repo access rules to PDF
- [ ] Commit history report matches SVN log

---

## Out of Scope

- OpenSearch / Elasticsearch
- Global full-text search
- Complex scheduled report engine
- Backup management UI (keep in ops runbook — Phase 2)

---

## Dependencies

- [Phase 5](./Phase_05_Electron_Client.md) client audit events
- [Phase 4](./Phase_04_Repository_Web_UI.md) access rules and repos

---

## Team Focus

| Role | Focus |
|------|-------|
| Backend dev | Audit query API, CSV/PDF export |
| Frontend dev | Audit log table, export buttons |
