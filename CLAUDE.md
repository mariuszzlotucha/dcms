# DCMS — Digital Contract Management System

Monorepo: `apps/api` (NestJS backend) + `apps/web` (React/Vite frontend) + `shared/contracts` (zod DTOs, single source of truth for both apps).

## How to work in this repo

| Task type | Auto-loaded rule | Full reference (read on request) |
|---|---|---|
| `apps/api/src/platform/**` | `.claude/rules/platform-backend.md` | `dcms-platform-dokumentacja.md` |
| `apps/api/src/domain/**` | `.claude/rules/domain-backend.md` | `dcms-architektura-domenowa.md` |
| `apps/web/src/platform/**` | `.claude/rules/platform-frontend.md` | `dcms-frontend-platform-dokumentacja.md` |
| `apps/web/src/domain/**` | `.claude/rules/domain-frontend.md` | `dcms-frontend-domain-dokumentacja.md` |
| Build order / what's next | — | `dcms-platform-plan-i-dokumentacja.md`, `dcms-domain-plan-developmentu.md`, `dcms-frontend-plan-developmentu.md` |
| Security posture | — | `dcms-platform-security-i-hardening.md` |

Plans and phasing docs are intentionally NOT auto-loaded — read them explicitly when asked "what's next" or "build the next module." They change too often to live in memory.

## Non-negotiable invariants (apply everywhere)

- **`platform/` never imports from `domain/`.** Enforced by ESLint boundaries (`eslint.config.js`). Never add an import that violates this, even temporarily.
- **`domain → domain` direct imports are technically ESLint-legal but forbidden by convention.** Cross-module domain communication goes through events or queries/props, never a direct import of another module's internals.
- **Platform modules never read `process.env` directly.** Config is injected via `forRoot(config)` / `forRootAsync({ useFactory, inject })`. The consumer (`app.module.ts`) owns config resolution.
- **`EventEmitterModule.forRoot()` is called exactly once**, in `apps/api/src/app/app.module.ts`. No platform module calls it.
- **Event names and payload types are never magic strings.** Always import from `apps/api/src/events.ts` (merged `EVENTS` + `EventPayloadMap`, combining `platform/events.ts` and `domain/events.ts`).
- **Frontend: server state → TanStack Query (`platform/client/queries`), client state → Zustand (`platform/client/stores`).** Never cache server data in a Zustand store "for convenience."
- **Frontend: no `platform/client/`-style split inside `domain/` modules.** Domain modules stay flat; add `queries/`, `realtime/`, `store.ts` only when there's more than one file of that kind.
- **DTOs live in `shared/contracts/*.schema.ts` (zod).** Never redefine a type locally that duplicates a shared DTO.

## Tech stack

NestJS + TypeORM + PostgreSQL (backend) · React + Vite + TanStack Query + Zustand (frontend) · Zod (shared contracts) · npm workspaces · ESLint boundaries · GitHub Actions CI (path-filtered).

## Commands

```bash
npm install              # root only — covers both apps via workspaces
npm run dev:api           # apps/api, watch mode
npm run dev:web           # apps/web, Vite dev server
npm run lint
npm run typecheck
npm run build
npm run test
```

## Deployment targets

`apps/web` → Vercel · `apps/api` → Render · Database → Neon (PostgreSQL, free tier, no expiration).
