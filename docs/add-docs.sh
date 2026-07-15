cat > dcms-domain-architecture.md << 'DCMSDOC'
# DCMS (Digital Contract Management System) — Domain Architecture `src/domain`

> Context: microSaaS for SMEs and freelancers. `src/platform` is treated as a black box (auth, api-keys, rbac, tenants, billing, usage-metering, rate-limiting, idempotency, dead-letter-queue, circuit-breaker, health, logging, observability, audit, data-retention, pii-redaction, secrets, webhooks, api-versioning, swagger, sandbox, feature-flags, backup-dr). Below is the domain layer only.

---

## 1. Domain module structure (`src/domain`)

### 1.1 `src/domain/contracts` — CLM core (Contract Lifecycle Management)
**Responsibility:** contract creation, editing, upload, lifecycle statuses (draft → in review → negotiation → approved → signed → active → expired/terminated).

- **Listens to (platform):**
  - `usage.limitExceeded` — blocks creation of new contracts/versions once the plan limit is exceeded.
  - `featureFlag.toggled` — enables/disables experimental features (e.g. AI suggestions in the editor).
  - `tenant.created` — initializes an empty contract workspace for a new tenant.
- **Emits (domain):** `contract.created`, `contract.updated`, `contract.versionCreated`, `contract.statusChanged`, `contract.submittedForApproval`, `contract.archived`, `contract.deleted`.
- **Does NOT:** manage permissions (that's `access-control`), generate signature documents (that's `esignature`), compute metrics (that's `analytics-insights`).

### 1.2 `src/domain/templates` — templates and standardization
**Responsibility:** template library (NDAs, employment agreements, etc.), configurable fields and clauses.

- **Listens to (platform):**
  - `tenant.created` — seeds a default set of starter templates for a new tenant.
  - `featureFlag.toggled` — unlocks e.g. premium/industry templates.
- **Emits:** `template.created`, `template.updated`, `template.published`, `template.clauseLibraryUpdated`.
- **Does NOT:** validate legal content (beyond field structure), handle versioning of the contract itself.

### 1.3 `src/domain/negotiation-approval` — reviews, approvals, process roles
**Responsibility:** assigning roles (owner/reviewer/approver), accept/reject/revise during the negotiation phase.

- **Listens to (platform):**
  - `auth.user.registered` — allows assigning a new user as a potential reviewer/approver in the organization.
  - `tenant.created` — initializes a default approval workflow (e.g. single-stage) for a new tenant.
- **Listens to (domain):** `contract.submittedForApproval` (from `contracts`).
- **Emits:** `approval.requested`, `approval.granted`, `approval.rejected`, `negotiation.revisionRequested`, `negotiation.roleAssigned`.
- **Does NOT:** edit contract content (delegates to `contracts`), send notifications (delegates to `notifications`).

### 1.4 `src/domain/esignature` — electronic signatures
**Responsibility:** DocuSign/Adobe Sign integration, eIDAS support, signature process lifecycle.

- **Listens to (platform):**
  - `usage.limitExceeded` — blocks new signature requests once the plan limit is exceeded.
  - `featureFlag.toggled` — controls availability of e.g. eIDAS-qualified signatures as a premium option.
- **Listens to (domain):** `approval.granted` (from `negotiation-approval`) — triggers the signature process.
- **Emits:** `esignature.requested`, `esignature.sent`, `esignature.completed`, `esignature.declined`, `esignature.expired`.
- **Does NOT:** store provider logic itself (it's a thin adapter), decide who is allowed to sign (that's `access-control`).

### 1.5 `src/domain/access-control` — roles, sharing, real-time collaboration
**Responsibility:** contract-level RBAC (not to be confused with the platform `rbac` — this is a domain overlay: who can see/edit/comment on a given contract), inviting external stakeholders, collaboration sessions.

- **Listens to (platform):**
  - `auth.user.registered` — syncs a new user with domain-level contract permissions.
  - `tenant.created` — sets a default access policy for a new tenant.
- **Emits:** `access.granted`, `access.revoked`, `collaboration.participantInvited`, `collaboration.commentAdded`, `collaboration.sessionStarted`.
- **Does NOT:** manage identity/login (that's platform `auth`/`rbac`) — only granular domain-level permissions.

### 1.6 `src/domain/compliance-reporting` — compliance logs and audit reports
**Responsibility:** aggregating domain events in a compliance context (GDPR/eIDAS), generating audit-ready reports.

- **Listens to (domain):** essentially all events from `contracts`, `esignature`, `negotiation-approval`, `access-control` (edits, approvals, signatures) — builds its own compliance trail from them.
- **Listens to (platform):** uses the platform's `audit` as the source of system event records (does not duplicate audit logic, only reads its contract/record).
- **Emits:** `complianceReport.generated`, `complianceReport.exported`.
- **Does NOT:** serve as the source of truth for logs (that's platform `audit`) — only a domain reporting layer on top of it.

### 1.7 `src/domain/analytics-insights` — dashboard and business analytics
**Responsibility:** contract status (pending signatures, expiry reminders), negotiation-time analysis, financial impact.

- **Listens to (domain):** `contract.statusChanged`, `esignature.completed`, `esignature.expired`, `negotiation.revisionRequested`.
- **Listens to (platform):**
  - `billing.subscription.updated` — correlates contract value with the tenant's plan/revenue (financial impact).
- **Emits:** `analytics.metricUpdated`, `analytics.reportGenerated`.
- **Does NOT:** store raw source data (reads from event projections), generate compliance reports (that's `compliance-reporting`).

### 1.8 `src/domain/notifications-reminders` — notifications and reminders
**Responsibility:** reminders for expiring contracts, pending signatures, approval statuses.

- **Listens to (domain):** `contract.statusChanged`, `esignature.sent`, `esignature.expired`, `approval.requested`, `negotiation.revisionRequested`.
- **Listens to (platform):** none directly — uses the platform's `webhooks`/delivery channels as infrastructure (not the platform's business events).
- **Emits:** `reminder.scheduled`, `reminder.sent`, `notification.dispatched`.
- **Does NOT:** decide the business logic of the trigger (only reacts to events), contain legal content templates.

### 1.9 `src/domain/integrations` — CRM and productivity tools
**Responsibility:** synchronization with Salesforce/HubSpot, Google Drive, Microsoft 365.

- **Listens to (domain):** `contract.statusChanged`, `contract.created`.
- **Listens to (platform):**
  - `tenant.created` — initializes an empty integration configuration for a new tenant.
  - `featureFlag.toggled` — controls integration availability as a premium/enterprise feature.
- **Emits:** `integration.syncRequested`, `integration.syncCompleted`, `integration.syncFailed`.
- **Does NOT:** store integration secrets itself (delegates to platform `secrets`), implement retry logic (delegates to platform `circuit-breaker`/`dead-letter-queue`).

---

## 2. Full list of domain events

### `contracts.*`
- `contract.created`
- `contract.updated`
- `contract.versionCreated`
- `contract.statusChanged`
- `contract.submittedForApproval`
- `contract.archived`
- `contract.deleted`

### `templates.*`
- `template.created`
- `template.updated`
- `template.published`
- `template.clauseLibraryUpdated`

### `negotiation.*` / `approval.*`
- `approval.requested`
- `approval.granted`
- `approval.rejected`
- `negotiation.revisionRequested`
- `negotiation.roleAssigned`

### `esignature.*`
- `esignature.requested`
- `esignature.sent`
- `esignature.completed`
- `esignature.declined`
- `esignature.expired`

### `access.*` / `collaboration.*`
- `access.granted`
- `access.revoked`
- `collaboration.participantInvited`
- `collaboration.commentAdded`
- `collaboration.sessionStarted`

### `complianceReport.*`
- `complianceReport.generated`
- `complianceReport.exported`

### `analytics.*`
- `analytics.metricUpdated`
- `analytics.reportGenerated`

### `notification.*` / `reminder.*`
- `reminder.scheduled`
- `reminder.sent`
- `notification.dispatched`

### `integration.*`
- `integration.syncRequested`
- `integration.syncCompleted`
- `integration.syncFailed`

---

## 3. Map: domain module → events from `src/platform`

| Domain module | Platform event | Purpose |
|---|---|---|
| `contracts` | `usage.limitExceeded` | blocks creation of new contracts/versions once the plan limit is reached |
| `contracts` | `featureFlag.toggled` | enables experimental features (e.g. AI in the editor) |
| `contracts` | `tenant.created` | initializes an empty contract workspace |
| `templates` | `tenant.created` | seeds default templates for a new tenant |
| `templates` | `featureFlag.toggled` | unlocks premium/industry templates |
| `negotiation-approval` | `auth.user.registered` | assigns a new user as a potential reviewer/approver |
| `negotiation-approval` | `tenant.created` | initializes the default approval workflow |
| `esignature` | `usage.limitExceeded` | blocks sending signature requests once the plan limit is reached |
| `esignature` | `featureFlag.toggled` | controls availability of eIDAS-qualified signatures |
| `access-control` | `auth.user.registered` | syncs a new user with domain permissions |
| `access-control` | `tenant.created` | sets the default access policy |
| `compliance-reporting` | (reads from platform `audit`) | source of event records for compliance reports |
| `analytics-insights` | `billing.subscription.updated` | correlates contract value with plan/revenue |
| `integrations` | `tenant.created` | initializes an empty integration configuration |
| `integrations` | `featureFlag.toggled` | controls integration availability as a premium feature |

---

## 4. Proposed additional features (differentiators, B2B model)

1. **AI-powered clause risk analysis** — automatically flags unusual/unfavorable terms during negotiation. Rationale: reduces the need for a lawyer on simple contracts — a key sales argument for SMEs without a legal department. *Requires a platform change:* a new field in `featureFlag.toggled` (per-tenant AI query limit) and a new billing event to bill for usage (e.g. extending `usage-metering` with an "AI calls" metric).

2. **Side-by-side redlining** — visual comparison of versions during negotiation (not just a text diff). Rationale: speeds up the negotiation cycle, key for multiple revision rounds with an external client.

3. **Automatic renewals and renegotiation (renewal automation)** — the system itself initiates the contract-extension process X days before expiry. Rationale: prevents revenue loss from neglected contracts — a measurable ROI argument for a B2B customer.

4. **Industry-specific template marketplace** — a community/curated library of industry-specific templates (IT, construction, agencies). Rationale: differentiates the product from generic CLM tools, opens an additional revenue stream (paid premium templates).

5. **Embeddable widget / API for embedding contract creation in a client's portal** — partners (e.g. invoicing platforms) can embed DCMS as white-label. Rationale: a new distribution channel (B2B2B), higher LTV. *Requires a platform change:* a mature `sandbox` (test environment for partners) and `api-versioning` (a stable public API contract).

6. **Financial forecasting for the contract portfolio** — analytics predicting revenue/costs based on active contracts. Rationale: turns DCMS from an operational tool into a decision-making tool for management — justifies a higher pricing tier.

7. **White-label branding (logo, domain, colors)** — for enterprise customers reselling the service or wanting brand consistency. Rationale: a standard requirement in the enterprise segment, raises ARPU. *Requires a platform change:* extending `tenants` with branding fields (out of scope for this prompt, but worth flagging to the platform owner).

---

## 5. Phased prioritization

### **MVP v0**
- Modules: `contracts` (basic CLM: create/edit/upload/versioning), `templates` (static library), `negotiation-approval` (single-stage workflow), `esignature` (DocuSign only), `notifications-reminders` (basic reminders).
- **Dependency on `src/platform`:** requires `auth`, `tenants`, `rbac` (basic), `billing` (simple plans), `usage-metering` (contracts/month limit) to be ready.

### **v1**
- Adds: `access-control` (real-time collaboration, external invitations), `analytics-insights` (status dashboard), `integrations` (CRM + Google Drive/MS365), `esignature` (adds Adobe Sign).
- **Dependency on `src/platform`:** requires `webhooks` (for external integrations), `feature-flags` (staged rollout of integrations), `rate-limiting` (protection against CRM sync abuse), `secrets` (storing integration tokens).
- **Monetization model:** `analytics-insights` in its basic variant (status dashboard) is part of the base plan; the advanced variant (advanced analytics) is a paid add-on — the module must check the plan tier (via `billing.subscription.updated`) and `feature-flags`, not just `usage.limitExceeded`.

### **v1.5 (enterprise trust)**
- Adds: `compliance-reporting` (full exportable audit reports), extending `esignature` with eIDAS-qualified signatures.
- **Dependency on `src/platform`:** **requires** the `audit` module to be ready (complete system event log) and `pii-redaction` (masking personal data in reports and logs), as well as `data-retention` (GDPR-compliant retention policies) and `backup-dr` (a trust/compliance requirement for enterprise customers).
- **Monetization model:** exportable compliance reports are a paid add-on (not a base-plan feature) — `compliance-reporting` must check the plan tier (via `billing.subscription.updated`) and `feature-flags` before generating/exporting a report.

### **v2+**
- Adds: AI-powered clause risk analysis, template marketplace, embeddable widget/API, portfolio financial forecasting.
- **Dependency on `src/platform`:** requires a mature `sandbox` and `api-versioning` (for the embeddable API/partners), an extension of `usage-metering` with AI metrics, and a stable `swagger` (public API documentation for integrators).

---

## 6. Event registry

Full content of both registries here (not just a reference) — so that anyone working from this document has everything at once, without switching to `dcms-platform-documentation.md`.

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

A single place with the names and payloads of all domain events from section 2 of this document. Payloads marked `TODO` are to be refined as each `domain/` module is built.

```typescript
export const DOMAIN_EVENTS = {
  CONTRACT_CREATED: 'contract.created',
  CONTRACT_UPDATED: 'contract.updated',
  CONTRACT_VERSION_CREATED: 'contract.versionCreated',
  CONTRACT_STATUS_CHANGED: 'contract.statusChanged',
  CONTRACT_SUBMITTED_FOR_APPROVAL: 'contract.submittedForApproval',
  CONTRACT_ARCHIVED: 'contract.archived',
  CONTRACT_DELETED: 'contract.deleted',
  TEMPLATE_CREATED: 'template.created',
  TEMPLATE_UPDATED: 'template.updated',
  TEMPLATE_PUBLISHED: 'template.published',
  TEMPLATE_CLAUSE_LIBRARY_UPDATED: 'template.clauseLibraryUpdated',
  APPROVAL_REQUESTED: 'approval.requested',
  APPROVAL_GRANTED: 'approval.granted',
  APPROVAL_REJECTED: 'approval.rejected',
  NEGOTIATION_REVISION_REQUESTED: 'negotiation.revisionRequested',
  NEGOTIATION_ROLE_ASSIGNED: 'negotiation.roleAssigned',
  ESIGNATURE_REQUESTED: 'esignature.requested',
  ESIGNATURE_SENT: 'esignature.sent',
  ESIGNATURE_COMPLETED: 'esignature.completed',
  ESIGNATURE_DECLINED: 'esignature.declined',
  ESIGNATURE_EXPIRED: 'esignature.expired',
  ACCESS_GRANTED: 'access.granted',
  ACCESS_REVOKED: 'access.revoked',
  COLLABORATION_PARTICIPANT_INVITED: 'collaboration.participantInvited',
  COLLABORATION_COMMENT_ADDED: 'collaboration.commentAdded',
  COLLABORATION_SESSION_STARTED: 'collaboration.sessionStarted',
  COMPLIANCE_REPORT_GENERATED: 'complianceReport.generated',
  COMPLIANCE_REPORT_EXPORTED: 'complianceReport.exported',
  ANALYTICS_METRIC_UPDATED: 'analytics.metricUpdated',
  ANALYTICS_REPORT_GENERATED: 'analytics.reportGenerated',
  REMINDER_SCHEDULED: 'reminder.scheduled',
  REMINDER_SENT: 'reminder.sent',
  NOTIFICATION_DISPATCHED: 'notification.dispatched',
  INTEGRATION_SYNC_REQUESTED: 'integration.syncRequested',
  INTEGRATION_SYNC_COMPLETED: 'integration.syncCompleted',
  INTEGRATION_SYNC_FAILED: 'integration.syncFailed',
} as const;

export interface DomainEventPayloadMap {
  [DOMAIN_EVENTS.CONTRACT_CREATED]: unknown; // TODO: refine when implementing contracts
  [DOMAIN_EVENTS.CONTRACT_UPDATED]: unknown; // TODO
  // ... the rest follows the same pattern, fill in payloads as each domain/ module is built
}
```

### Merge with the platform registry

`domain/events.ts` is not imported directly by other modules — a single merged registry in `apps/api/src/events.ts` is the rule:

```typescript
import { PLATFORM_EVENTS, PlatformEventPayloadMap } from './platform/events';
import { DOMAIN_EVENTS, DomainEventPayloadMap } from './domain/events';

export const EVENTS = {
  ...PLATFORM_EVENTS,
  ...DOMAIN_EVENTS,
} as const;

export type EventPayloadMap = PlatformEventPayloadMap & DomainEventPayloadMap;
```

Both `platform/` and `domain/` import event names from `EVENTS` (not directly from `PLATFORM_EVENTS`/`DOMAIN_EVENTS`), so there is one consistent source in the codebase. `EventPayloadMap` provides the foundation for a fully typed wrapper around `EventEmitter2` (e.g. `emitTyped<K extends keyof EventPayloadMap>(event: K, payload: EventPayloadMap[K])`) — a natural next step, intentionally not described here.

---

*Document ready as a work plan — the folder structure matches the module names in section 1 (`src/domain/<module-name>`).*
DCMSDOC
cat > dcms-platform-documentation.md << 'DCMSDOC'
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
DCMSDOC
cat > dcms-platform-development-plan.md << 'DCMSDOC'
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
DCMSDOC
cat > dcms-domain-development-plan.md << 'DCMSDOC'
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
DCMSDOC
cat > dcms-frontend-platform-documentation.md << 'DCMSDOC'
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
DCMSDOC
cat > dcms-frontend-domain-documentation.md << 'DCMSDOC'
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
DCMSDOC
cat > dcms-frontend-development-plan.md << 'DCMSDOC'
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
DCMSDOC
cat > dcms-frontend-development-guidelines.md << 'DCMSDOC'
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
DCMSDOC
cat > dcms-security-hardening.md << 'DCMSDOC'
# DCMS — The `security` Module in `apps/api/src/platform/` + Hardening Checklist

> **Correction relative to the original:** this document describes a module in `apps/api/src/platform/security/` — a local folder in the `dcms/` monorepo, not a separately published npm package. References to "before publishing" (npm publish) have been changed to "before push/commit" — repo security here concerns `dcms` itself, not a package release process. The CORS example has been updated from an example product's domain to DCMS's real deployment (Vercel).

## Is a separate `security` module even needed?

**Yes, but narrowly scoped.** A large part of security is already distributed across the existing `platform/` modules — adding everything to a single "security" module would duplicate responsibilities. First, a map of what's **already covered**, to see the real gap.

### Where security already lives in the existing module list

| Security aspect | Module that covers it |
|---|---|
| Identity, JWT, guards | `auth` |
| Authorization, least privilege | `rbac` |
| Key management/rotation | `secrets` |
| Brute-force/DoS protection | `rate-limiting` |
| Redaction of sensitive data in logs | `pii-redaction` |
| A trail of every action | `audit` |
| Password strength, lockout | `password-policy` |
| Active session control, remote revoke | `sessions` |
| Data isolation between customers (tenants) | `tenants` |
| Webhook signature verification | `webhooks-inbound`, `webhooks` (HMAC) |
| Protection against request replay | `idempotency` |
| Consent to data processing | `consent` |
| Data retention/deletion | `data-retention` |

### The real gap — what no existing module covers

These are **request-level hardening** items that don't fit thematically into any of the above, but without which the backend is genuinely vulnerable regardless of how good your auth/rbac is:

- HTTP security headers (Helmet: CSP, X-Frame-Options, HSTS, etc.)
- CORS configuration (an origin allowlist, not `*`)
- Global input validation/sanitization (DTO whitelist, rejecting unknown fields — protection against mass assignment)
- CSRF protection (where relevant — cookie-based sessions, not plain bearer JWT)
- Field-level encryption for especially sensitive data in the database (not just hashing — real field encryption, e.g. an ID document number in a contract)
- Central configuration of secure cookies (httpOnly, secure, sameSite)

This is exactly the scope of the new `security` module.

## The `security` module — structure

```
apps/api/src/platform/security/
├── security.module.ts            # forRoot(config)
├── security.config.ts            # config types
├── middleware/
│   └── helmet.middleware.ts      # a wrapper around the helmet package
├── guards/
│   └── csrf.guard.ts
├── pipes/
│   └── strict-validation.pipe.ts # whitelist: true, forbidNonWhitelisted: true
├── encryption/
│   ├── field-encryption.service.ts   # AES-256-GCM, key from the secrets module
│   └── field-encryption.decorator.ts # @Encrypted() on an entity field
└── cors/
    └── cors.config.factory.ts
```

```typescript
SecurityModule.forRoot({
  cors: { allowedOrigins: ['https://dcms.vercel.app'] },
  helmet: { contentSecurityPolicy: { /* ... */ } },
  csrf: { enabled: true }, // false if pure JWT bearer, no cookies
  cookies: { sameSite: 'strict', secure: true },
  encryption: { masterKeyFrom: 'secrets' }, // uses the secrets module, doesn't duplicate it
})
```

**Depends on:** `secrets` (encryption key), `logging` (so requests rejected by validation/CSRF get logged).

**When to build it:** this is one of the few modules that should land **earlier than in the original phased plan** — genuinely alongside `secrets`/`auth` in Phase 1, not later. Helmet, CORS, and the global validation pipe are things you want from the first playground endpoint, not added after the fact. (This has already been folded into `dcms-platform-development-plan.md` — `security` is item #3 there in Phase 1.)

## MFA/2FA — not a separate module, an extension of `auth`

Worth stating explicitly, since it sounds like "security" and might seem like a candidate for `security`: 2FA/MFA (TOTP, backup codes) logically belongs to `auth` (it's an additional step in the login process, not a separate cross-cutting concept) — add it as an extension via `auth.forRoot({ mfa: { enabled: true, methods: ['totp'] } })`, don't create a new module.

## "Maximum" hardening checklist — by layer

Things outside the NestJS code that are easy to forget because no module represents them:

### Transport / network
- TLS enforced everywhere (no HTTP fallback), HSTS with a long `max-age`.
- A reverse proxy (nginx/Caddy) terminating TLS in front of the app, not the app facing the internet directly — this applies to the VPS variant; on the Vercel/Render variant TLS is already provided by the platform.
- Firewall/security groups — the app doesn't listen on the database port publicly (applies to VPS + a self-hosted Postgres; Neon is already isolated on its own side).

### Application (outside the security module)
- Parameterized queries via the ORM (TypeORM) — never raw SQL with string interpolation.
- Output encoding wherever you render any HTML (API-only usually doesn't have this problem, but webhooks/emails with user input do).
- A request body size limit (`bodyParser` limit) — protection against DoS via huge payloads.
- Timeouts on requests to external providers (already covered via `circuit-breaker`).

### AuthN/AuthZ
- Short-lived access tokens (5–15 min) + refresh tokens with rotation (a new refresh token on every use, the old one invalidated).
- A refresh token revocation list (tied to `sessions`) — a real "sign out everywhere."
- MFA optional for regular users, required for admin roles.
- The least-privilege principle in `rbac` — the default role has minimal scope, not maximal.

### Secrets and data
- Zero secrets in the repo — `.gitignore` already covers this (`.env`), but it's worth also running a scan (gitleaks/trufflehog) **on a recurring basis in CI**, not just once on the first push.
- Field-level encryption for especially sensitive data (the `security.encryption` module above).
- Encrypted backups (the `backup-dr` module — explicitly add an encryption requirement to its config).

### Dependencies and CI
- `npm audit` / Dependabot as a CI step, not manual checking every once in a while — you already have hands-on experience with `npm audit` on this app (we worked through a real case with `file-type`/`@nestjs/common`); add Dependabot for automatic PRs bumping vulnerable dependencies (free on GitHub).
- Docker image scanning (Trivy) before deploy — only applies once the app is ever containerized (the VPS+Docker variant, which we deliberately deferred).

### Container infrastructure (if you ever go Docker)
- The app runs as a non-root user inside the container.
- A read-only filesystem wherever the app doesn't need to write anything locally.
- A minimal base image (distroless/alpine), not a full Ubuntu with unnecessary tools.

### Monitoring and response
- `audit` (already planned for Phase 4) + alerting — unusual patterns (many failed logins, impersonation outside working hours) go out as an event to `notifications`/`webhooks`, not just to a log nobody reads in real time.
- `observability` with alerts on anomalies (a sudden spike in 401/403s, a sudden spike in request size).
- A clear process: what happens when `audit` or `pii-redaction` catches something suspicious — who gets notified and how quickly (on a solo project: you, but it's worth having this written down, not just in your head).

### Process (cheapest, most often skipped)
- `SECURITY.md` in the repo with instructions on how to report a vulnerability (even as a solo dev, this is a professionalism signal for a portfolio) — folded into Phase 0 of the plan.
- Regular (not one-time) key rotation via the `secrets` module — the `secrets.rotated` event is already designed conceptually; make sure something actually triggers rotation on a recurring basis (a candidate for `scheduler`).

## Rollout priority relative to the phased plan

| What | When |
|---|---|
| `security` (Helmet, CORS, strict validation pipe) | **Phase 1**, together with `auth`/`secrets` — not later |
| MFA as an extension of `auth` | Phase 1 or Phase 4 (enterprise trust) — depending on whether you want it from the start or as a trust upsell |
| Field-level encryption | Phase 2–3, once there is real sensitive data to protect |
| Dependency scanning in CI, `SECURITY.md` | **Phase 0** — this is repo config, not code, cheap to do right away |
| Container hardening | Once you actually containerize for deployment (the VPS+Docker variant), independent of the module phases |
| Anomaly alerting from `audit` | Phase 4, together with the rest of enterprise trust |
DCMSDOC
echo "Created 9 English documentation/plan files."
