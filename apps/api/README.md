# @zidney/api

## Purpose

REST API backend for the Zidney platform, built with [Bun](https://bun.sh) and
[Hono](https://hono.dev). Responsible for all HTTP routing, tenant resolution, license enforcement,
and orchestration of domain packages.

---

## Responsibilities

- Receive and route all HTTP requests
- Execute **tenant resolver middleware** (slug → connection pool → DB context)
- Execute **license middleware** (status + schema + product version validation)
- Delegate business logic to `packages/domain-core` and other domain packages
- Return structured API responses: `{ success, data, error }`
- Propagate `correlation_id` through all request-scoped logs

---

## Dependencies

| Package                   | Role                                               |
| ------------------------- | -------------------------------------------------- |
| `hono`                    | HTTP routing framework                             |
| `@zidney/domain-core`     | Business logic (auth, tenants, licenses, attempts) |
| `@zidney/logger`          | Structured logging                                 |
| `@zidney/config`          | Environment variable access                        |
| `@zidney/validation`      | Zod-based request validation                       |
| `@zidney/types`           | Shared TypeScript types                            |
| `pg`                      | PostgreSQL connection pool (per-tenant)            |
| `ioredis`                 | Redis client (rate limiting, sessions)             |
| `jsonwebtoken` / `bcrypt` | JWT issuance & password hashing                    |

---

## How to Run Tests

```bash
# From repo root — run all API tests (unit + integration)
bun run test run --project api

# From this directory
bun run test
bun run test:unit
bun run test:integration

# Full integration suite (requires PostgreSQL + Redis)
docker compose -f docker-compose.test.yml up -d
bun run test:integration
```

> Integration tests require `TEST_DATABASE_URL` and `TEST_REDIS_URL` environment variables (see
> `.env.test.example`).

---

## Environment Variables

| Variable                | Description                                           | Required |
| ----------------------- | ----------------------------------------------------- | -------- |
| `DATABASE_URL`          | Master (MMC) PostgreSQL connection string             | Yes      |
| `REDIS_URL`             | Redis connection string                               | Yes      |
| `JWT_SECRET`            | Secret for JWT signing                                | Yes      |
| `API_PORT`              | HTTP listen port (default: `3000`)                    | No       |
| `NODE_ENV`              | `development` \| `production` \| `test`               | No       |
| `LOG_LEVEL`             | `debug` \| `info` \| `warn` \| `error`                | No       |
| `CORRELATION_ID_HEADER` | Header name for tracing (default: `x-correlation-id`) | No       |

---

## Known Boundaries

- **No business logic in route handlers** — all logic lives in `packages/domain-core`
- **No DB access without tenant resolver** — all queries must originate from resolver context
- **No global DB singleton** — connection pools are created per-tenant and stored in an in-memory
  map
- **No secrets in code** — all sensitive values come from environment variables or Docker secrets
- **Import rule**: may import from `packages/*`, must not import from other `apps/*`
