---
paths:
  - "apps/api/src/platform/**"
globs: apps/api/src/platform/**
description: "DCMS backend platform/ conventions and module catalog"
---

# `apps/api/src/platform/` — conventions

- Structure per module: `<module>.module.ts` (`forRoot`/`forRootAsync`), `<module>.config.ts`, services, guards/pipes/middleware. No controllers specific to DCMS — that's `domain/`.
- No `process.env` reads inside modules — config is injected.
- Communication via typed events (`@nestjs/event-emitter`), not direct cross-module calls, except explicit DI dependencies (e.g. `security` injects `SecretsService`).
- Never import from `domain/`.
- Event names/payloads: import from `apps/api/src/events.ts`, not `platform/events.ts` directly.

## Module catalog

| Module | Does | Depends on | Key event |
|---|---|---|---|
| `health` | `/health`, `/ready` | — | — |
| `logging` | structured logging, correlation ID | — | — |
| `security` | Helmet, CORS, strict validation pipe, CSRF, field-level encryption | `secrets`, `logging` | `security.requestRejected` |
| `secrets` | secret management/rotation | — | `secrets.rotated` |
| `auth` | login, OAuth, JWT, guards, optional MFA | `secrets` | `auth.user.registered` |
| `sessions` | active session control, revoke, refresh rotation | `auth` | `session.revoked` |
| `rbac` | roles, permissions, guard | `auth` | `rbac.roleAssigned` |
| `tenants` | per-organization isolation, `TenantContextService` | `auth`, `rbac` | `tenant.created` |
| `api-keys` | API keys for B2B integrations | `auth`, `rbac`, `tenants` | `apiKey.created` |
| `rate-limiting` | throttling per user/tenant/key | `tenants` | `rateLimit.exceeded` |
| `idempotency` | protection against duplicate operations | — | — |
| `file-storage` | files, per-tenant isolation | `tenants` | `file.uploaded` |
| `notifications` | transactional/system emails | `secrets`, `tenants` | `notification.sent` |
| `consent` | consent to data processing | `tenants` | `consent.granted` |
| `webhooks-inbound` | receiving + verifying webhooks (Stripe etc.) | `secrets` | `webhook.received` |
| `billing` | subscriptions, plans, Stripe | `tenants`, `webhooks-inbound`, `notifications` | `billing.subscription.updated` |
| `usage-metering` | usage counting against plan | `billing`, `tenants` | `usage.limitExceeded` |
| `feature-flags` | per-tenant flags | `tenants` | `featureFlag.toggled` |
| `circuit-breaker` | protection against provider outages | — | `circuitBreaker.opened` |
| `dead-letter-queue` | events/jobs after retries exhausted | `circuit-breaker` | `deadLetter.added` |
| `webhooks` (out) | outbound webhook delivery, HMAC | `secrets`, `dead-letter-queue` | `webhook.delivered` |
| `observability` | metrics, tracing | — | — |
| `scheduler` | cron (cleanup, reports, rotation) | — | `scheduler.jobCompleted` |
| `audit` | wildcard listener, audit log | all of the above | `audit.entryCreated` |
| `pii-redaction` | masking sensitive data | `secrets`, `audit` | — |
| `data-retention` | data retention/deletion (GDPR) | `tenants`, `consent`, `file-storage` | `dataRetention.purged` |
| `impersonation` | admin logs in as user, fully logged | `auth`, `rbac`, `audit` | `impersonation.started` |
| `password-policy` | password strength, lockout | `auth` | `password.lockedOut` |
| `api-versioning` | public API versioning | — | — |
| `swagger` | OpenAPI | all endpoint-bearing modules | — |
| `sandbox` | test mode for B2B integrators | `billing`, `tenants` | `sandbox.actionSimulated` |
| `maintenance-mode` | controlled traffic shutdown (v2+, build on signal) | — | `maintenanceMode.enabled` |
| `search` | full-text search (v2+, build on signal) | depends on implementation | — |
| `analytics-ingestion` | product metrics (v2+, build on signal) | — | — |
| `backup-dr` | backup/DR, encrypted (v2+, build on signal) | — | `backup.completed` |

Full event payloads: `apps/api/src/platform/events.ts`. Full "does NOT do" description per module: `dcms-platform-dokumentacja.md`.
