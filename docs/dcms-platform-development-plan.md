# DCMS — `platform` Development Plan and Documentation

> **Context and correction relative to the original files:** this document describes `apps/api/src/platform/` — a local folder in the `dcms/` monorepo, **not** a separate, published npm package (`@twoja-org/platform`). An earlier version of this plan assumed a multi-product, versioned-package model (per the original `prompt-1-platform-package.md`) — we deliberately abandoned that in favor of a single repo with no internal packages. The content below has been rewritten for that model: no references to publishing on GitHub Packages, no Changesets, modules as plain folders imported relatively from `apps/api/src/app/app.module.ts`. The substantive build order and dependencies between modules — the heart of the original plan — remain unchanged, since they don't depend on whether `platform` is a folder or a package.

This is a **plan + documentation in one**: each phase has a build-order/dependency table (plan) and — in section 9 — a one-sentence glossary of every module (documentation). A separate file, `dcms-security-hardening.md`, expands on the `security` module and the hardening checklist; its key conclusions (the `security` module in Phase 1, not later) are already folded into the plan below.

## 0. How this relates to the domain plan (`dcms-domain-architecture.md`)

| Platform phase | Roughly corresponds to | Note |
|---|---|---|
| Phase 1 — foundation | MVP v0 (part: `auth`, `tenants`, `rbac`) | `health`/`logging`/`security`/`secrets`/`sessions`/`api-keys` are the infrastructure underneath, not named explicitly in the domain phases, but required before anything else works. |
| Phase 2 — operational must-haves | MVP v0 (`billing`, `usage-metering`) + part of v1 (`feature-flags`, `rate-limiting`) | The domain v0 plan requires `billing`/`usage-metering` to be "ready" — here you can see this isn't one step, but a whole chain (`webhooks-inbound` → `billing` → `usage-metering`). |
| Phase 3 — resilience and observability | Not explicitly required by any domain phase, but without it Phase 2 is fragile in production (external calls with no circuit breaker). |
| Phase 4 — enterprise trust | **v1.5** explicitly | Already established: these modules are an explicit requirement of the domain plan's v1.5 phase. |
| Phase 5 — scale | v2+, built on signal | Consistent with the domain plan's principle: don't build ahead of need. |

---

## Phase 0 — before you write any code (repo config, not code)

Added relative to the original plan — cheap, one-time things that aren't a "module" but must exist from the first commit, not after the fact:

- `SECURITY.md` in the repo (how to report a vulnerability) — a professionalism signal for a portfolio, costs 10 minutes.
- Dependency scanning in CI (`npm audit` is already in `ci.yml`; add Dependabot — configuration, not code).
- `.gitignore` covering secrets (already done earlier).

**Definition of done:** the repo has `SECURITY.md`, Dependabot is enabled in GitHub settings.

---

## Phase 1 — foundation (needed by almost everything else)

The order within this phase matters — each subsequent module genuinely depends on the previous one. **Relative to the original plan: `security` is added here**, not in Phase 4 or "someday" — per the conclusion from the security document: Helmet, CORS, and the global validation pipe must be present from the first playground endpoint, not bolted on later.

| # | Module | Depends on | Why now |
|---|---|---|---|
| 1 | `health` | — | Zero dependencies, an immediate signal that the app is alive — build this first to get a feedback loop right away. |
| 2 | `logging` | — | Needed to debug everything you build next. |
| 3 | `security` | logging (so rejected requests get logged) | Helmet, CORS, the global strict validation pipe — must exist **before** you expose the first endpoint, not after. |
| 4 | `secrets` | — | Before anything needs API keys (Stripe, mail providers) or the encryption key for `security.encryption`, you need somewhere safe to keep them. |
| 5 | `auth` | secrets (JWT signing key) | The foundation for identity — almost every subsequent module needs to know "who's calling." |
| 6 | `sessions` | auth | A natural extension of auth — build it right alongside, not later, or you'll end up refactoring JWT issuance. |
| 7 | `rbac` | auth | The permissions guard — needed before you start adding admin endpoints in later modules. |
| 8 | `tenants` | auth, rbac | Organization context — the rest of the platform (billing, usage-metering, consent) is per-tenant. |
| 9 | `api-keys` | auth, rbac, tenants | B2B integrations identified per tenant. |

**Definition of done:** in the playground you can register a user, log in, create a tenant, get a token with a role, the guard blocks an endpoint without the right role — and every request passes through Helmet/CORS/strict validation, even if nothing tests that directly yet.

