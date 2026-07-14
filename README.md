# DCMS — Digital Contract Management System

A microSaaS platform for SMEs and independent professionals to create, negotiate, e-sign, and track digital contracts — with built-in compliance (GDPR, eIDAS) and audit trails.

![CI](https://github.com/mariuszzlotucha/dcms/actions/workflows/ci.yml/badge.svg)

> **Status:** early-stage, actively developed portfolio project. Proprietary — see [`LICENSE`](./LICENSE).

---

## Why this project

This repo is a deliberate exercise in building a SaaS product the way a small, focused engineering team would: a **clean separation between reusable, cross-cutting infrastructure and product-specific business logic**, an **event-driven backend**, and a **monorepo that keeps the whole stack — API, web client, and shared contracts — in lockstep** without the overhead of internal npm packages.

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
| **Contains** | Cross-cutting, generic capabilities: auth, billing, tenants, RBAC, feature flags, audit, rate limiting, and more | Product-specific logic: contract lifecycle management, e-signature, negotiation/approval, compliance reporting, analytics |
| **Knows about** | Nothing product-specific — could be lifted into any other SaaS product | Everything specific to DCMS |
| **Communicates via** | Emits typed platform events | Listens to platform events *and* its own domain events |

This boundary is not just documentation — it's **enforced by ESLint (`eslint-plugin-boundaries`)** on every push: `domain` may import from `platform`, never the other way around.

**Event-driven core:** the backend uses `@nestjs/event-emitter` for in-process pub/sub between platform and domain modules. Modules don't call each other directly — they emit and listen to well-defined, typed events, keeping each module independently understandable and testable.

**One repo, no fake packages:** `platform/` and `domain/` are plain folders, not internally-published npm packages requiring a sync/versioning workflow. The only genuinely shared artifact — `shared/contracts/` (zod schemas + platform event contracts) — lives at the repo root and is imported by relative path from both `apps/api` and `apps/web`, so a DTO change and its corresponding frontend type update travel in a single commit.

## Tech stack

| Layer | Choice |
|---|---|
| Backend | NestJS, `@nestjs/event-emitter`, TypeORM |
| Database | PostgreSQL |
| Frontend | React, Vite, TanStack Query, Zustand |
| Contracts | Zod (shared between backend and frontend) |
| Linting | ESLint with architectural boundary enforcement |
| Tooling | npm workspaces (single install, two independently deployable apps) |
| CI | GitHub Actions — path-based, only builds/tests what changed |

## Getting started

```bash
npm install          # single install for both apps, from the repo root
npm run dev:api       # apps/api  — NestJS, watch mode
npm run dev:web       # apps/web  — Vite dev server
```

See `apps/api/.env.example` for required environment variables.

## Security

See [`SECURITY.md`](./SECURITY.md) for how to report a vulnerability.

## License

Proprietary — All Rights Reserved. This repository is public for portfolio and demonstration purposes only. See [`LICENSE`](./LICENSE) for details.
