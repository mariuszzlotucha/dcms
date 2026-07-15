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
