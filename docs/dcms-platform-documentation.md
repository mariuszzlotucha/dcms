# DCMS — `platform` Documentation (`apps/api/src/platform/`)

Reference document for platform modules: what each module does, what it depends on (on other `platform/` modules, not on a development phase), what it emits, and what it deliberately does not do. No timeline — this describes the target state of each module, to be used while implementing it.

**Module verification happens directly in DCMS**, not in a separate playground — a module is considered ready once a real endpoint/flow in `domain/` (`apps/api/src/domain/`) actually uses it and works end-to-end, not once it passes an isolated test detached from the product.

---

## Conventions that apply to every module

- **Structure:** `apps/api/src/platform/<module>/` — `<module>.module.ts` (exposes `forRoot(config)` / `forRootAsync({ useFactory, inject })`), `<module>.config.ts` (config types), injectable services, any guards/pipes/middleware. No controllers specific to DCMS — that's `domain/`'s job.
- **Config is injected, not read directly.** No module calls `process.env` directly — all config comes through `forRoot`/`forRootAsync`; the consumer (`apps/api/src/app/app.module.ts`) decides where the config comes from.
- **Only `AppModule` calls `EventEmitterModule.forRoot()`.** No platform module does this — established from the start (`prompt-1-platform-package.md`) and already implemented in `apps/api/src/app/app.module.ts`.
- **Communication via typed events** (`@nestjs/event-emitter`), not direct calls between platform modules, except for explicitly listed dependencies injected via DI (e.g. `security` injects `SecretsService` from `secrets`).
- **The boundary with `domain/` is enforced by ESLint boundaries:** a platform module **never** imports anything from `domain/` and knows nothing about DCMS-specific contracts (contracts, e-signature, templates, etc.). The reverse import (`domain` → `platform`) is allowed and expected.
- **Event contracts live in a single central registry**, not per module: `apps/api/src/platform/events.ts` (name + payload for all platform events) and, analogously, `apps/api/src/domain/events.ts` for domain events. Both are merged in `apps/api/src/events.ts` (`export const EVENTS = { ...PLATFORM_EVENTS, ...DOMAIN_EVENTS }`, `export type EventPayloadMap = PlatformEventPayloadMap & DomainEventPayloadMap`) — the single place from which both `platform/` and `domain/` import event names, instead of magic strings scattered across the module they concern.

---

## Event registry — full file contents

### `apps/api/src/platform/events.ts`

