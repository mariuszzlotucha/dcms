# DCMS — `platform` Frontend Documentation (`apps/web/src/platform/`)

Reference document: what lives in `platform/`, how it's built, which patterns to use when adding something new. No timeline — the build order is in `dcms-frontend-development-plan.md`.

---

## 1. Structure and boundaries

```
apps/web/src/platform/
├── client/
│   ├── stores/          # Zustand — client state ONLY
│   ├── queries/          # TanStack Query — server state ONLY
│   ├── query-client/      # configuration and query keys
│   ├── api/               # HTTP client + interceptors
│   ├── realtime/           # WS/SSE client, event → query invalidation mapping
│   ├── adapters/            # types/interfaces for external integrations (storage etc.)
│   ├── hooks/                 # a thin layer over stores/queries, the entry point for domain/
│   └── testing/                # provider mocks for tests
└── ui/
    ├── components/              # generic React components, zero knowledge of DCMS
    └── tokens/                   # design tokens (CSS variables)
```

**Zero knowledge of DCMS contracts.** The criterion from `dcms-frontend-development-guidelines.md`: *could another app in this repo (or a future product) use this unchanged, without knowing anything about the contracts?* If yes → it belongs here. `FileUploadWidget` doesn't know a file is a contract scan; `NotificationCenter` doesn't know a notification concerns an expiring agreement.

**The boundary with `domain/` is enforced by ESLint boundaries** (`eslint.config.js`, rule `web-platform: allow ['shared', 'web-platform']`) — `platform/` never imports from `domain/`. The reverse import is allowed and expected.

**No `client/` folder inside an individual `domain/` module** — this is a deliberate asymmetry, not an oversight. `platform/client/` vs `platform/ui/` separates logic from components because `ui/` is meant to be usable without knowledge of `client/`. In `domain/` that separation has no justification (a page and its hook are permanently coupled) — more on this in `dcms-frontend-domain-documentation.md`.

---

## 2. State: `stores/` vs `queries/`

A rule with no exceptions: **data from the backend that can go stale → TanStack Query. Purely local data, with nothing to invalidate it from the server → Zustand.**

| | Zustand (`client/stores/`) | TanStack Query (`client/queries/`) |
|---|---|---|
| Example | current tenant, modal state, unsaved-changes draft, view filter | contract list, signature status, billing data, feature flags |
| Rule | centralized in `platform/` only when the state is genuinely global (`auth`, `tenant`) | always via `useQuery`/`useMutation` with a single `queryKey`, never copied into a store "for convenience" |

The most common mistake: keeping a copy of server data in Zustand after a fetch — this leads to two sources of truth and drift after an edit in another window/tab.

---

## 3. API client and interceptors (`client/api/`)

`create-api-client.ts` — a single HTTP client (e.g. a wrapper around `fetch`/`axios`) used by all `queries/*`, not created ad hoc in every hook.

`interceptors/auth-refresh.interceptor.ts` — automatic token refresh on a 401, transparent to the calling code. The only place that knows about the refresh-token mechanics from the backend's `platform/sessions` — the rest of the app doesn't see it.

---

## 4. Realtime (`client/realtime/use-realtime-sync.ts`)

**Realtime events invalidate a `queryKey`, they do not update the UI directly.** An event from the backend (e.g. `contract.statusChanged` from `apps/api/src/domain/events.ts` — see `dcms-domain-architecture.md` section 6) arrives here and triggers `queryClient.invalidateQueries(['contracts', contractId])`; the UI refreshes via a normal TanStack Query refetch.

**The event → `queryKey` mapping lives in `domain/<module>/realtime/`, not here** — `use-realtime-sync.ts` is a generic transport (connects to WS/SSE, listens for event names from the registry), it doesn't know the semantics of specific DCMS events. Don't bypass the query cache with a separate "live" rendering path — this leads to two independent sources of state under race conditions (a realtime event arriving before the REST response after a user action).

---

## 5. `client/hooks/` — the entry point for `domain/`

`use-current-user.ts`, `use-tenant-context.ts`, `use-feature-flag.ts` — `domain/` reads platform state **through these hooks**, never directly from a store/query (`useAuthStore.getState()` in `domain/` code is a code smell). This keeps a single point of change if the internal store implementation ever changes.

---

## 6. `ui/components/` catalog

Every generic component, with the backend module it talks to (via the corresponding `client/queries/`):

| Component | Backend platform module | Role |
|---|---|---|
| `LoginForm` | `auth` | Login/registration form. |
| `TenantSwitcher` | `tenants` | Active-organization switcher. |
| `PricingCard` | `billing` | Plan/subscription display. |
| `FeatureFlagGate` | `feature-flags`, `usage-metering` (entitlements) | Conditional rendering of paid features — see section 8. |
| `ConsentBanner` | `consent` | Consent to data processing. |
| `LegalAcceptanceModal` | `consent` / `data-retention` | Acceptance of legal content per jurisdiction (Regional Legal Assistance). |
| `InvitationForm` | `rbac`, `tenants` | Inviting collaborators. |
| `FileUploadWidget` | `file-storage` | File upload with client-side type/size validation. |
| `ImpersonationBanner` | `impersonation` | An explicit signal that an admin is acting as another user. |
| `ApiKeysManager` | `api-keys` | API key management (v2+, embeddable/partner API). |
| `NotificationCenter` | `notifications` (combined with `in-app-notifications`) | Displaying system notifications. |
| `AuditLogViewer` | `audit` | A generic log viewer — used both in the admin panel and in `domain/compliance-reporting`. |

## 7. `client/queries/` catalog

The corresponding server-state hooks, one folder per resource: `billing`, `sessions`, `api-keys`, `consent`, `legal-acceptance`, `file-storage`, `feature-flags`, `entitlements`, `invitations`, `in-app-notifications`, `data-export`, `audit`. Each folder exports `useX`/`useXMutation` built on top of `create-api-client.ts` and `query-keys.ts` — it does not duplicate the DTO type (imported from `shared/contracts/`, see `dcms-frontend-development-guidelines.md` section 5).

---

## 8. Feature flags and plan tier

Every piece of UI corresponding to a paid add-on (see `dcms-domain-architecture.md`, "Monetization model") is wrapped in `<FeatureFlagGate>`, not scattered `if` conditions across `domain/`. `FeatureFlagGate` reads from `client/queries/feature-flags` and `client/queries/entitlements` — a single source of truth for what's available for the tenant/plan. Changing a plan threshold is a config change on the `entitlements` side, not a frontend redeploy.

---

## 9. Tests (`client/testing/`)

`render-with-providers.tsx` (wraps in a `QueryClientProvider` from `mock-query-client.ts` and stores from `mock-auth-store.ts`) — used by **every** test in `domain/`, never a bare `render()` from testing-library. Ensures consistent default tenant/auth values across all tests.

---

## 10. Styling and tokens (`ui/tokens/`)

New tokens (color, spacing, typography) go into `design-tokens.css` as CSS variables — components in `domain/` reference tokens (`var(--color-primary)`), they don't define their own hex/px values. Per-tenant overrides (white-label, v2+) go exclusively into `app/theme.css`, never into `ui/tokens/` — the base tokens must remain a stable fallback independent of a customer's branding.
