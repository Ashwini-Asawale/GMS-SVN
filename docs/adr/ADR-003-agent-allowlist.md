# ADR-003: Server Agent Allowlist Pattern

**Status:** Accepted  
**Date:** 2026-06-16

## Context

The web backend must create repos and set VisualSVN access rules without executing arbitrary shell commands on the SVN server.

## Decision

All VisualSVN/SVN operations go through a **.NET Windows Service agent** with a **fixed command allowlist**:

- `CreateRepository`
- `SetAccessRule` / `RemoveAccessRule`
- `GetRepositoryStatus`
- `ListRepositories`
- `ExecuteBackup`
- `ListPath`, `GetLog`, `GetDiff` (Phase 4 — read-only browse)

Requests are **HMAC-signed**. Parameters validated (repo name regex, no path traversal).

## Rationale

- Prevents remote code execution if web API is compromised
- Matches VisualSVN PowerShell automation model
- Shared contracts in `packages/svn-contracts`

## Consequences

- No `exec`/`spawn` of `svn` or PowerShell from `apps/api` — code review gate
- New SVN operations require agent + contract updates
- Agent deployed as Windows Service on VisualSVN machine (Phase 3)
