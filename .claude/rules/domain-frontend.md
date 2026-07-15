---
paths:
  - "apps/web/src/domain/**"
globs: apps/web/src/domain/**
description: "DCMS frontend domain/ conventions and module catalog"
---

# `apps/web/src/domain/` — conventions

- Modules stay flat. Subfolders (`queries/`, `realtime/`, `store.ts`) only when there's more than one file of that kind.
- No `client/`-style folder mirroring `platform/client/` — a page and its hook are permanently coupled, so splitting them apart doesn't buy anything here.
- **No direct imports of a component from another domain module** (e.g. `esignature` importing `ContractSummaryCard` from `contracts`) — even though ESLint allows it. Use a query keyed by an ID passed via props/router instead.
- Types come from `shared/contracts/*.schema.ts`, never a local duplicate DTO.
- Paid features (advanced analytics, report export) → wrapped in `<FeatureFlagGate>`, not a local `if`.
- Realtime: `domain/<module>/realtime/` maps an event from `apps/api/src/domain/events.ts` to the `queryKey` to invalidate.

## Module catalog

| Module | Pages/components | Backend |
|---|---|---|
| `contracts` | `ContractListPage`, `ContractEditorPage`, `VersionHistoryPanel` | `domain/contracts` |
| `templates` | `TemplateLibraryPage`, `ClauseEditor` | `domain/templates` |
| `negotiation-approval` | `ApprovalWorkflowPage`, `RoleAssignmentPanel` | `domain/negotiation-approval` |
| `esignature` | `SignatureRequestPage`, `SignatureStatusTracker` | `domain/esignature` |
| `access-control` | `CollaboratorsPanel`, `ShareContractModal` | `domain/access-control` |
| `compliance-reporting` | `ComplianceReportPage` | `domain/compliance-reporting` |
| `analytics-insights` | `DashboardPage` | `domain/analytics-insights` |
| `notifications-reminders` | `ReminderSettingsPage` | `domain/notifications-reminders` |
| `integrations` | `IntegrationsSettingsPage` | `domain/integrations` |

## New-feature checklist

1. Actually DCMS-specific? If not → `platform/`.
2. Type already in `shared/contracts/`? Add it there first if missing.
3. Server data (query) or local (store/`useState`)?
4. Paid add-on? → `FeatureFlagGate`.
5. Realtime? → mapping in `domain/<module>/realtime/`.
6. Test via `platform/client/testing/render-with-providers`.

Full description: `dcms-frontend-domain-dokumentacja.md`.
