# @zidney/redis-utils

## Purpose

Shared Redis utility library providing rate limiting, distributed locking, and queue helper
primitives used across the API and Worker services.

---

## Responsibilities

- **Rate limiting**: sliding window and fixed window algorithms
- **Distributed locks**: advisory lock acquisition with TTL and automatic release
- **Queue helpers**: enqueue/dequeue patterns for job queues (FIFO/LIFO)
- Abstract Redis commands into typed, composable utility functions

---

## Dependencies

| Package   | Role                                                           |
| --------- | -------------------------------------------------------------- |
| `ioredis` | Redis client (peer dependency — provided by consuming service) |

---

## How to Run Tests

```bash
# From repo root
bun run test run --project redis-utils

# From this directory
bun run test
```

> Integration tests require a running Redis instance via `TEST_REDIS_URL`.

---

## Environment Variables

None — Redis connection is provided by the consuming service as an `ioredis` client instance.

---

## Known Boundaries

- Does not manage its own Redis connections — callers must provide an `ioredis` client
- Pure utility functions with no HTTP, framework, or DB dependencies
- **Import rule**: may import from other `packages/*`, must not import from `apps/*`

---

## Public API

```typescript
import {
  createSlidingWindowRateLimiter,
  createFixedWindowRateLimiter,
  acquireLock,
  releaseLock,
  enqueue,
  dequeue,
  peekQueue,
} from "@zidney/redis-utils";
import type { RateLimitResult, LockOptions, QueueOptions } from "@zidney/redis-utils";

// Rate limiting
const limiter = createSlidingWindowRateLimiter(redis, {
  limit: 5,
  windowMs: 60_000,
});
const result: RateLimitResult = await limiter.check("user:123");

// Distributed locks
const lock = await acquireLock(redis, "provision:workspace:acme", {
  ttlMs: 30_000,
});
await releaseLock(redis, lock);

// Queue operations
await enqueue(redis, "jobs:provision", jobPayload);
const job = await dequeue(redis, "jobs:provision");
```

**Exports**: `createSlidingWindowRateLimiter`, `createFixedWindowRateLimiter`, `acquireLock`,
`releaseLock`, `enqueue`, `dequeue`, `peekQueue`, `RateLimitResult`, `LockOptions`, `QueueOptions`
