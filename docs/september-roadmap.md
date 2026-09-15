# September Roadmap — Platform Module Improvements

Suggestions for platform module work, based on a review of the actual module tree (`apps/api/src/platform`, `apps/web/src/platform`) against `docs/dcms-platform-development-plan.md` and `docs/dcms-frontend-development-plan.md`. These are candidates to discuss/prioritize, not committed work.

## Gaps against the existing plan

- **`impersonation` doesn't exist on the backend at all** — not even a `.gitkeep` stub — yet `apps/web/src/platform/ui/components/ImpersonationBanner` is already built and presumably wired to nothing real. Either build the backend module (admin-login-as-user + full audit trail via the `audit` wildcard listener) or the banner is dead UI.
- **`api-versioning`, `sandbox`, `backup-dr` are empty stub directories** (`.gitkeep` only). If B2B integrators are coming soon, `sandbox` (test mode without touching real billing/limits) and `api-versioning` (needed before safely evolving any public contract) are worth prioritizing over `backup-dr`, which is infra-adjacent and can wait for a Neon backup story instead of app code.

## Improvements to existing mature modules

- **`rate-limiting` + `circuit-breaker` + `dead-letter-queue`** are all built independently — check whether DLQ replay is actually wired to circuit-breaker recovery (i.e., does a closing breaker trigger a DLQ drain?), since that's the usual missing link between these three.
- **`feature-flags` + `billing`/`usage-metering`** — confirm flags can be gated by usage thresholds, not just plan tier (e.g., auto-disable a feature when a metered quota is exceeded, not just when the tier lacks it). Common gap when modules are built in separate phases.
- **`secrets`** — check whether rotation is actually scheduled via the `scheduler` module (the plan calls for "periodic key rotation" under scheduler) or whether rotation is still manual-only.
- **`audit`** — since it's a wildcard listener on all events, verify newly added domain events (contracts, negotiation, e-signature) are actually flowing through it. Audit modules silently go stale as new event types get added without anyone updating a listener that "just listens to everything" in theory.
- **`pii-redaction`** — confirm it's applied not just to logs but to any AI-facing prompts if/when contract text gets sent to an LLM for clause analysis (a Phase 5 signal in the domain plan). Redaction added after that ships is a much bigger retrofit.

## Frontend platform gaps

- **No `client/queries/notifications`** — only `in-app-notifications` exists. If transactional email status/preferences ever need a UI, that's a separate query set.
- **No `client/queries/webhooks`** — if `webhooks` (outbound) ever needs a tenant-facing "manage your webhook endpoints" screen (common for B2B), that's currently unbuilt on both sides.
- **`data-export` queries exist but there's no corresponding backend module** in the platform list — same pattern as the impersonation mismatch: frontend built ahead of backend. Check whether `data-export` is meant to live inside `data-retention` (GDPR portability) rather than as its own thing.

## New Phase 5 candidates (build on signal only, per the plan's own rule)

- **`search`** — full-text search across contracts/clauses is the most likely of the three to get real demand once `domain/contracts` has volume. Watch for the signal rather than pre-building.
- **`maintenance-mode`** — cheap to build (a flag + a 503 middleware) and pays off the first time a DB migration window is needed. Low cost relative to the other two, so a reasonable exception to build slightly ahead of signal.
- **`analytics-ingestion`** — hold off. `observability` already covers metrics/tracing, and product analytics usually piggybacks on an existing tool (PostHog/Amplitude) rather than a bespoke platform module.

## NestJS building blocks — audit of Middleware / Guards / Interceptors / Exception Filters / Decorators / DTO

Verified by grepping `apps/api/src` for actual implementations (`implements NestMiddleware/CanActivate/NestInterceptor/ExceptionFilter/PipeTransform`, `createParamDecorator`, `SetMetadata`), not just directory names.

- **Middleware** — only one: `platform/security/middleware/helmet.middleware.ts`. Correlation ID/request logging is handled by `nestjs-pino` automatically, so that's not a gap. Real gap: **no middleware for `tenants`** — `TenantContextService` reads `x-tenant-id` as an injected `REQUEST`-scoped service, so there's no point that rejects a request missing the tenant header before it reaches guards/controllers.
- **Guards** — well covered: `roles.guard.ts`, `csrf.guard.ts`, `refresh-token.guard.ts`, `api-key.guard.ts`, `jwt-auth.guard.ts`, `oauth.guard.ts`, `tenant-throttler.guard.ts`. No action needed here.
- **Interceptors** — only one: `platform/idempotency/interceptors/idempotency.interceptor.ts`. Missing: a global response-time/logging interceptor, and an interceptor-based approach to `usage-metering` (count usage per-request via interceptor instead of manually inside domain services).
- **Exception Filters** — only one: `platform/security/filters/validation-rejection.filter.ts` (validation errors only). **Missing a global `AllExceptionsFilter`** to normalize the error response shape for unhandled exceptions — e.g. a TypeORM `QueryFailedError` currently has no filter and could leak a raw SQL error as a 500. This is the most concrete gap of the six categories.
- **Decorators** — partial gap. Only `@Roles()` (`platform/rbac/decorators/roles.decorator.ts`, `SetMetadata`-based) exists. **Zero custom param decorators** (`createParamDecorator`) anywhere in the repo — every domain controller (`contracts.controller.ts`, `templates.controller.ts`, `access-control.controller.ts`, `negotiation-approval.controller.ts`, ...) repeats `@Req() request: Request` and then manually pulls the user/tenant off it. `@CurrentUser()` and `@CurrentTenant()` decorators would remove this repeated pattern.
- **DTO** — mostly correct (10 zod schemas in `shared/contracts/*.schema.ts`, per convention), but **`platform/auth/auth.controller.ts` defines `RegisterDto`/`LoginDto` locally using `class-validator`** instead of the shared zod contracts. This is the only place in the API using `class-validator` at all, and it directly violates the repo's own rule in `dcms/CLAUDE.md`: "DTOs live in `shared/contracts/*.schema.ts` (zod). Never redefine a type locally that duplicates a shared DTO." Should be migrated to a shared zod schema for consistency.

**Priority pick from this section:** the missing `AllExceptionsFilter` and the local `class-validator` DTOs in `auth` are actual inconsistencies against existing conventions, not just missing nice-to-haves — worth fixing before adding the missing interceptors/decorators.
