# Zidney Development Guidelines

Auto-generated from project configuration. Last updated: 2026-03-20

## Platform Identity

Zidney is a stability-first, exam-centric, white-label B2B2C Educational SaaS platform.

## Active Technologies

- **Runtime:** Bun
- **Backend:** TypeScript + Hono (web framework)
- **Database:** PostgreSQL (database-per-tenant) + Drizzle ORM
- **Validation:** Zod
- **Logging:** Pino (structured logging)
- **Caching/Sessions:** Redis
- **Frontend:** Vue 3 + TypeScript + Vite
- **UI System:** shadcn-vue + Reka UI + Tailwind CSS v4
- **Testing:** Vitest (unit/integration) + Playwright (E2E)
- **Linting:** Biome

## Project Structure

```text
apps/
  api/          # Bun + Hono backend (server-side authority)
  backoffice/   # Vue 3 institutional control panel
  frontoffice/  # Vue 3 student runtime
  mmc/          # Vue 3 platform control panel
  worker/       # Background job processor

packages/
  api-client/   # Typed API client
  config/       # Shared configuration
  domain-core/  # Business logic (pure functions)
  job-queue/    # Job queue abstraction
  logger/       # Structured logging
  redis-utils/  # Redis utilities
  types/        # Shared TypeScript types
  ui-system/    # shadcn-vue component library
  validation/   # Zod validation schemas

specs/          # SpecKit feature specifications
scripts/        # Build, governance, and CI scripts
tests/          # Integration and E2E tests
docs/           # Architecture, ADRs, governance
```

## Commands

```bash
bun run dev           # Start development servers
bun run build         # Build all apps
bun run typecheck     # TypeScript type checking
bun run lint          # Biome lint
bun run test          # Run Vitest tests
bun run test:e2e      # Run Playwright E2E tests
```

## Architecture Rules

- Database-per-tenant isolation (no row-based multi-tenancy)
- Trust chain: Isolation → License → Authentication → Attempt → Runtime → Frontoffice
- License middleware required on all workspace routes
- Attempt configuration must be snapshotted at start
- Server time is authoritative
- All API responses: `{ success, data, error: { code, message } }`
- Structured logging with correlation_id required

## Import Boundaries

- `apps/*` may import from `packages/*`
- `packages/*` may import from `packages/*`
- `apps/*` must NOT import from other `apps/*`
- `packages/*` must NOT import from `apps/*`
- UI must NOT access database schemas or backend logic

## Code Style

- TypeScript strict mode
- Biome for formatting and linting
- shadcn-vue components for UI (no custom components when shadcn equivalent exists)
- Tailwind CSS v4 utilities for layout and spacing

## Governance

All AI development follows SpecKit Hard Mode workflow. See `AGENTS.md` for full behavioral contract.

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