```typescript
// Registry of platform event names + payload types — single source of truth.
// domain/ imports from this file, not from magic strings.

export const PLATFORM_EVENTS = {
  AUTH_USER_REGISTERED: 'auth.user.registered',
  AUTH_USER_LOGGED_IN: 'auth.user.loggedIn',
  AUTH_USER_LOGIN_FAILED: 'auth.user.loginFailed',
  SESSION_REVOKED: 'session.revoked',
  RBAC_ROLE_ASSIGNED: 'rbac.roleAssigned',
  TENANT_CREATED: 'tenant.created',
  API_KEY_CREATED: 'apiKey.created',
  API_KEY_REVOKED: 'apiKey.revoked',
  SECURITY_REQUEST_REJECTED: 'security.requestRejected',
  SECRETS_ROTATED: 'secrets.rotated',
  RATE_LIMIT_EXCEEDED: 'rateLimit.exceeded',
  FILE_UPLOADED: 'file.uploaded',
  FILE_DELETED: 'file.deleted',
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_FAILED: 'notification.failed',
  CONSENT_GRANTED: 'consent.granted',
  CONSENT_REVOKED: 'consent.revoked',
  WEBHOOK_RECEIVED: 'webhook.received',
  BILLING_SUBSCRIPTION_UPDATED: 'billing.subscription.updated',
  USAGE_LIMIT_EXCEEDED: 'usage.limitExceeded',
  FEATURE_FLAG_TOGGLED: 'featureFlag.toggled',
  CIRCUIT_BREAKER_OPENED: 'circuitBreaker.opened',
  CIRCUIT_BREAKER_CLOSED: 'circuitBreaker.closed',
  DEAD_LETTER_ADDED: 'deadLetter.added',
  WEBHOOK_DELIVERED: 'webhook.delivered',
  WEBHOOK_DELIVERY_FAILED: 'webhook.deliveryFailed',
  SCHEDULER_JOB_COMPLETED: 'scheduler.jobCompleted',
  SCHEDULER_JOB_FAILED: 'scheduler.jobFailed',
  AUDIT_ENTRY_CREATED: 'audit.entryCreated',
  DATA_RETENTION_PURGED: 'dataRetention.purged',
  IMPERSONATION_STARTED: 'impersonation.started',
  IMPERSONATION_ENDED: 'impersonation.ended',
  PASSWORD_LOCKED_OUT: 'password.lockedOut',
  SANDBOX_ACTION_SIMULATED: 'sandbox.actionSimulated',
  MAINTENANCE_MODE_ENABLED: 'maintenanceMode.enabled',
  MAINTENANCE_MODE_DISABLED: 'maintenanceMode.disabled',
  BACKUP_COMPLETED: 'backup.completed',
  BACKUP_FAILED: 'backup.failed',
} as const;

export interface PlatformEventPayloadMap {
  [PLATFORM_EVENTS.AUTH_USER_REGISTERED]: { userId: string; email: string; tenantId: string };
  [PLATFORM_EVENTS.AUTH_USER_LOGGED_IN]: { userId: string; tenantId: string; method: 'password' | 'oauth' | 'mfa' };
  [PLATFORM_EVENTS.AUTH_USER_LOGIN_FAILED]: { email: string; reason: string; ip: string };
  [PLATFORM_EVENTS.SESSION_REVOKED]: { userId: string; sessionId: string; revokedBy: 'user' | 'admin' | 'system' };
  [PLATFORM_EVENTS.RBAC_ROLE_ASSIGNED]: { userId: string; tenantId: string; role: string };
  [PLATFORM_EVENTS.TENANT_CREATED]: { tenantId: string; name: string; plan: string };
  [PLATFORM_EVENTS.API_KEY_CREATED]: { tenantId: string; keyId: string; scopes: string[] };
  [PLATFORM_EVENTS.API_KEY_REVOKED]: { tenantId: string; keyId: string };
  [PLATFORM_EVENTS.SECURITY_REQUEST_REJECTED]: { reason: string; path: string; ip: string };
  [PLATFORM_EVENTS.SECRETS_ROTATED]: { secretName: string; rotatedAt: Date };
  [PLATFORM_EVENTS.RATE_LIMIT_EXCEEDED]: { tenantId: string; key: string; limit: number };
  [PLATFORM_EVENTS.FILE_UPLOADED]: { tenantId: string; fileId: string; sizeBytes: number; mimeType: string };
  [PLATFORM_EVENTS.FILE_DELETED]: { tenantId: string; fileId: string };
  [PLATFORM_EVENTS.NOTIFICATION_SENT]: { tenantId: string; channel: 'email' | 'sms'; recipient: string; template: string };
  [PLATFORM_EVENTS.NOTIFICATION_FAILED]: { tenantId: string; reason: string };
  [PLATFORM_EVENTS.CONSENT_GRANTED]: { tenantId: string; userId: string; consentType: string; version: string };
  [PLATFORM_EVENTS.CONSENT_REVOKED]: { tenantId: string; userId: string; consentType: string };
  [PLATFORM_EVENTS.WEBHOOK_RECEIVED]: { provider: string; eventType: string; verified: boolean };
  [PLATFORM_EVENTS.BILLING_SUBSCRIPTION_UPDATED]: { tenantId: string; plan: string; status: string };
  [PLATFORM_EVENTS.USAGE_LIMIT_EXCEEDED]: { tenantId: string; metric: string; limit: number; current: number };
  [PLATFORM_EVENTS.FEATURE_FLAG_TOGGLED]: { tenantId: string; flagKey: string; enabled: boolean };
  [PLATFORM_EVENTS.CIRCUIT_BREAKER_OPENED]: { provider: string };
  [PLATFORM_EVENTS.CIRCUIT_BREAKER_CLOSED]: { provider: string };
  [PLATFORM_EVENTS.DEAD_LETTER_ADDED]: { originalEvent: string; payload: unknown; failureReason: string };
  [PLATFORM_EVENTS.WEBHOOK_DELIVERED]: { tenantId: string; url: string; statusCode: number };
  [PLATFORM_EVENTS.WEBHOOK_DELIVERY_FAILED]: { tenantId: string; url: string; attempt: number };
  [PLATFORM_EVENTS.SCHEDULER_JOB_COMPLETED]: { jobName: string; durationMs: number };
  [PLATFORM_EVENTS.SCHEDULER_JOB_FAILED]: { jobName: string; reason: string };
  [PLATFORM_EVENTS.AUDIT_ENTRY_CREATED]: { eventName: string; actorId: string | null; tenantId: string | null; timestamp: Date };
  [PLATFORM_EVENTS.DATA_RETENTION_PURGED]: { tenantId: string; resourceType: string; resourceId: string };
  [PLATFORM_EVENTS.IMPERSONATION_STARTED]: { adminId: string; targetUserId: string; tenantId: string };
  [PLATFORM_EVENTS.IMPERSONATION_ENDED]: { adminId: string; targetUserId: string };
  [PLATFORM_EVENTS.PASSWORD_LOCKED_OUT]: { userId: string; failedAttempts: number };
  [PLATFORM_EVENTS.SANDBOX_ACTION_SIMULATED]: { tenantId: string; action: string };
  [PLATFORM_EVENTS.MAINTENANCE_MODE_ENABLED]: { reason: string };
  [PLATFORM_EVENTS.MAINTENANCE_MODE_DISABLED]: { reason: string };
  [PLATFORM_EVENTS.BACKUP_COMPLETED]: { backupId: string; sizeBytes: number; encrypted: boolean };
  [PLATFORM_EVENTS.BACKUP_FAILED]: { reason: string };
}
```

