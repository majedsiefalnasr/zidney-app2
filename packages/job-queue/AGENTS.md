# packages/job-queue — AI Behavioral Contract

## Identity

Job Queue provides the **background job abstraction layer** for the Zidney Worker. It defines job contracts, queue management, and retry strategies.

## Ownership

- Job type definitions and contracts
- Queue producer/consumer abstractions
- Retry strategy configuration
- Dead-letter queue (DLQ) handling
- Job serialization/deserialization
- Idempotency key generation

## Non-Negotiable Rules

- **All jobs must be idempotent** — re-processing the same job must produce the same result
- **All jobs must include workspace context** — tenant isolation at the job level
- **Schema version must be embedded** — jobs must carry `schema_version` for compatibility
- **No direct database access** — jobs define contracts, workers execute them
- **DLQ strategy required** — every job type must define max retries and DLQ behavior

## Import Rules

Allowed:

- `packages/types` — shared type definitions
- `packages/validation` — job payload validation
- `packages/logger` — structured logging for queue operations
- `packages/redis-utils` — Redis-backed queue implementation

Forbidden:

- `apps/*` — never import from application layer
- `packages/domain-core` — job contracts are separate from business logic
- `packages/api-client` — jobs don't make HTTP calls to own API

## Patterns

- Job contract: `{ type, workspace_id, payload, idempotency_key, schema_version, created_at }`
- Retry: exponential backoff with jitter, max 3 retries, then DLQ
- All job handlers must accept a typed payload and return `{ success, result? }`

## Verdict

```
VERDICT: BLOCKED — if job lacks idempotency key or workspace context
```
