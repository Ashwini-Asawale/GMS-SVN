# VisualSVN Install and Hardening Checklist

**Component:** GMS SVN SERVER  
**Phase:** 2  
**Audience:** Infra / DevOps

Use this checklist when provisioning the dedicated Windows Server that hosts VisualSVN.

---

## Prerequisites

- [ ] Windows Server 2019 or later (Standard or Datacenter)
- [ ] Static IP or stable DNS record (e.g. `gms-svn-server.local`)
- [ ] iSCSI volume mounted as local disk **or** validated SMB share (see [storage-iscsi-vs-smb.md](./storage-iscsi-vs-smb.md))
- [ ] Firewall rules documented for SVN (443/8443) and agent port (Phase 3)
- [ ] VisualSVN Server license purchased

---

## Install VisualSVN Server

1. Download VisualSVN Server from [visualsvn.com](https://www.visualsvn.com/server/download/)
2. Run installer as Administrator
3. Choose **VisualSVN Server** (not client-only)
4. Set **Repositories root** to the iSCSI mount path, e.g. `D:\SVN\Repositories`
5. Enable **HTTPS** with a valid internal CA or enterprise certificate
6. Complete installation and open **VisualSVN Server Manager**

---

## Repository layout standard

For each new repository, create standard layout:

```
/trunk
/branches
/tags
```

Option: use VisualSVN **Repository Template** so new repos inherit `/trunk`, `/branches`, `/tags`.

---

## Hardening checklist

| Item | Action |
|------|--------|
| Service account | Run VisualSVN under dedicated AD/local service account with least privilege on repo root |
| TLS | Disable weak ciphers; use TLS 1.2+ only |
| Authentication | Integrate with Windows/AD auth or VisualSVN internal users per policy |
| Admin access | Restrict VisualSVN Manager to admin group only |
| Auditing | Enable Windows audit policy for object access on repo root |
| Backups | Schedule [gms-svn-backup.ps1](../../infra/scripts/gms-svn-backup.ps1) to NAS backup path |
| Updates | Patch Windows and VisualSVN on maintenance window |

---

## Validation (before Phase 3)

- [ ] Create one test repository manually in VisualSVN Manager
- [ ] SVN checkout and commit from a test client succeed
- [ ] Backup script completes to `\\GMS-NAS\SVN\Backups`
- [ ] Restore validation executed once (see [backup-restore.md](./backup-restore.md))
- [ ] Storage paths saved in **GMS SVN Web Admin → Settings**
- [ ] Connection test run from Web Admin (NAS paths reachable from Docker host)

---

## Configure Web Admin

In **Settings**, set:

| Field | Example |
|-------|---------|
| Server hostname | `gms-svn-server.local` |
| VisualSVN URL | `https://gms-svn-server.local/svn` |
| Repository root | `D:\SVN\Repositories` |
| Storage backend | `iscsi` (recommended) |
| Backup / Reports / Attachments / Logs paths | `\\GMS-NAS\SVN\...` |

Run **Test connection** and resolve any failed NAS path checks before proceeding to Phase 3.
