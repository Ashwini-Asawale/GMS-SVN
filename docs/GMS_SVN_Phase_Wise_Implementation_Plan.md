# GMS SVN Platform — Phase-Wise Implementation Plan

**Document type:** Planning only (no implementation)  
**Source:** [GMS_SVN_Platform_Detailed_Project_Document.docx](../GMS_SVN_Platform_Detailed_Project_Document.docx)  
**Approach:** **Simple SVN-like** (VisualSVN model — users, groups, path permissions)

---

## Overview

Master index. Each phase has a separate plan in [`docs/phases/`](./phases/README.md).

**GMS SVN Platform = GMS SVN Web Admin + GMS SVN SERVER + GMS SVN CLIENT + Storage**

| Component | Name |
|-----------|------|
| Server | **GMS SVN SERVER** |
| Client | **GMS SVN CLIENT** |
| Web admin | **GMS SVN Web Admin** |

---

## Phase Plans

| Phase | Document | Duration |
|-------|----------|----------|
| 0 — Foundation | [Phase_00_Foundation.md](./phases/Phase_00_Foundation.md) | 1–2 weeks |
| 1 — Users & Groups | [Phase_01_Core_Web_Platform.md](./phases/Phase_01_Core_Web_Platform.md) | 2–3 weeks |
| 2 — VisualSVN & Storage | [Phase_02_VisualSVN_Storage.md](./phases/Phase_02_VisualSVN_Storage.md) | 2–3 weeks |
| 3 — Server Agent | [Phase_03_Server_Agent.md](./phases/Phase_03_Server_Agent.md) | 3–4 weeks |
| 4 — Repos & Permissions | [Phase_04_Repository_Web_UI.md](./phases/Phase_04_Repository_Web_UI.md) | 3–4 weeks |
| 5 — Electron Client | [Phase_05_Electron_Client.md](./phases/Phase_05_Electron_Client.md) | 4–5 weeks |
| 6 — Explorer Menu | [Phase_06_Explorer_Integration.md](./phases/Phase_06_Explorer_Integration.md) | 2–3 weeks |
| 7 — Audit & Reports | [Phase_07_Reports_Audit_Search.md](./phases/Phase_07_Reports_Audit_Search.md) | 2–3 weeks (optional) |
| 8 — Collaboration | [Phase_08_Collaboration.md](./phases/Phase_08_Collaboration.md) | **Deferred** |
| 9 — Build Automation | [Phase_09_Build_Automation.md](./phases/Phase_09_Build_Automation.md) | **Optional** |

---

## Simple Data Model

```
User          (isAdmin for web console)
Group
GroupMember   (User ↔ Group)
Repository
RepoAccessRule (path + user/group + read/write/none)  ← Phase 4
```

No `Tenant`, `Role`, `UserRole`, `Department`.

---

## Scope

**In scope:** Users, groups, repos, path permissions, web browse/log/diff, Electron client, Explorer menu.

**Out of scope:** Git, multi-tenant, approval workflows, issues, wiki, Kanban, Gitea-like features.

**MVP:** Phases 0–6 (~6 months)

**Full index:** [phases/README.md](./phases/README.md)
