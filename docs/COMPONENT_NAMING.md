# Component Naming

Official product component names for the GMS SVN Platform:

| Name | Description | Phase |
|------|-------------|-------|
| **GMS SVN SERVER** | Windows Server — VisualSVN, repository storage, server agent | 2–3 |
| **GMS SVN CLIENT** | Windows desktop app on user PC — SVN operations | 5–6 |
| **GMS SVN Web Admin** | Browser admin UI + API (Docker) — users, groups, permissions | 1–4 |
| **GMS SVN SERVER Agent** | Windows service on GMS SVN SERVER — VisualSVN automation | 3 |

Code reference: `packages/shared/src/branding.ts` → `PRODUCT_NAMES`