### `apps/api/src/domain/events.ts`

The domain event registry — full contents live in `dcms-domain-architecture.md`, so that domain event names and payloads live alongside the rest of the `domain/` documentation, not here.

### `apps/api/src/events.ts` — merging both registries

```typescript
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from './platform/events';
import { DOMAIN_EVENTS, DomainEventPayloadMap } from './domain/events';

export const EVENTS = {
  ...PLATFORM_EVENTS,
  ...DOMAIN_EVENTS,
} as const;

export type EventPayloadMap = PlatformEventPayloadMap & DomainEventPayloadMap;
```

Both `platform/` and `domain/` import event names from `EVENTS` (not directly from `PLATFORM_EVENTS`/`DOMAIN_EVENTS`), so there is one consistent source in the codebase. `EventPayloadMap` provides the foundation for a fully typed wrapper around `EventEmitter2` (e.g. `emitTyped<K extends keyof EventPayloadMap>(event: K, payload: EventPayloadMap[K])`) — a natural next step, deliberately not described here so as not to go beyond the registry itself.

---

## 1. Foundation / identity

### `health`
**Does:** exposes `/health`, `/ready`.
**Depends on:** —
**Emits:** nothing (purely polled, not event-driven).

### `logging`
**Does:** structured logging, correlation ID per request, request context propagated via DI (request-scoped).
**Depends on:** —
**Emits:** nothing directly — other modules write through `logging`, it does not generate domain events itself.

### `security`
**Does:** Helmet (CSP, X-Frame-Options, HSTS), CORS configuration (origin allowlist), a global strict validation pipe (`whitelist: true, forbidNonWhitelisted: true`), a CSRF guard (optional, for cookie-based sessions), field-level encryption (`@Encrypted()` on an entity field, AES-256-GCM), central configuration of secure cookies.
**Depends on:** `secrets` (master key for field encryption), `logging` (rejected requests get logged).
**Emits:** `security.requestRejected` → `{ reason: string, path: string, ip: string }` (validation/CSRF rejected the request — consumed by `audit`).
**Does NOT:** duplicate `auth`/`rbac`/`rate-limiting`/`pii-redaction`/`audit`/`password-policy` — it only catches request-level hardening that no other module covers thematically. Full checklist in `dcms-security-hardening.md`.

### `secrets`
**Does:** management and rotation of keys/secrets — external provider API keys, JWT signing key, the master key for `security.encryption`.
**Depends on:** —
**Emits:** `secrets.rotated` → `{ secretName: string, rotatedAt: Date }`.

### `auth`
**Does:** login, OAuth (Google/LinkedIn), sessions/JWT, guards; optionally MFA as a config extension (`mfa: { enabled, methods }`), not a separate module.
**Depends on:** `secrets` (JWT signing key).
**Emits:**
- `auth.user.registered` → `{ userId: string, email: string, tenantId: string }`
- `auth.user.loggedIn` → `{ userId: string, tenantId: string, method: 'password' | 'oauth' | 'mfa' }`
- `auth.user.loginFailed` → `{ email: string, reason: string, ip: string }` (consumed by `audit`, a candidate for anomaly alerting)
**Does NOT:** contain `rbac` logic (role assignment) or session control beyond issuing the token itself — that's `sessions`.

