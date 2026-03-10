# zidney-app2 Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-15

## Active Technologies

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

- 013-affiliates: Added TypeScript (Node.js) + Bun runtime + Hono (web framework), PostgreSQL (via
  node-pg), Drizzle ORM, Zod (validation), Pino (structured logging), Redis (for user session state
  and rate limiting)

- 001-multi-tenancy-architecture: Added TypeScript/Bun + Hono, Postgres, Bun runtime

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
