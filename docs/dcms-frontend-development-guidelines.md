# DCMS — Frontend Development Guidelines (`apps/web`)

This document consolidates decisions from `dcms-struktura-frontend.md` and `dcms-monorepo-struktura.md` into one place worth checking while working on the frontend, and adds **working rules**: what goes where, when to use what, and what to watch for in code review — things those two documents (describing folder structure) didn't cover.

---

## 0. Repo context (from `dcms-monorepo-struktura.md`)

- **One repo, `dcms/`, two apps: `apps/api` and `apps/web`.** No `libs/` between them — there's nothing that would make sense as a separately versioned package. `platform/`/`domain/` inside each app are plain folders, not npm packages.
- **`shared/contracts/` at the root level** — the single source of truth for DTOs (zod) between `apps/api` and `apps/web`, imported via a relative path from both apps. It also contains `platform-events.ts` (constants + types for platform events, e.g. `auth.user.registered`), which the frontend uses directly instead of keeping its own event strings.
- **Root `package.json` with `workspaces: ["apps/*"]`** — one `npm install`, per-workspace scripts (`npm run dev -w apps/web`) or parallel ones.
- **`apps/api` and `apps/web` are still two independent runtimes** — separate `package.json`, separate deploy, separate `Dockerfile`, separate environments. One repo doesn't mean one pipeline; CI uses path-based triggers (`apps/web/**` only triggers the frontend pipeline), and `shared/contracts/**` triggers both.
- **The ESLint boundaries rule applies at the whole-repo level, in a single config file**, but separately for each app — `apps/web/src/domain` cannot import from `apps/api` and vice versa:
```javascript
rules: [
  { from: 'apps/web/src/domain', allow: ['apps/web/src/platform', 'shared', 'apps/web/src/domain'] },
  { from: 'apps/web/src/platform', allow: ['shared', 'apps/web/src/platform'] },
]
```

## 0b. Frontend structure (from `dcms-struktura-frontend.md`)