### `sessions`
**Does:** active session control, remote revoke ("sign out everywhere"), refresh token rotation (new one on every use, old one invalidated), revocation list.
**Depends on:** `auth`.
**Emits:** `session.revoked` → `{ userId: string, sessionId: string, revokedBy: 'user' | 'admin' | 'system' }`.

### `rbac`
**Does:** roles and permissions, guard (`@Roles()`/`@RequirePermission()`).
**Depends on:** `auth`.
**Emits:** `rbac.roleAssigned` → `{ userId: string, tenantId: string, role: string }`.

### `tenants`
**Does:** per-organization data isolation, `TenantContextService` for injecting context (request-scoped).
**Depends on:** `auth`, `rbac`.
**Emits:** `tenant.created` → `{ tenantId: string, name: string, plan: string }`.

### `api-keys`
**Does:** generation/rotation of API keys for B2B integrations (e.g. the future embeddable widget/partner API from the v2+ domain plan).
**Depends on:** `auth`, `rbac`, `tenants`.
**Emits:** `apiKey.created` → `{ tenantId: string, keyId: string, scopes: string[] }`, `apiKey.revoked` → `{ tenantId: string, keyId: string }`.

---

## 2. Business operations

### `rate-limiting`
**Does:** throttling per user/tenant/API key.
**Depends on:** `tenants` (per-tenant limits).
**Emits:** `rateLimit.exceeded` → `{ tenantId: string, key: string, limit: number }`.

### `idempotency`
**Does:** protection against duplicate operations (idempotency keys, typically the `Idempotency-Key` header).
**Depends on:** —
**Emits:** nothing — acts as a transparent interceptor/middleware.

### `file-storage`
**Does:** file storage with per-tenant isolation (e.g. uploading contract scans in `domain/contracts`).
**Depends on:** `tenants`.
**Emits:** `file.uploaded` → `{ tenantId: string, fileId: string, sizeBytes: number, mimeType: string }`, `file.deleted` → `{ tenantId: string, fileId: string }`.

### `notifications`
**Does:** sending transactional/system emails (welcome, password reset, reminders — triggered by `domain/notifications-reminders`, not generated by itself).
**Depends on:** `secrets` (mail provider key), `tenants`.
**Emits:** `notification.sent` → `{ tenantId: string, channel: 'email' | 'sms', recipient: string, template: string }`, `notification.failed` → `{ tenantId: string, reason: string }`.

### `consent`
**Does:** an explicit record of consent to data processing (GDPR), versioning of consent text.
**Depends on:** `tenants`.
**Emits:** `consent.granted` → `{ tenantId: string, userId: string, consentType: string, version: string }`, `consent.revoked` → `{ tenantId: string, userId: string, consentType: string }`.

### `webhooks-inbound`
**Does:** receiving and verifying webhook signatures from external providers (Stripe, etc.) before the event reaches a consumer (e.g. `billing`).
**Depends on:** `secrets` (signature verification).
**Emits:** `webhook.received` → `{ provider: string, eventType: string, verified: boolean }`.

### `billing`
**Does:** subscriptions, plans, payment integration (Stripe as the first provider).
**Depends on:** `tenants`, `webhooks-inbound`, `notifications`.
**Emits:** `billing.subscription.updated` → `{ tenantId: string, plan: string, status: string }`.

