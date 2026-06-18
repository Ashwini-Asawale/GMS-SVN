# ADR-004: Repository Storage Topology

**Status:** Accepted  
**Date:** 2026-06-16  
**Phase:** 2

## Context

GMS SVN SERVER stores Subversion repository data on network-attached storage. VisualSVN supports local disks and SMB shares; production reliability depends on choosing the correct topology before Phase 3 automation.

## Decision

1. **Repository data (FSFS):** iSCSI block volume mounted as a local drive on GMS SVN SERVER (e.g. `D:\SVN\Repositories`).
2. **Operational data:** NAS SMB shares for backups, reports, attachments, and log exports.
3. **SMB for repo data:** Allowed only after VisualSVN validation and documented sign-off in `docs/runbooks/storage-iscsi-vs-smb.md`.
4. **Configuration source of truth:** Web Admin Settings API (`PlatformStorageSettings`), seeded with defaults from `packages/shared/src/storage-settings.ts`.

## Rationale

- iSCSI presents block storage as a local disk, avoiding SMB locking issues during concurrent SVN commits.
- Separating repo data from backup/report paths simplifies retention and access control.
- Persisting paths in the database allows Web Admin and Phase 3 agent to share configuration.

## Consequences

- Infra must provision iSCSI and NAS shares before Phase 2 acceptance.
- Web Admin connection test validates NAS paths from the Docker host; repo-root checks on GMS SVN SERVER defer to Phase 3 agent.
- Backup scripts reference the same paths as platform settings.
