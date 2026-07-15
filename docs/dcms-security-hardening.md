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
