# Phase 6 — File Explorer Integration

**Previous:** [Phase 5 — Electron Client](./Phase_05_Electron_Client.md)  
**Next:** [Phase 7 — Reports, Audit & Search](./Phase_07_Reports_Audit_Search.md)  
**Duration:** 3–4 weeks  
**Spec reference:** Right-click SVN operations from Windows File Explorer

---

## Goal

Right-click SVN actions in Windows Explorer without opening the full Electron window for common tasks.

---

## Deliverables

### Shell Extension (`apps/shell-extension`)

- Native Shell Extension or registry-based context menu (thin layer — GUI separate from shell logic)
- Menu items (context-aware for working copy folders/files):
  - SVN Update, Commit, Diff, Revert, Log, Lock, Unlock
  - "Open in GMS SVN CLIENT" for advanced actions
- Invokes **GMS SVN CLIENT** CLI bridge or lightweight helper exe with IPC
- Icon overlays optional (Phase 6b — defer if complex)

### Electron CLI Bridge

- `GMS SVN CLIENT.exe --action update --path "C:\..."` headless mode for shell invocations
- Reads credentials from Credential Manager

### Installer

- Combined installer: Electron app + shell extension registration + uninstall cleanup

---

## Acceptance Criteria

- [ ] Right-click on working copy folder shows SVN menu items
- [ ] Update/Commit from Explorer completes and writes audit entry
- [ ] Shell extension works on Windows 10/11; survives app update
- [ ] No separate TortoiseSVN required for covered operations
- [ ] Uninstall removes shell extension cleanly

---

## Dependencies

- [Phase 5](./Phase_05_Electron_Client.md) Electron client and svn operation layer
- Code signing certificate recommended for shell extension trust

---

## Risks / Mitigations

| Risk | Mitigation |
|------|------------|
| Explorer integration complexity | Thin shell; Electron owns all SVN logic |
| Shell extension trust | Code signing certificate |

---

## Team Focus

| Role | Focus |
|------|-------|
| Windows/C# dev | Shell extension, registry context menu |
| Electron dev | CLI bridge, combined installer |
| QA | Windows 10/11 compatibility, upgrade survival tests |

---

## MVP Milestone

**End of Phase 6 = Core product MVP launch** (web + client + Explorer)
