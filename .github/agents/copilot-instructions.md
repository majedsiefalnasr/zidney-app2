# zidney-app2 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-15

## Active Technologies
- TypeScript on Bun runtime (repository standard scripts) + Bun CLI, Node fs/path APIs, repository governance scripts (`scripts/ai-guard.ts`, `scripts/type-safety-guard.ts`, `scripts/infra-audit.ts`, `scripts/generate-ai-context.ts`) (infra-013-unified-architecture-guard)
- File-system generated artifacts in `docs/architecture/*`, `docs/ai/context/*`, and stage docs under `specs/runtime/infra-013-unified-architecture-guard/` (infra-013-unified-architecture-guard)

- TypeScript (Node.js) + Bun runtime + Hono (web framework), PostgreSQL (via node-pg), Drizzle ORM,
  Zod (validation), Pino (structured logging), Redis (for user session state and rate limiting)
  (013-affiliates)
- PostgreSQL master_db (new tables: `affiliates`, `affiliate_usages`, `affiliate_admin_audit`)
  (013-affiliates)

- TypeScript/Bun + Hono, Postgres, Bun runtime (001-multi-tenancy-architecture)

## Project Structure

```text
backend/
frontend/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript/Bun: Follow standard conventions

## Recent Changes
- infra-013-unified-architecture-guard: Added TypeScript on Bun runtime (repository standard scripts) + Bun CLI, Node fs/path APIs, repository governance scripts (`scripts/ai-guard.ts`, `scripts/type-safety-guard.ts`, `scripts/infra-audit.ts`, `scripts/generate-ai-context.ts`)
- 013-affiliates: Added TypeScript (Node.js) + Bun runtime + Hono (web framework), PostgreSQL (via
  node-pg), Drizzle ORM, Zod (validation), Pino (structured logging), Redis (for user session state
  and rate limiting)


<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
