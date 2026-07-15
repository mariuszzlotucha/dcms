# DCMS — `domain` Backend Development Plan (`apps/api/src/domain/`)

A companion file to `dcms-domain-architecture.md` (what each module does, what events it emits) — this covers only the **build order** of `domain/` modules and the dependencies between them, analogous to `dcms-platform-development-plan.md` on the `platform/` side. Phases correspond to the v0/v1/v1.5/v2+ phases from section 5 of the architecture document — broken down here into sequencing tables in the same format as the platform plan.

**No-playground verification** — a module is considered ready once a real `domain/` endpoint works end-to-end through the API, ultimately called from `apps/web`, not in isolation.

---

## 0. The platform gate — what `platform/` must deliver before each phase

| Domain phase | Required `platform/` readiness (see `dcms-platform-development-plan.md`) |
|---|---|
| MVP v0 | Phase 1 (foundation: `auth`, `tenants`, `rbac`) + partly Phase 2 (`billing`, `usage-metering`) |
| v1 | The rest of Phase 2 (`webhooks-inbound`/`webhooks`, `feature-flags`, `rate-limiting`) + `secrets` |
| v1.5 | Backend Phase 4 explicitly: `audit`, `pii-redaction`, `data-retention`, `backup-dr` |
| v2+ | Backend Phase 4/5: `sandbox`, `api-versioning`, `api-keys` |

Don't start a domain phase for which the corresponding `platform/` readiness doesn't yet exist and hasn't been verified — the same sequencing principle as in both platform plans.

---

## Phase MVP v0 — the CLM core

The order within this phase matters — `templates` and `contracts` are practically coupled to each other (the contract editor references the template library), but `templates` as a pure library doesn't need an existing contract, so it comes first.

| # | Module | Depends on | Why now |
|---|---|---|---|
| 1 | `templates` | platform: `tenants` (seeding default templates per tenant) | Zero dependency on other domain modules — a pure library, build it first so `contracts` has something to use right away. |
| 2 | `contracts` | `templates` (optional creation from a template), platform: `tenants`, `usage-metering` (plan limit) | The product core — create/edit/upload, versioning, statuses. Nothing further makes sense without this. |
| 3 | `negotiation-approval` | `contracts` (listens to `contract.submittedForApproval`) | Closes the negotiation loop — roles, approve/reject/revise, needs an existing contract to approve. |
| 4 | `esignature` | `negotiation-approval` (listens to `approval.granted`), platform: `secrets` (DocuSign integration) | The last step of the contract lifecycle in the MVP — signing only starts after approval. |

**Definition of done:** through the API you can create a contract from a template, take it through approval, send it for signature via DocuSign, and observe the status change to `esignature.completed`.

---

## Phase v1 — collaboration and insight

| # | Module | Depends on | Why now |
|---|---|---|---|
| 1 | `access-control` | `contracts` (there must be something to share), platform: `rbac`, `tenants` | Real-time collaboration and inviting external stakeholders — a natural extension of the v0 core. |
| 2 | `esignature` — extended with Adobe Sign | `esignature` (existing module from v0) | Adding a second provider to an already-existing integration, not a new module. |
| 3 | `analytics-insights` | `contracts`, `negotiation-approval`, `esignature` (aggregates their v0 events) | Only makes sense once there are enough v0 events to aggregate into a dashboard and negotiation-time metrics. |
| 4 | `integrations` | `contracts`, platform: `secrets`, `webhooks-inbound`/`webhooks` | CRM/Drive/MS365 — the last element of v1, since it needs an already-stable contract lifecycle to sync externally. |

**Definition of done:** two users collaborate on the same contract with visible permissions, the dashboard shows real metrics (negotiation time, number of pending signatures), a contract status change syncs to the connected CRM.

---

## Phase v1.5 — enterprise trust

| # | Module | Depends on | Why now |
|---|---|---|---|
| 1 | `esignature` — extended with eIDAS-qualified signatures | `esignature` (existing module), platform: Phase 4 (`audit`, `pii-redaction`) | A small, self-contained extension of an existing integration — needs no other new domain modules. |
| 2 | `compliance-reporting` | all previous domain modules (`contracts`, `templates`, `negotiation-approval`, `esignature`, `access-control`) — listens to their events, platform: `audit` ready | Deliberately built last in this phase — only makes sense once there are plenty of events from the full contract lifecycle to aggregate into a report. |

**Definition of done:** the exportable compliance report covers the full audit trail of a single contract (creation → edits → approval → signature), eIDAS signing is available as an option when sending for signature.

---

## Phase v2+ — scale (build on signal, not upfront)

| Module/extension | Depends on | Signal that it's time to build it |
|---|---|---|
| AI-powered clause risk analysis | `contracts`, `templates` | Real user demand for automatic flagging of risky terms — don't assume this upfront. |
| Side-by-side redlining | `contracts` (versioning) | Users are genuinely doing many revision rounds with an external client — a signal from `analytics-insights` (long negotiation time). |
| Automatic renewals/renegotiation | `contracts`, platform: `scheduler` | Revenue loss from neglected contracts becomes visible in the data. |
| Industry template marketplace | `templates` | `templates` already has a mature enough internal library to open it up externally. |
| Embeddable widget / partner API | `contracts`, platform: `sandbox`, `api-versioning`, `api-keys` (backend Phase 4/5) | A concrete partner/B2B2B distribution channel wants an integration, not a hypothetical one. |
| Portfolio financial forecasting | `analytics-insights` (existing module) | An extension of an existing module, not a new one — build it once there's enough historical data to forecast from. |

Deliberately built on signal, not upfront — the exact same principle as in the platform backend plan and the frontend plan for their corresponding Phase 5.

---

## Overall dependency graph

```
templates ──► contracts ──► negotiation-approval ──► esignature (DocuSign)
                  │                                        │
                  │                              esignature + Adobe Sign
                  │                                        │
                  ▼                                        ▼
            access-control                        analytics-insights
                  │                                        │
                  └──────────────► integrations ◄──────────┘
                                          │
                          esignature + eIDAS ──► compliance-reporting
                                          │
        (v2+, on signal) AI clause analysis / redlining / auto-renewal /
                    marketplace / embeddable API / forecasting
```

---

## Sequencing principle

The same rule as in the other three plans (`platform` backend, `platform`/`domain` frontend): don't start a `domain/` module that listens to an event from another domain or platform module before that source module exists and has been verified end-to-end through the API. The order in the tables above is a direct consequence of this rule, applied to the event graph from `dcms-domain-architecture.md` sections 2 and 6.
