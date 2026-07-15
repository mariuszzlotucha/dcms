# DCMS — `domain` Frontend Documentation (`apps/web/src/domain/`)

Reference document: how each domain module is built in the UI, which patterns to use when adding a new feature. No timeline — the build order is in `dcms-frontend-development-plan.md`. The backend counterpart (what a module does from a business perspective, what events it emits) is in `dcms-domain-architecture.md`.

---

## 1. Module structure — the pattern

A domain module stays **flat**; subfolders appear only once there's more than one file of a given kind:

```
domain/templates/
├── TemplateLibraryPage.tsx
├── ClauseEditor.tsx
├── store.ts                # ONLY if there is shared state within the module
├── queries/                 # ONLY if there is more than one query hook
│   ├── use-template-list.ts
│   └── use-clause-library.ts
└── realtime/                 # ONLY if the module listens to realtime events
    └── template-events.ts
```

**No `client/` folder** mirroring `platform/client/` — a page and the hook that feeds it are permanently coupled, so separating logic from the component (as in `platform/`) has no justification here.

**State (`store.ts`):** state shared between several components within a module → `store.ts`, a single file, not a folder. State local to a single component → a plain `useState`/`useReducer` directly in the component.

---

## 2. Nine modules — what each one contains

| Module | Pages/components | Backend counterpart |
|---|---|---|
| `contracts` | `ContractListPage`, `ContractEditorPage`, `VersionHistoryPanel` | `domain/contracts` — CLM, create/edit/upload, versions |
| `templates` | `TemplateLibraryPage`, `ClauseEditor` | `domain/templates` |
| `negotiation-approval` | `ApprovalWorkflowPage`, `RoleAssignmentPanel` | `domain/negotiation-approval` |
| `esignature` | `SignatureRequestPage`, `SignatureStatusTracker` | `domain/esignature` |
| `access-control` | `CollaboratorsPanel`, `ShareContractModal` | `domain/access-control` |
| `compliance-reporting` | `ComplianceReportPage` | `domain/compliance-reporting` |
| `analytics-insights` | `DashboardPage` | `domain/analytics-insights` |
| `notifications-reminders` | `ReminderSettingsPage` | `domain/notifications-reminders` |
| `integrations` | `IntegrationsSettingsPage` | `domain/integrations` |

---

## 3. Import boundaries between domain modules

ESLint boundaries allows `domain → domain` (since it's the same element type), but **that does not mean it's fine to directly import a component from another module**. If `esignature` needs something from `contracts` (e.g. data about the contract a signature concerns):

- **Good:** `useContract(contractId)` — a query keyed by a `contractId` passed via props/router, independent of the fact that the data "belongs" to the `contracts` module.
- **Bad:** `import { ContractSummaryCard } from '../contracts/ContractSummaryCard'` — a direct import of another module's internal component.

This is not enforced automatically (ESLint won't catch it) — watch for it in code review.

---

## 4. Data: contracts from `shared/`, not local types

Every query hook in `domain/<module>/queries/` imports its type from `shared/contracts/*.schema.ts` (`z.infer<typeof ContractSchema>`), never defining its own interface that duplicates a DTO. A field change in a DTO is a change in one place (`shared/`), visible immediately in `domain/` via the type checker.

---

## 5. Realtime — the per-module pattern

`domain/<module>/realtime/` contains the mapping: which event from `apps/api/src/domain/events.ts` (see `dcms-domain-architecture.md` section 6) invalidates which `queryKey`. Example for `esignature`:

```typescript
// domain/esignature/realtime/esignature-events.ts
import { EVENTS } from '../../../../../shared-events-import-path'; // ultimately from the backend registry, see the note below

export const ESIGNATURE_REALTIME_MAP = {
  [EVENTS.ESIGNATURE_COMPLETED]: (payload: { contractId: string }) => [
    ['contracts', payload.contractId],
    ['dashboard', 'pending-signatures'],
  ],
  [EVENTS.ESIGNATURE_EXPIRED]: (payload: { contractId: string }) => [
    ['contracts', payload.contractId],
  ],
};
```

`platform/client/realtime/use-realtime-sync.ts` (the generic transport, see `dcms-frontend-platform-documentation.md` section 4) reads a map like this and calls `queryClient.invalidateQueries(...)` — the domain module only supplies the "what triggers what" knowledge, not the WS/SSE mechanics.

**Open question, still to be resolved:** the event registry (`apps/api/src/events.ts`) is currently defined on the backend side of the monorepo. The frontend needs its own copy of / import path for the event names (not the backend payload types, just the strings) — to be decided: whether `apps/web` imports directly from `apps/api/src/events.ts` (possible within a single repo, but blurs the boundary between apps), or keeps a separate, manually synced registry of names on the frontend side. Not resolved in this conversation — worth settling before realtime actually lands in Phase 3 of the frontend plan.

---

## 6. Paid features — `FeatureFlagGate`

Every piece of UI corresponding to an add-on from the monetization model (`dcms-domain-architecture.md`: advanced analytics in `analytics-insights`, exportable reports in `compliance-reporting`) is wrapped in `<FeatureFlagGate>` from `platform/ui/components/`, not a local condition in the domain component.

---

## 7. Checklist — adding a new piece to a domain module

1. Is it genuinely DCMS-specific? If not — it belongs in `platform/`, not here (see `dcms-frontend-platform-documentation.md` section 1).
2. Does the data type already exist in `shared/contracts/`? If not, add it there first (section 4).
3. Server data (query) or local (store/`useState`)? (section 1, rule from `dcms-frontend-platform-documentation.md` section 2)
4. Is it a paid add-on per the monetization model? If so — `FeatureFlagGate` (section 6).
5. Does the module listen to realtime? Event → `queryKey` mapping in `domain/<module>/realtime/`, not in `platform/` (section 5).
6. Test using `render-with-providers` from `platform/client/testing/`.
7. Are you touching more than one domain module? Check that you're not directly importing another module's internal component (section 3) — if so, go through a query/props instead of an import.
