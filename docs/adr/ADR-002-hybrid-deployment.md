# ADR-002: Hybrid On-Prem Deployment

**Status:** Accepted  
**Date:** 2026-06-16

## Context

GMS SVN combines a web admin, VisualSVN Server, Windows client, and network storage.

## Decision

**Hybrid deployment:**

| Component | Runs on |
|-----------|---------|
| Web stack (React + Fastify + PostgreSQL + Redis) | Docker on-prem Linux/Windows host |
| VisualSVN Server + GMS Server Agent | Dedicated Windows Server |
| SVN repository data | iSCSI block volume (preferred) or NAS SMB share |
| Backups, reports, logs | NAS SMB shares |

## Rationale

- VisualSVN requires Windows
- Web stack benefits from Docker portability and easier updates
- Separating repo storage (iSCSI/NAS) from server allows server replacement without moving SVN data

## Consequences

- Firewall rules required between Docker host and Windows SVN server
- Phase 2 must validate storage before Phase 3 agent integration