```
dcms/apps/web/
├── src/
│   ├── app/                             # the only place with config specific to this app
│   │   ├── providers.tsx                # createAuthStore, createTenantStore, createQueryClient
│   │   ├── router.tsx
│   │   ├── layout.tsx
│   │   └── theme.css                    # CSS variable overrides (branding)
│   │
│   ├── platform/                        # cross-cutting frontend, zero knowledge of "contracts"
│   │   ├── client/
│   │   │   ├── stores/                  # Zustand — client state only
│   │   │   │   ├── auth/
│   │   │   │   └── tenant/
│   │   │   │
│   │   │   ├── queries/                 # TanStack Query — server state
│   │   │   │   ├── billing/
│   │   │   │   ├── sessions/
│   │   │   │   ├── api-keys/
│   │   │   │   ├── consent/
│   │   │   │   ├── legal-acceptance/
│   │   │   │   ├── file-storage/
│   │   │   │   ├── feature-flags/
│   │   │   │   ├── entitlements/
│   │   │   │   ├── invitations/
│   │   │   │   ├── in-app-notifications/
│   │   │   │   ├── data-export/
│   │   │   │   └── audit/
│   │   │   │
│   │   │   ├── query-client/
│   │   │   │   ├── create-query-client.ts
│   │   │   │   └── query-keys.ts
│   │   │   │
│   │   │   ├── api/
│   │   │   │   ├── create-api-client.ts
│   │   │   │   └── interceptors/
│   │   │   │       └── auth-refresh.interceptor.ts
│   │   │   │
│   │   │   ├── realtime/                # WS/SSE client, consumes platform/realtime from the backend
│   │   │   │   └── use-realtime-sync.ts # e.g. live contract-edit status, signature notifications
│   │   │   │
│   │   │   ├── adapters/
│   │   │   │   └── storage.types.ts
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── use-current-user.ts
│   │   │   │   ├── use-tenant-context.ts
│   │   │   │   └── use-feature-flag.ts
│   │   │   │
│   │   │   └── testing/
│   │   │       ├── mock-auth-store.ts
│   │   │       ├── mock-query-client.ts
│   │   │       └── render-with-providers.tsx
│   │   │
│   │   └── ui/
│   │       ├── components/
│   │       │   ├── LoginForm/
│   │       │   ├── TenantSwitcher/
│   │       │   ├── PricingCard/
│   │       │   ├── FeatureFlagGate/
│   │       │   ├── ConsentBanner/
│   │       │   ├── LegalAcceptanceModal/
│   │       │   ├── InvitationForm/
│   │       │   ├── FileUploadWidget/       # e.g. uploading a scan of an existing contract
│   │       │   ├── ImpersonationBanner/
│   │       │   ├── ApiKeysManager/
│   │       │   ├── NotificationCenter/     # in-app-notifications UI
│   │       │   └── AuditLogViewer/         # generic viewer for platform logs (audit)
│   │       └── tokens/
│   │           └── design-tokens.css       # CSS variables, overridden in app/theme.css
│   │
│   ├── domain/                          # UI specific to DCMS
│   │   ├── contracts/                   # CLM core: create/edit/upload, statuses, versions
│   │   │   ├── ContractListPage.tsx
│   │   │   ├── ContractEditorPage.tsx
│   │   │   └── VersionHistoryPanel.tsx
│   │   │
│   │   ├── templates/                   # template library, clauses
│   │   │   ├── TemplateLibraryPage.tsx
│   │   │   └── ClauseEditor.tsx
│   │   │
│   │   ├── negotiation-approval/        # roles, approve/reject/revise
│   │   │   ├── ApprovalWorkflowPage.tsx
│   │   │   └── RoleAssignmentPanel.tsx
│   │   │
│   │   ├── esignature/                  # DocuSign/Adobe Sign, eIDAS
│   │   │   ├── SignatureRequestPage.tsx
│   │   │   └── SignatureStatusTracker.tsx
│   │   │
│   │   ├── access-control/              # domain-level RBAC, real-time collaboration
│   │   │   ├── CollaboratorsPanel.tsx
│   │   │   └── ShareContractModal.tsx
│   │   │
│   │   ├── compliance-reporting/        # audit reports (built on top of platform/audit)
│   │   │   └── ComplianceReportPage.tsx
│   │   │
│   │   ├── analytics-insights/          # status dashboard, business analytics
│   │   │   └── DashboardPage.tsx
│   │   │
│   │   ├── notifications-reminders/     # reminder logic (when/what), not the notification UI
│   │   │   └── ReminderSettingsPage.tsx
│   │   │
│   │   └── integrations/                # CRM (Salesforce, HubSpot), Google Drive, MS365
│   │       └── IntegrationsSettingsPage.tsx
│   │
│   └── shared/                          # NOTE: outdated after the monorepo merge, see section 0
│       └── contracts/                   # replaced by /dcms/shared/contracts/ at the root level
│           ├── contract.schema.ts
│           ├── esignature.schema.ts
│           └── billing.schema.ts
│
├── tailwind.config.js                   # content: ['./src/**/*.{ts,tsx}'] — covers platform/ui automatically
├── tsconfig.json                        # extends ../../tsconfig.base.json (root monorepo), no @platform/* aliases
└── package.json                         # react, zustand, @tanstack/react-query, zod — regular dependencies
```

Rationale for each domain module (what it listens to, what it emits) — see `dcms-struktura-frontend.md` and its backend counterpart `dcms-domain-architecture.md`.

---

## Working rules

## 1. The `platform/` vs `domain/` criterion

The control question for any new code: **could another app in this repo (or a future product) use this unchanged, without knowing anything about the contracts?**

- **Yes → `platform/`.** Example: `FileUploadWidget` knows nothing about a file being a contract scan — it takes `accept`, `maxSize`, `onUpload`. `NotificationCenter` knows nothing about a notification concerning an expiring contract — it renders a list of `{ title, body, read }` objects.
- **No → `domain/`.** Example: `ContractEditorPage` renders fields specific to a contract's structure, `SignatureStatusTracker` knows `esignature.*` states.

