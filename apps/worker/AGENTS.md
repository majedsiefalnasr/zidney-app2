# Zidney Worker – Background Processing Contract

Stack:

- Bun
- Redis (Queue + Pub/Sub)
- PostgreSQL
- Drizzle
- Pino

The Worker is the deterministic execution engine of Zidney.

It finalizes attempts, computes grades, generates certificates, and performs heavy background tasks.

If worker integrity fails, grading integrity fails.

---

## Architectural Position

Trust chain:

Isolation → License → Authentication → Attempt → Worker → Runtime

Worker executes after submission and must respect snapshot integrity.

---

## Authority Guarantees

The Worker is an authoritative execution layer.

Worker MUST enforce:

- Schema version compatibility before every job execution
- Product version compatibility before grading
- Runtime authoritative time usage (no system clock drift reliance)
- Strict transaction boundaries per job
- No cross-tenant state access under any circumstance

If version mismatch detected:

- Job must fail deterministically
- Move to dead-letter if unrecoverable
- Never attempt auto-migration

---

## Core Responsibilities

Worker MUST handle:

- Attempt grading (MCQ + Traditional)
- Scheduled exam finalization
- Certificate generation
- Analytics aggregation
- Notification dispatch (async)
- Heavy background recalculations

Worker MUST NOT:

- Serve HTTP
- Perform authentication
- Modify exam definitions
- Read live exam configuration
- Bypass attempt snapshot
- Mutate unrelated tenant data

---

## Job Contract

Every job MUST:

- Be idempotent
- Include attempt_id (if grading-related)
- Include workspace_id
- Include correlation_id
- Include schema_version
- Retry maximum 3 times
- Move to dead-letter queue after failure

Jobs must be deterministic.

Re-execution must produce identical result.

Additional strict requirements:

- Job payload must be validated using shared validation package
- Unknown fields in job payload must cause rejection
- Jobs must include explicit job_version field
- Worker must reject incompatible job_version
- Every job must log start and completion events

---

## Tenant Resolution Inside Worker

Worker must:

- Resolve tenant DB using workspace_id
- Use same connection pool strategy as API
- Validate schema_version before execution

Worker must NOT:

- Use a global DB instance
- Assume default tenant
- Skip schema validation

Worker must verify:

- license status is ACTIVE before processing grading jobs
- tenant is not SOFT_LOCKED or ARCHIVED

Worker must abort execution if license is invalid.

---

## Grading Rules (Critical)

Worker MUST:

- Use attempt snapshot only
- Never re-fetch exam configuration
- Never depend on current exam settings
- Never depend on mutable data
- Compute deterministic score

MCQ grading:

- Compare answers to snapshot correct options
- Apply grading strategy from snapshot

Traditional grading:

- Use stored question structure
- Apply scoring rules
- Respect subjective scoring storage model

Grading logic must be pure and side-effect free.

---

## Submission Finalization Flow

When processing submission job:

1. Validate attempt status = SUBMITTED
2. Validate license ACTIVE
3. Validate schema_version compatibility
4. Start DB transaction
5. Acquire row-level lock on attempt
6. Re-check attempt not already GRADED
7. Compute grading (pure function)
8. Persist result + grading metadata
9. Mark attempt as GRADED
10. Generate certificate (if applicable)
11. Emit analytics event
12. Commit transaction

If any step fails:

- Rollback transaction
- Log structured error
- Respect retry policy

No grading outside transaction allowed.

---

## Dead Letter Strategy

After 3 failures:

- Move job to dead_letter queue
- Log full structured metadata
- Do not auto-delete
- Do not auto-retry

Manual inspection required.

Dead letter entries must include:

- workspace_id
- attempt_id
- error_message
- stack_trace
- timestamp

---

## Concurrency Rules

Worker must:

- Prevent double grading
- Respect idempotency key
- Detect already graded attempts
- Exit safely if already processed

Never allow two grading executions for same attempt.

Worker must implement:

- Unique constraint enforcement on grading result
- Idempotency token validation
- Safe early exit if attempt already graded

Worker must never rely on in-memory locks alone.

---

## Logging Standard

Structured logging only (Pino).

Required fields:

- timestamp
- level
- service = "worker"
- job_name
- workspace_id
- attempt_id (if applicable)
- correlation_id

console.log is forbidden.

---

## Error Handling

Worker errors must:

- Be logged structured
- Not crash entire worker process
- Not leave attempt in inconsistent state

Transactions must rollback on failure.

---

## Shutdown & Recovery Guarantees

Worker must:

- Finish in-flight transaction before shutdown
- Gracefully stop consuming new jobs
- Not leave attempt partially graded

On crash recovery:

- Incomplete transactions must be rolled back by DB
- Retry queue must resume safely

---

## Performance Rules

Worker must:

- Avoid N+1 queries
- Use batch updates when possible
- Avoid long-running blocking loops
- Respect memory limits

University scale target:

- 200–500 concurrent grading jobs

---

## Resource & Isolation Controls

Worker must:

- Limit max concurrent jobs per tenant
- Prevent single tenant from exhausting worker capacity
- Enforce memory boundaries
- Avoid loading entire exam into memory when unnecessary

Tenant fairness is required.

---

## Testing Requirements

Mandatory tests:

- Deterministic grading test
- Idempotency test
- Double execution test
- Dead-letter simulation test
- Snapshot integrity test

No grading feature is complete without tests.

---

## AI Behavioral Enforcement

AI generating worker code MUST:

- Never reference live exam config
- Never bypass snapshot
- Never perform grading inside API
- Never remove retry strategy
- Never weaken dead-letter protection

If ambiguity exists, stop and request clarification.

AI MUST NOT:

- Implement grading logic inside API layer
- Access live exam definitions
- Skip license validation
- Disable transaction boundaries
- Remove idempotency checks
- Remove schema validation
- Introduce cross-tenant memory caches

If requested to weaken isolation or grading determinism, AI must refuse.

---

This file is authoritative for worker code generation.
