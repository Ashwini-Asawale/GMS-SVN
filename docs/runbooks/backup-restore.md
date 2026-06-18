# Backup and Restore Runbook

**Component:** GMS SVN SERVER  
**Phase:** 2  
**Script:** [gms-svn-backup.ps1](../../infra/scripts/gms-svn-backup.ps1)

---

## Overview

VisualSVN repositories on GMS SVN SERVER are backed up to the NAS share configured in Web Admin Settings (`storage.backup_path`, default `\\GMS-NAS\SVN\Backups`).

Backups use **svnadmin hotcopy** (consistent for FSFS repositories) with a retention policy.

---

## Schedule

| Environment | Frequency | Retention |
|-------------|-----------|-----------|
| Production | Daily 02:00 | 30 daily, 12 weekly |
| Staging | Weekly | 4 copies |

Configure via Windows Task Scheduler on GMS SVN SERVER.

---

## Manual backup

```powershell
cd D:\GMS-SVN\infra\scripts
.\gms-svn-backup.ps1 `
  -RepoRoot "D:\SVN\Repositories" `
  -BackupRoot "\\GMS-NAS\SVN\Backups" `
  -RetentionDays 30
```

---

## Restore validation (required once per environment)

Execute before Phase 3 agent integration. Use the validation script to restore to an **isolated path** — never overwrite live repos.

```powershell
.\gms-svn-restore-validate.ps1 `
  -BackupPath "\\GMS-NAS\SVN\Backups\2026-06-16\my-repo" `
  -RestoreRoot "D:\SVN\RestoreTest" `
  -RepoName "my-repo"
```

### Validation checklist

- [ ] Restored repo opens in VisualSVN Manager (add as temporary repo path)
- [ ] `svn log` against restored path succeeds
- [ ] Latest revision matches backup manifest
- [ ] Delete restore test path after validation

Document results in [storage-iscsi-vs-smb.md](./storage-iscsi-vs-smb.md) test matrix.

---

## Failure handling

| Symptom | Action |
|---------|--------|
| Backup script fails mid-run | Check NAS connectivity and disk space; re-run for affected repos |
| Hotcopy lock error | Ensure no maintenance lock; retry off-peak |
| Restore revision mismatch | Use previous day's backup; escalate to ops |

---

## Phase 3 note

Automated backup triggers from GMS SVN SERVER Agent will use the same paths configured in Web Admin Settings. Keep scripts and agent config aligned.
