# STAGE_58_CONCURRENCY_GUARDS

Phase: 05_ATTEMPT_ENGINE  
Runtime: Backend + Redis

---

## Stage Status

Status: DRAFT

---

## Objective

Guarantee deterministic behavior under high concurrency.

Target scale:

- 200–500 concurrent scheduled exam users per workspace
- 10k–50k registered students per workspace
- Burst submission scenarios at exam end

Concurrency protection must prevent:

- Duplicate attempts
- Double submission
- Race-condition grading
- Limit bypass
- Worker duplication
- Deadlocks

---

## Single Active Attempt Rule

Unless exam configuration explicitly allows multiple attempts:

- Only one IN_PROGRESS attempt per user per exam

Enforced by database constraint:

Unique partial index:

(user_id, exam_id) WHERE status = 'IN_PROGRESS'

This must be enforced at database level. Application checks alone are insufficient.

If violation occurs: Return 409 Conflict.

---

## Submission Atomicity

Submission must execute inside a single database transaction.

Transaction must:

- Lock attempt row FOR UPDATE
- Validate status = IN_PROGRESS
- Execute grading
- Update attempt fields
- Commit

If transaction fails: Rollback completely.

No partial grading writes allowed.

---

## Double Submission Protection

Update statement must include:

WHERE attempt_id = ? AND status = 'IN_PROGRESS'

If rows affected = 0: Return 409.

Submission must be idempotent-safe.

---

## Worker Locking Strategy

Auto-submit worker must prevent duplicate grading.

Use Redis distributed lock:

Key: attempt:{attempt_id}:submit_lock

TTL: Short duration (e.g., 30 seconds)

Worker flow:

- Acquire lock
- Revalidate attempt status
- Execute submission flow
- Release lock

Worker must tolerate lock contention safely.

---

## Rate Limiting

Submission endpoint must be rate limited per:

- user_id
- IP address
- workspace

Autosave endpoint must also be rate limited.

Recommended behavior:

- Sliding window
- Short burst allowance
- Immediate block on abuse

Rate limiting must not block legitimate end-of-exam submissions.

---

## Limit Enforcement Concurrency

Student and staff limit checks must be transactional.

Creation flow:

- Begin transaction
- Count active users
- Compare against limit
- Insert if valid
- Commit

No cached counters allowed.

Prevents race condition where two inserts bypass limit simultaneously.

---

## Auto-Selection Query Protection

Automatic question selection must:

- Always filter by subject first
- Use indexed columns only
- Enforce LIMIT on candidate set
- Never perform full-table scan

All selection queries must be explain-analyzed before production.

---

## Deadlock Avoidance

Submission transactions must:

- Lock rows in deterministic order
- Never lock unrelated rows
- Avoid long-running transactions

Worker and API submission must use identical lock order.

---

## Heavy Load Protection

System must withstand:

- 500 concurrent autosaves
- 500 concurrent submissions
- Simultaneous expiration auto-submit
- Redis reconnect storms

Connection pool must not exhaust under load.

---

## Observability Requirements

Every concurrency conflict must log:

- workspace_slug
- attempt_id
- user_id
- conflict_type
- request_id

Deadlock or lock timeout must log severity = ERROR.

---

## Validation Criteria

Stage complete when:

- Duplicate attempts prevented
- Double submission impossible
- Worker duplicate grading impossible
- Limit bypass impossible
- No deadlock under simulated load
- Rate limiting enforced
- Auto-selection queries safe

---

## Forbidden

- Non-transactional submission
- Parallel grading
- Missing unique constraint
- Unindexed selection queries
- Application-only concurrency guards
- Long-running transactions inside submission

Concurrency safety is mandatory before production deployment.
