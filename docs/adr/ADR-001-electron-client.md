# ADR-001: Electron Windows Client

**Status:** Accepted  
**Date:** 2026-06-16

## Context

GMS SVN needs a Windows desktop client for SVN Checkout, Update, Commit, Diff, and Log. Options: .NET WPF, Tauri, Electron.

## Decision

Use **Electron + React** for the Windows client.

## Rationale

- Reuse React components and patterns from the web admin (`apps/web`)
- Faster delivery for Phase 5
- Shell extension (Phase 6) invokes Electron CLI bridge for Explorer menu actions

## Consequences

- Larger install size than native WPF
- Native shell extension remains separate (C#) — thin layer only
- `svn.exe` subprocess handles all SVN operations; Electron does not embed SVN libraries
