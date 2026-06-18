# Storage Decision Record — iSCSI vs SMB

**Component:** GMS SVN SERVER  
**Phase:** 2  
**Status:** Template — complete after infrastructure validation  
**Related:** [ADR-002](../adr/ADR-002-hybrid-deployment.md), [ADR-004](../adr/ADR-004-repo-storage-topology.md)

---

## Decision

| Storage role | Selected option | Path |
|--------------|-----------------|------|
| SVN repository data | ☐ iSCSI ☐ SMB | |
| Backups | SMB (NAS) | `\\GMS-NAS\SVN\Backups` |
| Reports | SMB (NAS) | `\\GMS-NAS\SVN\Reports` |
| Attachments | SMB (NAS) | `\\GMS-NAS\SVN\Attachments` |
| Logs export | SMB (NAS) | `\\GMS-NAS\SVN\Logs` |

**Production recommendation:** iSCSI block volume for repository data. SMB only after VisualSVN network-share validation and written sign-off.

---

## Test matrix (fill in during Phase 2 validation)

| Test | iSCSI result | SMB result | Notes |
|------|--------------|------------|-------|
| VisualSVN repo create | | | |
| Concurrent commit (3 clients) | | | |
| Lock latency under load | | | |
| Backup duration (10 GB sample) | | | |
| Restore to isolated path | | | |

---

## SMB-specific requirements

If SMB is used for repository data:

1. Follow [VisualSVN network share guidance](https://www.visualsvn.com/support/topic/00022/)
2. Use SMB 3.x with continuous availability if supported by NAS
3. Document NAS locking behavior under concurrent writes
4. Obtain ops sign-off before production cutover

---

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Infra / DevOps | | | ☐ |
| Backend lead | | | ☐ |
| Ops | | | ☐ |
