---
paths:
  - "apps/api/src/domain/**"
globs: apps/api/src/domain/**
description: "DCMS backend domain/ conventions and module catalog"
---

# `apps/api/src/domain/` — conventions

- 9 modules, each owning one DCMS business area.
- Listens to platform and domain events, never imports another domain module's code directly.
- Event names/payloads: import from `apps/api/src/events.ts`.
- MVP v0 build order: `templates` → `contracts` → `negotiation-approval` → `esignature`.

## Module catalog

| Module | Does | Depends on (domain) | Key events |
|---|---|---|---|
| `contracts` | core CLM: create/edit/upload, versions, statuses | `templates` (optional) | `contract.created`, `contract.statusChanged` |
| `templates` | template library, clauses | — | `template.created`, `template.published` |
| `negotiation-approval` | roles, approve/reject/revise | `contracts` | `approval.granted`, `negotiation.revisionRequested` |
| `esignature` | DocuSign/Adobe Sign, eIDAS (v1.5) | `negotiation-approval` | `esignature.completed`, `esignature.expired` |
| `access-control` | domain-level RBAC, real-time collaboration | `contracts` | `access.granted`, `collaboration.commentAdded` |
| `compliance-reporting` | exportable audit reports (v1.5) | all of the above | `complianceReport.generated` |
| `analytics-insights` | dashboard, metrics | `contracts`, `esignature`, `negotiation-approval` | `analytics.metricUpdated` |
| `notifications-reminders` | reminder logic (when/what) | `contracts`, `esignature` | `reminder.scheduled` |
| `integrations` | CRM, Google Drive, MS365 | `contracts` | `integration.syncCompleted` |

Full payloads: `apps/api/src/domain/events.ts`. Full architecture (what each module does/doesn't do): `docs/dcms-domain-architecture.md`.