---

## Phase 2 — operational must-haves

| # | Module | Depends on | Why now |
|---|---|---|---|
| 1 | `rate-limiting` | tenants (per-tenant limits) | Abuse protection before you expose anything publicly. |
| 2 | `idempotency` | — | Independent, but most valuable together with the payment/webhook modules that are about to be added. |
| 3 | `file-storage` | tenants (per-tenant file isolation) | `domain` (e.g. `contracts` — uploading contract scans) will need this from day one of integration. |
| 4 | `notifications` | secrets (mail provider key), tenants | Needed before auth/billing want to send transactional emails. |
| 5 | `consent` | tenants | Before notifications sends anything marketing-related, an explicit consent record is needed. |
| 6 | `webhooks-inbound` | secrets (signature verification) | Must exist **before** billing, because Stripe sends events that billing consumes. |
| 7 | `billing` | tenants, webhooks-inbound, notifications | Depends on the previous item — the order is not accidental. |
| 8 | `usage-metering` | billing, tenants | Limits only make sense once there's a plan to measure them against. |
| 9 | `feature-flags` | tenants | Functionally independent, but convenient to have tenants already in place for per-tenant toggling. |

**Definition of done:** the playground supports the full cycle: tenant signs up → gets a plan → a Stripe webhook updates the status → usage-metering limits are enforced → the user gets a welcome email.

---

## Phase 3 — resilience and observability

| # | Module | Depends on | Why now |
|---|---|---|---|
| 1 | `circuit-breaker` | — | Plugged into notifications/webhooks-inbound/a future domain `ai-gateway` — build it once you actually have something to protect (Phase 2 introduced real external calls: Stripe, mail provider). |
| 2 | `dead-letter-queue` | circuit-breaker | A natural complement — once retries are exhausted, something has to catch the failure. |
| 3 | `webhooks` (outbound) | secrets (HMAC signing) | Now that you have dead-letter-queue, webhook delivery has a sensible fallback on non-delivery. |
| 4 | `observability` | — | Metrics/tracing only make sense once there's something to measure — several modules are already running. |
| 5 | `scheduler` | — | Cron for cleanup/reports — useful once there's actually something to clean up (files, sessions, retention data). |

**Definition of done:** artificially cutting the connection to the mail provider in the playground doesn't crash the app — it flows through the circuit breaker, lands in the dead-letter-queue, and is visible in metrics.

---

## Phase 4 — enterprise trust

This maps exactly to **v1.5** in the domain plan — those modules require this, so they must be ready in the platform first.

| # | Module | Depends on | Why now |
|---|---|---|---|
| 1 | `audit` | all previous modules (wildcard listener) | Only makes sense once there are plenty of events to capture — built last of the "core" set so it actually has something to log during testing. |
| 2 | `pii-redaction` | secrets, audit | Plugged into logging and a future domain `ai-gateway`. |
| 3 | `data-retention` | tenants, consent, file-storage | Deletion policies need to know what to delete — requires the existing modules that hold the data. |
| 4 | `impersonation` | auth, rbac, audit | Requires auditing to be safe — hence only now, not earlier. |
| 5 | `password-policy` | auth | An extension of auth, added once the rest of the foundation is stable. |
| 6 | `api-versioning` | — | API formalization, sensible once the contract has stabilized. |
| 7 | `swagger` | all previous modules | Documentation for the whole thing — naturally comes at the end of the main module block. |
| 8 | `sandbox` | billing, tenants | A test mode makes sense once there's something to test without real consequences (billing, limits). |

**Definition of done:** every action in the playground leaves a trace in audit, sensitive data in logs is redacted, an admin can impersonate a user with a full log of the action.

---

## Phase 5 — scale (v2+, build only on a real signal)

