# @zidney/logger

## Purpose

Shared structured logging package for all Zidney services. Provides a consistent, JSON-compatible
logger that enforces required fields and prevents `console.log` usage across the codebase.

---

## Responsibilities

- Produce structured log records (JSON-serializable)
- Enforce required log fields: `timestamp`, `level`, `service`, `workspace_slug`, `workspace_id`,
  `user_id`, `correlation_id`, `attempt_id`
- Provide log levels: `debug`, `info`, `warn`, `error`
- Support child loggers with pre-bound context (e.g., per-request correlation ID)

---

## Dependencies

| Package                 | Role                                       |
| ----------------------- | ------------------------------------------ |
| No runtime dependencies | Logger is a zero-dep pure function package |

---

## How to Run Tests

```bash
# From repo root
bun run test run --project logger

# From this directory
bun run test
```

---

## Environment Variables

None — log level is configured by the consuming service via `createLogger` options or `LOG_LEVEL`
env var (resolved at call site).

---

## Known Boundaries

- `console.log` is **forbidden** across all services; use `logger.info` instead
- Does not write to disk — outputs to `stdout`/`stderr` only; log shipping is handled by
  infrastructure
- Does not contain HTTP logic or framework dependencies
- **Import rule**: may import from other `packages/*`, must not import from `apps/*`

---

## Public API

```typescript
import { createLogger } from "@zidney/logger";
import type { Logger, LogContext } from "@zidney/logger";

// Create a named logger for a service
const logger = createLogger("api");

// Log at different levels
logger.info("Request received", {
  correlation_id: "...",
  workspace_slug: "acme",
});
logger.warn("Rate limit approaching", { workspace_id: "...", user_id: "..." });
logger.error("Unexpected failure", { error: err, correlation_id: "..." });

// Create a child logger with bound context
const requestLogger = logger.child({
  correlation_id: req.id,
  workspace_slug: "acme",
});
requestLogger.info("Processing tenant request");
```

**Exports**: `createLogger`, `Logger`, `LogContext`, `LogLevel`
