---
paths:
  - "apps/web/src/platform/**"
globs: apps/web/src/platform/**
description: "DCMS frontend platform/ conventions and component catalog"
---

# `apps/web/src/platform/` — conventions

- `client/` = logic (stores, queries, api, realtime, hooks, testing). `ui/` = components. Zero knowledge of DCMS contracts in either.
- **State:** data from the backend → `client/queries/` (TanStack Query). Purely local data → `client/stores/` (Zustand). Never cache server data in a store "for convenience."
- **Realtime:** `client/realtime/use-realtime-sync.ts` invalidates a `queryKey`, it does not update the UI directly. Event→queryKey mapping lives in `domain/<module>/realtime/`, not here.
- Never import from `domain/`.

## `ui/components/` catalog

| Component | Backend module | Role |
|---|---|---|
| `LoginForm` | `auth` | login/registration |
| `TenantSwitcher` | `tenants` | organization switcher |
| `PricingCard` | `billing` | plan display |
| `FeatureFlagGate` | `feature-flags`, `usage-metering` | conditional rendering of paid features |
| `ConsentBanner` | `consent` | consent to data processing |
| `LegalAcceptanceModal` | `consent`/`data-retention` | acceptance of legal content per jurisdiction |
| `InvitationForm` | `rbac`, `tenants` | inviting collaborators |
| `FileUploadWidget` | `file-storage` | upload with validation |
| `ImpersonationBanner` | `impersonation` | impersonation mode indicator |
| `ApiKeysManager` | `api-keys` | API key management (v2+) |
| `NotificationCenter` | `notifications` | system notifications |
| `AuditLogViewer` | `audit` | generic log viewer |

## `client/queries/` folders

`billing`, `sessions`, `api-keys`, `consent`, `legal-acceptance`, `file-storage`, `feature-flags`, `entitlements`, `invitations`, `in-app-notifications`, `data-export`, `audit` — each exports `useX`/`useXMutation`, typed from `shared/contracts/`, never duplicated locally.

Full description: `dcms-frontend-platform-dokumentacja.md`.