| Module | Signal that it's time to build it |
|---|---|
| `maintenance-mode` | The first serious production incident / the first planned downtime for a migration. |
| `search` | `domain` genuinely needs content search (don't assume this upfront). |
| `analytics-ingestion` | You want to measure product metrics beyond your own observability. |
| `backup-dr` | You have paying customers for whom data loss is a real business risk, not a theoretical one. |

Deliberately built last — this is exactly the group where "I'll build it just in case" is the most expensive mistake in the whole plan.

---

## 6. Sequencing principle

Don't start building a module that depends on another (via an injected service or a meaningful data context) before that other module exists and has been tested in the playground. The tables above are a direct consequence of this single rule.

## 7. Overall dependency graph

```
health, logging ─────────────────────────────────────► (feedback loop from day 1)
         │
         ▼
      security (Helmet, CORS, validation pipe)
         │
         ▼
      secrets ──► auth ──► sessions
                     │
                     ▼
                   rbac ──► tenants ──► api-keys
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
  rate-limiting          file-storage          notifications ──► consent
        │                                             │
        │                                    webhooks-inbound
        │                                             │
        │                                       billing ──► usage-metering
        │                                             │
        └───────────────────► feature-flags ◄─────────┘
                     │
        circuit-breaker ──► dead-letter-queue ──► webhooks (out)
                     │
              observability, scheduler
                     │
              audit ──► pii-redaction, impersonation
                     │
              data-retention, password-policy
                     │
              api-versioning ──► swagger ──► sandbox
                     │
       (v2+) maintenance-mode / search / analytics-ingestion / backup-dr
```

---

## 8. Security — summary (full content in `dcms-security-hardening.md`)

Three things from the separate document that directly affect the plan above, worth keeping in view here:

1. **`security` is a narrow module** (Helmet/CORS/strict validation/CSRF/field-level encryption) — it doesn't duplicate what's already covered by `auth`, `rbac`, `secrets`, `rate-limiting`, `pii-redaction`, `audit`, `password-policy`, `sessions`, `webhooks-inbound`, `idempotency`, `consent`, `data-retention`. Those modules **are already security**, distributed across the platform according to what they concern — `security` only catches what doesn't fit thematically into any of them.
2. **MFA/2FA is not a separate module** — it's an extension of `auth` (`auth.forRoot({ mfa: { enabled: true, methods: ['totp'] } })`).
3. **Things outside NestJS code** (TLS/reverse proxy, container hardening, npm audit in CI, anomaly alerting) don't have a module of their own by definition — that's an infrastructure checklist, not something to import into `AppModule`. Full list in the separate file.

---

## 9. Module glossary (documentation — one sentence per module)

**Phase 1**
- `health` — `/health`, `/ready` endpoints.
- `logging` — structured logging, correlation ID, request context.
- `security` — Helmet, CORS, global strict validation pipe, CSRF guard, field-level encryption, secure cookie configuration.
- `secrets` — management and rotation of keys/secrets (external provider API keys, JWT signing key, master key for field encryption).
- `auth` — login, OAuth, JWT, guards; optionally MFA as a config extension.
- `sessions` — active session control, remote revoke, refresh token rotation.
- `rbac` — roles and permissions, guard.
- `tenants` — per-organization data isolation, `TenantContextService`.
- `api-keys` — generation/rotation of API keys for B2B integrations.

**Phase 2**
- `rate-limiting` — throttling per user/tenant/API key.
- `idempotency` — protection against duplicate operations (idempotency keys).
- `file-storage` — file storage with per-tenant isolation.
- `notifications` — sending transactional/system emails.
- `consent` — an explicit record of consent to data processing.
- `webhooks-inbound` — receiving and verifying webhook signatures from external providers (e.g. Stripe).
- `billing` — subscriptions, plans, payment integration.
- `usage-metering` — generic usage counting against a plan.
- `feature-flags` — per-tenant feature flags.

**Phase 3**
- `circuit-breaker` — protection against external provider outages.
- `dead-letter-queue` — handling events/jobs that failed after retries are exhausted.
- `webhooks` (outbound) — delivery of outbound notifications with HMAC signing.
- `observability` — metrics and tracing.
- `scheduler` — cron for recurring jobs (cleanup, reports, periodic key rotation).

**Phase 4**
- `audit` — a wildcard listener on all events, writing to the audit log.
- `pii-redaction` — masking sensitive data in logs/AI prompts.
- `data-retention` — data retention/deletion policies (GDPR).
- `impersonation` — admin login as a user, with a full log of the action.
- `password-policy` — password strength, lockout after failed attempts.
- `api-versioning` — support for public API versioning.
- `swagger` — OpenAPI configuration.
- `sandbox` — a test mode for B2B integrators without consuming real limits/billing.

**Phase 5**
- `maintenance-mode` — controlled traffic shutdown during an incident/migration.
- `search` — full-text search.
- `analytics-ingestion` — collecting product metrics beyond its own observability.
- `backup-dr` — hooks/interfaces for backup and disaster recovery.
