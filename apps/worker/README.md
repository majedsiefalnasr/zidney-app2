# @zidney/worker

## Purpose

Background job processor for the Zidney platform. Handles asynchronous tasks that must not block the
HTTP request cycle: tenant schema provisioning, attempt finalization, grading, snapshot jobs, and
dead-letter queue (DLQ) management.

---

## Responsibilities

- Dequeue and execute jobs from Redis-backed task queues
- Run **tenant schema provisioning** (9-step migration pipeline with checkpoints)
- **Finalize and grade exam attempts** after submission
- Manage **DLQ** — capture failed jobs after max retries, emit alerts
- Emit structured metrics (`provisioning_duration_ms`, throughput counters)
- All jobs are **idempotent** — safe to replay on crash/restart
- Retry with exponential backoff (2s → 64s, up to 5 retries)

---

## Dependencies

| Package               | Role                                                               |
| --------------------- | ------------------------------------------------------------------ |
| `@zidney/domain-core` | Domain services (provisioning, grading, license state transitions) |
| `@zidney/logger`      | Structured logging with `correlation_id`                           |
| `@zidney/config`      | Environment variable access                                        |
| `@zidney/redis-utils` | Queue consumer helpers, lock primitives                            |
| `@zidney/types`       | Shared TypeScript job types                                        |
| `pg`                  | PostgreSQL connection (tenant schema creation)                     |
| `ioredis`             | Redis queue + distributed lock client                              |

---

## How to Run Tests

```bash
# From repo root — run all worker unit tests (excludes load tests)
bun run test run --project worker

# From this directory
bun run test
bun run test:unit

# Load tests (require Redis + PostgreSQL; run separately)
bun run test run --dir tests/load
```

> Load tests (`tests/load/`, `tests/load-testing.test.ts`) are excluded from the standard unit
> runner. Run them explicitly with a full infrastructure stack.

---

## Environment Variables

| Variable             | Description                                   | Required |
| -------------------- | --------------------------------------------- | -------- |
| `DATABASE_URL`       | Master PostgreSQL connection string           | Yes      |
| `REDIS_URL`          | Redis connection string                       | Yes      |
| `WORKER_CONCURRENCY` | Job concurrency limit (default: `5`)          | No       |
| `WORKER_TIMEOUT_MS`  | Per-job processing timeout (default: `60000`) | No       |
| `WORKER_MAX_RETRIES` | Max retry attempts before DLQ (default: `5`)  | No       |
| `LOG_LEVEL`          | `debug` \| `info` \| `warn` \| `error`        | No       |
| `NODE_ENV`           | `development` \| `production` \| `test`       | No       |

---

## Known Boundaries

- **No HTTP routes** — worker is headless; communicates only via Redis queues
- **No direct UI communication** — state changes are persisted to DB; frontends poll via API
- **No client-side grading** — server is authoritative for all grading calculations
- **Server time is authoritative** — never trust client-reported attempt timestamps
- **Import rule**: may import from `packages/*`, must not import from other `apps/*`
