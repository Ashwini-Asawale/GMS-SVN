# Phase 2 — GMS SVN SERVER (VisualSVN & Storage)

**Previous:** [Phase 1 — Core Web Platform](./Phase_01_Core_Web_Platform.md)  
**Next:** [Phase 3 — Server Agent](./Phase_03_Server_Agent.md)  
**Duration:** 2–3 weeks  
**Component name:** **GMS SVN SERVER**  
**Spec reference:** VisualSVN setup, repository root path, backup path, storage validation

---

## Goal

Production-grade SVN infrastructure on dedicated Windows Server with validated storage topology before any automation.

---

## Deliverables

### Infrastructure (on-prem)

- Dedicated Windows Server with VisualSVN Server installed and licensed
- Repository root on **iSCSI block volume** mounted as local disk (preferred)
- NAS SMB shares:
  - `\\GMS-NAS\SVN\Repositories\` (only if iSCSI unavailable)
  - `\\GMS-NAS\SVN\Backups\`
  - `\\GMS-NAS\SVN\Reports\`
  - `\\GMS-NAS\SVN\Attachments\`
  - `\\GMS-NAS\SVN\Logs\`
- VisualSVN repository root pointed at iSCSI mount
- Standard layout: `/trunk`, `/branches`, `/tags`
- Backup script template with retention policy
- Restore validation procedure documented and executed once

### Backend Integration (config only)

- Admin Settings: persist storage paths, VisualSVN server hostname, repo root path
- Connection test endpoint (manual checklist; full agent test in Phase 3)

### Documentation (`docs/runbooks/`)

- [VisualSVN install and hardening checklist](../runbooks/visualsvn-install-hardening.md)
- [iSCSI vs SMB decision record](../runbooks/storage-iscsi-vs-smb.md)
- [Backup/restore runbook](../runbooks/backup-restore.md)
- ADR: [ADR-004-repo-storage-topology.md](../adr/ADR-004-repo-storage-topology.md)

### Scripts (`infra/scripts/`)

- `gms-svn-backup.ps1` — daily hotcopy with retention
- `gms-svn-restore-validate.ps1` — isolated restore validation

---

## Implementation status (code)

| Deliverable | Status |
|-------------|--------|
| Admin Settings — storage paths + VisualSVN config | Done (API + Web Admin Settings) |
| Connection test endpoint | Done (`POST /settings/test-connection`) |
| Runbooks + backup scripts | Done (templates; ops executes validation) |
| On-prem VisualSVN + iSCSI/NAS | **Ops / Infra** — use runbooks |

---

## Storage Recommendations

| Storage item | Preferred | Notes |
|--------------|-----------|-------|
| SVN repository data | iSCSI block volume | Behaves like local disk |
| SVN repo alternative | SMB 3.x UNC | Only after VisualSVN validation |
| Backups | NAS / SMB share | Separate path, retention policy |
| Reports | NAS / SMB or MinIO/S3 | Outside application server |
| Attachments | NAS / SMB or MinIO/S3 | Issue/approval files |
| Logs export | NAS / SMB share | Operational log archive |

---

## Validation Checklist

- [ ] Create 1 test repo manually in VisualSVN Manager
- [ ] SVN checkout/commit from test client succeeds
- [ ] Backup script completes; restore to isolated path succeeds
- [ ] Latency/lock behavior acceptable under concurrent commit test
- [ ] If SMB used: follow [VisualSVN network share guidance](https://www.visualsvn.com/support/topic/00022/)

---

## Acceptance Criteria

- [ ] VisualSVN hosts repos on validated storage
- [ ] NAS paths reachable from web server (reports/attachments) and SVN server (backups)
- [ ] Runbooks reviewed by ops team
- [ ] Restore validation executed and documented

---

## Dependencies

- [Phase 1](./Phase_01_Core_Web_Platform.md) Admin Settings model
- Hardware/NAS provisioning (external)

---

## Risks / Mitigations

| Risk | Mitigation |
|------|------------|
| SMB repo corruption/locking | iSCSI mandatory for production; SMB only after sign-off |
| Backup without restore proof | Scheduled restore validation for critical repos |

---

## Team Focus

| Role | Focus |
|------|-------|
| Infra/DevOps | VisualSVN install, iSCSI, NAS shares, backup scripts |
| Backend dev | Admin Settings storage config API |
| Ops | Runbook review, validation execution |
