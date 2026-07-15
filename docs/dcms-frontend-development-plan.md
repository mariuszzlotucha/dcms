# DCMS — Frontend Development Plan (`apps/web`)

A companion file — the build order for `apps/web/src/platform/` and `apps/web/src/domain/` together, since domain pages always depend on ready platform building blocks (stores, queries, UI components). Beyond this document there is `dcms-frontend-platform-documentation.md` (what it is, how it's built) and `dcms-frontend-domain-documentation.md` (how to build a specific feature) — both **without phases**, purely reference material.

Phases correspond to the phases in `dcms-platform-development-plan.md` (backend) and `dcms-domain-architecture.md` (v0/v1/v1.5/v2+) — the frontend side of the same stage, built in parallel with or right after the backend exposes the corresponding endpoint/event.

**No-playground verification** — just like the backend, you verify the frontend directly in the running DCMS app (`npm run dev:web`), not in Storybook or a separate demo environment.

---

## Phase 1 — foundation (corresponds to backend Phase 1)

| # | Layer | Item | Depends on | Why now |
|---|---|---|---|---|
| 1 | platform | `client/api/create-api-client.ts` + `interceptors/auth-refresh.interceptor.ts` | backend: `auth` | No UI moves without an HTTP client that talks to `auth`/`sessions`. |
| 2 | platform | `client/query-client/` (`create-query-client.ts`, `query-keys.ts`) | — | The foundation for TanStack Query — the rest of `queries/*` requires it. |
| 3 | platform | `client/stores/auth`, `client/stores/tenant` | backend: `auth`, `tenants` | Client state for identity — needed before any screen knows "who's logged in." |
| 4 | platform | `client/hooks/use-current-user.ts`, `use-tenant-context.ts` | stores/auth, stores/tenant | A thin layer over the stores — the rest of the app reads through hooks, never directly from a store. |
| 5 | platform | `ui/components/LoginForm`, `TenantSwitcher` | stores/auth, stores/tenant | The first real screens — without them you can't even get into the app. |
| 6 | platform | `app/providers.tsx`, `app/router.tsx`, `app/layout.tsx` (real content, not a placeholder) | everything above | Wires the stores + routing into a working app — currently these are placeholders from the initial bootstrap. |
| 7 | platform | `ui/tokens/design-tokens.css` + `tailwind.config.js`/`postcss.config.js` | — | Before you start styling anything for real, the tokens must exist — otherwise every component hardcodes its own colors. |

**Definition of done:** login works end-to-end (form → backend `auth` → token in `stores/auth` → routing lets you into the app), the tenant switcher genuinely changes the query context.

---

## Phase 2 — operational must-haves (corresponds to backend Phase 2 + MVP v0 from the domain plan)

| # | Layer | Item | Depends on | Why now |
|---|---|---|---|---|
| 1 | platform | `client/queries/feature-flags`, `client/queries/entitlements`, `ui/components/FeatureFlagGate` | backend: `feature-flags`, `billing` | Without this you can't correctly hide paid features in the steps below. |
| 2 | platform | `client/queries/billing`, `ui/components/PricingCard` | backend: `billing` | The plan/subscription screen — the user needs to know what plan they're on. |
| 3 | platform | `client/queries/consent`, `ui/components/ConsentBanner` | backend: `consent` | A legal requirement before any real use of the app with a user's data. |
| 4 | platform | `client/queries/file-storage`, `ui/components/FileUploadWidget` | backend: `file-storage` | `domain/contracts` (uploading contract scans) needs this from day one. |
| 5 | platform | `client/queries/in-app-notifications`, `ui/components/NotificationCenter` | backend: `notifications` | System notifications (e.g. signature status) need somewhere to display before you start emitting them from `domain/`. |
| 6 | domain | `contracts/` (`ContractListPage`, `ContractEditorPage`, `VersionHistoryPanel`) | platform: api-client, queries pattern, FileUploadWidget | The MVP v0 core — without this DCMS doesn't do what it exists to do. |
| 7 | domain | `templates/` (`TemplateLibraryPage`, `ClauseEditor`) | contracts (the editor references a template on creation) | The second pillar of MVP v0 — creating a contract from scratch without a template is impractical. |
| 8 | domain | `negotiation-approval/` (`ApprovalWorkflowPage`, `RoleAssignmentPanel`) | contracts (contract status drives action visibility) | Closes the MVP v0 loop: create → edit → submit → approve. |
| 9 | domain | `esignature/` (`SignatureRequestPage`, `SignatureStatusTracker`) | negotiation-approval (signing starts after approval) | The last step of the contract lifecycle in MVP v0 — DocuSign to start. |

**Definition of done:** the user goes through the full cycle in the UI: creates a contract from a template → sends it for approval → approves it → sends it for signature → sees the signature status in the list.

---

## Phase 3 — collaboration and insight (corresponds to backend Phase 3 + v1 from the domain plan)

| # | Layer | Item | Depends on | Why now |
|---|---|---|---|---|
| 1 | platform | `client/realtime/use-realtime-sync.ts` | backend: domain and platform events already being emitted | Without this, dashboards/statuses require manual refreshing — bad UX at this stage of the app's scale. |
| 2 | platform | `client/queries/invitations`, `ui/components/InvitationForm` | backend: `rbac`, `tenants` | Inviting collaborators/external stakeholders to a contract. |
| 3 | domain | `access-control/` (`CollaboratorsPanel`, `ShareContractModal`) | platform: realtime, invitations | v1 from the domain plan: real-time collaboration. |
| 4 | domain | `analytics-insights/` (`DashboardPage` — real content, not a placeholder) | platform: realtime (live metric invalidation) | Replaces the bootstrap placeholder with a real status dashboard. |
| 5 | domain | `integrations/` (`IntegrationsSettingsPage`) | platform: `client/queries` pattern, backend: `secrets`/`webhooks` | CRM/Drive/MS365 — the last element of v1. |

**Definition of done:** two users in two browser tabs see the other person's contract status change without refreshing the page.

---

## Phase 4 — enterprise trust (corresponds to backend Phase 4 + v1.5)

| # | Layer | Item | Depends on | Why now |
|---|---|---|---|---|
| 1 | platform | `client/queries/audit`, `ui/components/AuditLogViewer` | backend: `audit` | A generic log viewer — used both by `compliance-reporting` and a potential admin panel. |
| 2 | platform | `client/queries/legal-acceptance`, `ui/components/LegalAcceptanceModal` | backend: `consent`/`data-retention` | Regional Legal Assistance (a differentiator from `dcms-domain-architecture.md`) requires explicit acceptance of legal content per jurisdiction. |
| 3 | platform | `ui/components/ImpersonationBanner` | backend: `impersonation` | B2B/enterprise support — an admin logs in as a user, the banner must explicitly signal this (a trust requirement, not cosmetics). |
| 4 | domain | `compliance-reporting/` (`ComplianceReportPage`) | platform: AuditLogViewer, queries/audit | v1.5 explicitly — exportable audit reports. |
| 5 | domain | `esignature/` — extended with eIDAS-qualified signatures in the UI | platform: FeatureFlagGate (this is a paid add-on) | v1.5 explicitly. |

**Definition of done:** a compliance report is generated and exported from the UI using the same data as `AuditLogViewer`; eIDAS signing is available only to tenants with the corresponding entitlement.

---

## Phase 5 — scale (v2+, build on signal — as in the backend and domain plans)

| Layer | Item | Signal that it's time to build it |
|---|---|---|
| platform | `client/queries/api-keys`, `ui/components/ApiKeysManager` | Real demand for an embeddable API/partners (v2+ domain). |
| platform | `client/queries/data-export` | An enterprise customer requests full data export (GDPR data portability), not before. |
| domain | UI for the template marketplace, AI clause-risk analysis, financial forecasting | Exactly the same signals as on the backend/domain side in `dcms-domain-architecture.md` section 5 — don't build ahead of need. |

---

## Sequencing principle

The same rule as in the backend plan: don't start a page/component in `domain/` that depends on a `platform/` element (store, query, component) before that element exists and has been verified in the running app. In the other direction — don't build a `platform/` element until some `domain/` actually needs it (see Phase 5) — this leads to unused code, exactly what the "building ahead of need" section in the domain plan warns against.