### `usage-metering`
**Does:** generic usage counting (`units`) against a plan, with no domain knowledge of what the unit represents (`domain/` defines whether it's number of contracts, API calls, etc.).
**Depends on:** `billing`, `tenants`.
**Emits:** `usage.limitExceeded` → `{ tenantId: string, metric: string, limit: number, current: number }`.

### `feature-flags`
**Does:** per-tenant feature flags.
**Depends on:** `tenants`.
**Emits:** `featureFlag.toggled` → `{ tenantId: string, flagKey: string, enabled: boolean }`.

---

## 3. Resilience and observability

### `circuit-breaker`
**Does:** protection against external provider outages (Stripe, mail provider, a future domain `ai-gateway`).
**Depends on:** —
**Emits:** `circuitBreaker.opened` → `{ provider: string }`, `circuitBreaker.closed` → `{ provider: string }`.

### `dead-letter-queue`
**Does:** handling of events/jobs that failed after retries are exhausted.
**Depends on:** `circuit-breaker`.
**Emits:** `deadLetter.added` → `{ originalEvent: string, payload: unknown, failureReason: string }`.

### `webhooks` (outbound)
**Does:** delivery of outbound notifications with HMAC signing (e.g. future partner integrations from `domain/integrations`).
**Depends on:** `secrets` (HMAC signing), `dead-letter-queue` (fallback on delivery failure).
**Emits:** `webhook.delivered` → `{ tenantId: string, url: string, statusCode: number }`, `webhook.deliveryFailed` → `{ tenantId: string, url: string, attempt: number }`.

### `observability`
**Does:** metrics + tracing (OpenTelemetry).
**Depends on:** —
**Emits:** nothing domain-related — exposes data to an external monitoring system.

### `scheduler`
**Does:** recurring jobs (cleanup, reports, periodic key rotation — the trigger for `secrets.rotated`).
**Depends on:** —
**Emits:** `scheduler.jobCompleted` → `{ jobName: string, durationMs: number }`, `scheduler.jobFailed` → `{ jobName: string, reason: string }`.

---

## 4. Compliance and trust

### `audit`
**Does:** a wildcard listener on all events in the application (platform and domain), writing to an immutable audit log.
**Depends on:** all previous modules (listens to their events, does not import their code).
**Emits:** `audit.entryCreated` → `{ eventName: string, actorId: string | null, tenantId: string | null, timestamp: Date }`.

### `pii-redaction`
**Does:** masking sensitive data in logs/AI prompts (plugged into `logging` and a future domain `ai-gateway`).
**Depends on:** `secrets`, `audit`.
**Emits:** nothing — acts as a data transformer before writing/sending, not an event generator.

### `data-retention`
**Does:** data retention/deletion policies (GDPR) — knows what and when to delete based on data from the modules below.
**Depends on:** `tenants`, `consent`, `file-storage`.
**Emits:** `dataRetention.purged` → `{ tenantId: string, resourceType: string, resourceId: string }`.

### `impersonation`
**Does:** secure admin login as a user, with a full log of the action.
**Depends on:** `auth`, `rbac`, `audit`.
**Emits:** `impersonation.started` → `{ adminId: string, targetUserId: string, tenantId: string }`, `impersonation.ended` → `{ adminId: string, targetUserId: string }`.

### `password-policy`
**Does:** password strength, lockout after failed attempts — an extension of `auth`, not a separate cross-cutting concept, but its own configuration module.
**Depends on:** `auth`.
**Emits:** `password.lockedOut` → `{ userId: string, failedAttempts: number }`.

### `api-versioning`
**Does:** support for public API versioning (URI/header-based).
**Depends on:** —
**Emits:** nothing.

### `swagger`
**Does:** OpenAPI configuration for the consumer.
**Depends on:** all modules with public endpoints (reads their metadata, does not import their logic).
**Emits:** nothing.

### `sandbox`
**Does:** a test mode for B2B integrators, without consuming real limits/billing.
**Depends on:** `billing`, `tenants`.
**Emits:** `sandbox.actionSimulated` → `{ tenantId: string, action: string }`.

---

## 5. Scale (v2+)

### `maintenance-mode`
**Does:** controlled traffic shutdown during an incident/migration.
**Depends on:** —
**Emits:** `maintenanceMode.enabled` / `maintenanceMode.disabled` → `{ reason: string }`.

### `search`
**Does:** full-text search (built only on a real signal from `domain/`, not upfront).
**Depends on:** depends on what needs to be searchable — decided during implementation.
**Emits:** nothing domain-related — a query service, not an event generator.

### `analytics-ingestion`
**Does:** collecting product metrics beyond its own `observability` (business data, not infrastructure data).
**Depends on:** —
**Emits:** nothing — consumes events from other modules, does not generate its own.

### `backup-dr`
**Does:** hooks/interfaces for backup and disaster recovery, with a requirement to encrypt backups.
**Depends on:** —
**Emits:** `backup.completed` → `{ backupId: string, sizeBytes: number, encrypted: boolean }`, `backup.failed` → `{ reason: string }`.
