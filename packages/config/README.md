# @zidney/config

## Purpose

Centralized environment variable parsing and validation package. Ensures all services access
configuration through a typed, validated schema rather than raw `process.env` access.

---

## Responsibilities

- Parse and validate environment variables at startup
- Provide typed config accessors for each service domain (database, Redis, JWT, ports)
- Fail fast at startup if required environment variables are missing or malformed
- Never expose secrets to client-side code

---

## Dependencies

| Package | Role                                              |
| ------- | ------------------------------------------------- |
| `zod`   | Runtime validation of environment variable values |

---

## How to Run Tests

```bash
# From repo root
bun run vitest run --project config

# From this directory
bun run test
```

---

## Environment Variables

This package reads and validates the following variables when imported:

| Variable       | Description                         | Required |
| -------------- | ----------------------------------- | -------- |
| `DATABASE_URL` | Master PostgreSQL connection string | Yes      |
| `REDIS_URL`    | Redis connection string             | Yes      |
| `JWT_SECRET`   | JWT signing secret                  | Yes      |
| `API_PORT`     | API listen port (default: `3000`)   | No       |
| `NODE_ENV`     | Runtime environment                 | No       |
| `LOG_LEVEL`    | Log verbosity                       | No       |

---

## Known Boundaries

- **No secrets exposed to frontend** — this package is server-side only
- Does not write to disk or call external services
- Does not contain HTTP or framework logic
- **Import rule**: may import from other `packages/*`, must not import from `apps/*`

---

## Public API

```typescript
import { config } from "@zidney/config";
import type { AppConfig } from "@zidney/config";

// Access validated config values
const port = config.api.port; // number
const dbUrl = config.database.url; // string
const redisUrl = config.redis.url; // string
const jwtSecret = config.jwt.secret; // string
const logLevel = config.logging.level; // 'debug' | 'info' | 'warn' | 'error'
```

**Exports**: `config`, `AppConfig`, `DatabaseConfig`, `RedisConfig`, `JwtConfig`, individual Zod
schema exports for per-service partial validation