A warning sign in review: an import from `domain/` inside a `platform/` file — this is always an error (see the ESLint rule in section 4). If adding such an import is tempting, it's a sign that the platform component is trying to know too much — it needs to be parameterized (props/render props) instead of hardcoding domain knowledge.

**Where new TanStack queries go:** if the endpoint is generic (billing, sessions, feature-flags, audit) → `platform/client/queries/`. If the endpoint returns DCMS-specific data (contract list, signature status) → the hook lives **inside** the corresponding folder in `domain/` (e.g. `domain/contracts/queries/use-contract-list.ts`), not in `platform/`.

---

## 2. State: `stores/` (Zustand) vs `queries/` (TanStack Query)

A rule with no exceptions: **if the data comes from the backend and can go stale — TanStack Query. If the data only exists in the browser and nothing invalidates it from the server — Zustand.**

- Zustand: the currently selected tenant in `TenantSwitcher`, whether a modal is open, an unsaved-changes draft in the clause editor before submission, view settings (e.g. a contract list filter).
- TanStack Query: the contract list, signature status, billing data, feature flags, the `usage-metering` result.

Common mistake: keeping a copy of server data in Zustand "for convenience" (e.g. dropping a contract into a store after a fetch). Don't do this — it leads to two sources of truth and drift after an edit in another window/tab. If a component needs query data in multiple places, use `queryClient.getQueryData` / `useQuery` with the same `queryKey`, don't copy it into a store.

**Where a domain store physically lives:** `platform/client/stores/` is centralized because `auth`/`tenant` are genuinely global state, used throughout the app — that justifies a separate, shared folder. In `domain/` there is no equivalent `domain/stores/` on the same principle, because domain state is by definition **not** cross-cutting — it lives where it's used:
- State shared between several components within a single module (e.g. a clause draft shared by `ClauseEditor` and a live preview next to it) → `domain/<module>/store.ts`, a single file, not a `stores/` folder.
- State local to a single component (a modal being open, filter state in one list) → a plain `useState`/`useReducer` directly in the component, with no store file at all.

## 2b. Does `domain/<module>/` need its own `client/` folder?

No — this is a deliberate asymmetry relative to `platform/`, not an oversight. The `platform/client/` vs `platform/ui/` split exists because `ui/` is meant to be usable without knowledge of `client/` (another product/app could take just `PricingCard` and wire up its own query — see the criterion in section 1). In `domain/` that separation has no justification: a page (`ContractEditorPage.tsx`) and the hook that feeds it (`use-contract.ts`) are permanently coupled — nothing will ever use one without the other outside of DCMS. Wrapping this in `client/` would add a level of nesting with no benefit.

Instead, a domain module stays flat, and subfolders appear only once there's more than one file of a given kind — not upfront, just in case:

```
domain/templates/
├── TemplateLibraryPage.tsx
├── ClauseEditor.tsx
├── store.ts                # only if there is shared state within the module (section 2)
├── queries/                 # only if there is more than one query hook
│   ├── use-template-list.ts
│   └── use-clause-library.ts
└── realtime/                 # only if the module listens to realtime events (section 3)
    └── template-events.ts
```

For a small module (one page, one hook) that's just two files side by side, no subfolders — don't assume structure ahead of need.

---

## 3. Realtime (`platform/client/realtime/use-realtime-sync.ts`)

Realtime events (e.g. `contract.statusChanged`, `esignature.completed`) don't update the UI directly — **they invalidate the corresponding `queryKey` in TanStack Query**, and the UI refreshes via a normal refetch. Don't write a separate "live" rendering path that bypasses the query cache — this leads to two independent sources of state (the query cache vs. data from the WS), which can drift apart under race conditions (e.g. a realtime event arriving before the REST response after a user action).

The event → `queryKey` invalidation mapping is kept in `domain/<module>/realtime/` (not in `platform/`) — because that's DCMS-specific knowledge, e.g. "after `esignature.completed`, invalidate `['contracts', contractId]` and `['dashboard', 'pending-signatures']`."

---

## 4. Import boundaries (ESLint boundaries)

