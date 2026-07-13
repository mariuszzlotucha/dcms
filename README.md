# DCMS — Digital Contract Management System

A microSaaS platform for SMEs and independent professionals to create, negotiate, e-sign, and track digital contracts — with built-in compliance (GDPR, eIDAS) and audit trails.

> **Status:** early-stage / portfolio project. This repository demonstrates the architecture and initial scaffolding of a production-shaped SaaS system, not a finished product.

---

## Why this project

This repo is a deliberate exercise in building a SaaS product the way a small, focused engineering team would: a **clean separation between reusable, cross-cutting infrastructure and product-specific business logic**, an **event-driven backend**, and a **monorepo that keeps the whole stack — API, web client, and shared contracts — in lockstep** without the overhead of internal npm packages.

It's designed to answer a question every solo/small-team SaaS builder faces: *how do you stay fast without accumulating architectural debt?* The decisions documented below (and enforced by lint rules, not just convention) are the answer this project tries out.

## Architecture at a glance

```
dcms/
├── apps/
│   ├── api/     → NestJS backend (event-driven, @nestjs/event-emitter)
│   └── web/     → React frontend (Vite, TanStack Query, Zustand)
├── shared/
│   └── contracts/  → single source of truth for DTOs (zod), used by both apps
└── ...
```

**Core pattern — `platform/` vs `domain/`, mirrored in both apps:**

| | `platform/` | `domain/` |
|---|---|---|
| **Contains** | Cross-cutting, generic capabilities: auth, billing, tenants, RBAC, feature flags, audit, rate limiting, and 15+ more | Product-specific logic: contracts, e-signature, negotiation/approval, compliance reporting, analytics |
| **Knows about** | Nothing product-specific — could be lifted into any other SaaS product | Everything specific to DCMS |
| **Communicates via** | Emits typed platform events (`tenant.created`, `billing.subscription.updated`, `usage.limitExceeded`, ...) | Listens to platform events *and* its own domain events (`contract.statusChanged`, `esignature.completed`, ...) |

This boundary is not just documentation — it's **enforced by ESLint (`eslint-plugin-boundaries`)** on every PR: `domain` may import from `platform`, never the other way around.

**Event-driven core:** the backend uses `@nestjs/event-emitter` for in-process pub/sub between platform and domain modules (with a clear migration path to BullMQ if/when the system needs to scale past a single process). Modules don't call each other directly — they emit and listen to well-defined, typed events, which keeps the 9 domain modules (contracts, templates, negotiation-approval, e-signature, access-control, compliance-reporting, analytics-insights, notifications-reminders, integrations) independently understandable and testable.

**One repo, no fake packages:** `platform/` and `domain/` are plain folders, not internally-published npm packages requiring a sync/versioning workflow. The only genuinely shared artifact — `shared/contracts/` (zod schemas + platform event contracts) — lives at the repo root and is imported by relative path from both `apps/api` and `apps/web`, so a DTO change and its corresponding frontend type update travel in a single PR.

## Tech stack

| Layer | Choice |
|---|---|
| Backend | NestJS, `@nestjs/event-emitter` |
| Frontend | React, Vite, TanStack Query, Zustand |
| Contracts | Zod (shared between backend and frontend) |
| Linting | ESLint with architectural boundary enforcement |
| Tooling | npm workspaces (single install, two independently deployable apps) |

## Roadmap

| Phase | Adds | Platform dependency |
|---|---|---|
| **MVP v0** | Core contract lifecycle (create/edit/upload/versioning), templates, single-stage approval, DocuSign e-signature | `auth`, `tenants`, `rbac`, `billing`, `usage-metering` |
| **v1** | Real-time collaboration, dashboard analytics, CRM/Drive/M365 integrations, Adobe Sign | `webhooks`, `feature-flags`, `rate-limiting`, `secrets` |
| **v1.5 — Enterprise trust** | Exportable compliance reports, eIDAS-qualified signatures | `audit`, `pii-redaction`, `data-retention`, `backup-dr` |
| **v2+** | AI clause-risk analysis, template marketplace, embeddable partner API, portfolio forecasting | `sandbox`, `api-versioning`, `api-keys` |

## Getting started

```bash
npm install          # single install for both apps, from the repo root
npm run dev:api       # apps/api  — NestJS, watch mode
npm run dev:web       # apps/web  — Vite dev server
```

See `apps/api/.env.example` for required environment variables.

## Project structure

Full architecture write-ups (domain module responsibilities, event contracts, phased platform dependencies) live alongside this README in the project's design docs — this codebase is the implementation of that plan, built incrementally and in the open.