```javascript
rules: [
  { from: 'domain', allow: ['platform', 'shared', 'domain'] },
  { from: 'platform', allow: ['shared', 'platform'] },
]
```

Enforced automatically in CI, but watch during review for the case ESLint won't catch: **an import within `domain/` from another domain module** (e.g. `domain/esignature` directly importing a component from `domain/contracts`). The boundaries rule allows this (`domain → domain` is permitted), but it violates the split from the backend, where domain modules communicate via events, not direct calls. If `esignature` needs something from `contracts`, it should go through a query (`useContract(contractId)`) or through props passed down from the page/router level, not through importing another module's internal component.

---

## 5. Contracts (`shared/contracts/`, monorepo root level)

`shared/contracts/*.schema.ts` (zod) is the single source of truth for the DTO shape between `apps/api` and `apps/web`. Rules:

- **Don't manually duplicate a type in `domain/`.** If a hook in `domain/contracts/queries/use-contract.ts` needs the `Contract` type, it imports it from `shared/contracts/contract.schema.ts` (`z.infer<typeof ContractSchema>`), it doesn't define its own interface.
- **A field change in a DTO = a change in `shared/contracts/`, not in two places.** This is the whole point of having one repo — if while working on a feature you're editing a type only on the `apps/web` side, that's a sign someone forgot to update the backend (or you're editing the wrong place).
- The platform event contract (`auth.user.registered`, etc.) **does not live in `shared/contracts/`** — it's part of `src/platform` on the backend side; the frontend only knows event names indirectly, through what `use-realtime-sync.ts` listens for (see section 3), it doesn't import them directly.

---

## 6. Feature flags and plan tier

Every piece of UI corresponding to a paid add-on (see `dcms-domain-architecture.md`, the "Monetization model" section — advanced analytics, exportable compliance reports) must be wrapped in `<FeatureFlagGate>` from `platform/ui/components/`, **not** an `if` condition scattered across the domain component. `FeatureFlagGate` reads from `platform/client/queries/feature-flags` and `platform/client/queries/entitlements` — a single source of truth for what's available for a given tenant/plan. This way, changing a plan threshold (e.g. moving a feature from "Professional" to "Enterprise") is a config change on the `entitlements` side, not a frontend redeploy with new conditions in the code.

---

## 7. Tests

Every new hook in `domain/*/queries/` and every component in `domain/*/` rendered in a test uses `platform/client/testing/render-with-providers.tsx` (wraps in a `QueryClientProvider` from `mock-query-client.ts` and stores from `mock-auth-store.ts`), not a bare `render()` from testing-library. This ensures consistent default tenant/auth values across all tests and avoids copying provider boilerplate into every test file.

Minimum test scope for a new domain module:
- Query hook: `loading` → `success`/`error` state with a mocked API response.
- Page component: renders with mock data, shows the appropriate `FeatureFlagGate` where relevant.
- Realtime: invalidation of the correct `queryKey` after receiving a mocked event (if the module listens to realtime).

---

## 8. Styling and branding

- New design tokens (color, spacing, typography) go into `platform/ui/tokens/design-tokens.css` as CSS variables — components in `domain/` don't define their own hex/px values, they only reference tokens (`var(--color-primary)`).
- Per-tenant overrides (white-label branding, a v2+ differentiator) go exclusively into `app/theme.css`, never into `platform/ui/tokens/` — the base tokens must remain a stable fallback independent of a customer's branding.

---

## 9. Checklist for adding a new domain piece

1. Is the new component/hook genuinely DCMS-specific? If not — it goes into `platform/`, not `domain/` (section 1).
2. Does the data type already exist in `shared/contracts/`? If not, add it there before defining it locally (section 5).
3. Is the data server-side (query) or purely local (store)? (section 2)
4. Is the feature a paid add-on per `dcms-domain-architecture.md`? If so — wrap it in `FeatureFlagGate` (section 6).
5. Does the module listen to realtime? If so — the event→queryKey mapping goes in `domain/<module>/realtime/`, not in `platform/` (section 3).
6. Did you add a test using `render-with-providers`? (section 7)
