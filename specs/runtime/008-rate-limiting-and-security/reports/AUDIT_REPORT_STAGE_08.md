# Zidney Architecture Audit Report

## STAGE 08: Rate Limiting & Security

**Date:** 2026-02-19  
**Auditor:** Zidney Architecture Guardian  
**Audit Type:** Technical Plan Pre-Implementation Review  
**Plan Location:** `specs/runtime/008-rate-limiting-and-security/plan.md`

---

## VERDICT: 🔴 BLOCKED

**Status:** ARCHITECTURAL VIOLATIONS DETECTED  
**Authority:** Zidney Constitution v1.2.0 + AGENTS.md  
**Action Required:** Resolve critical violations before implementation phase

---

## Executive Summary

The technical plan for STAGE_08 demonstrates **strong foundational architecture** in most areas, but
contains **one critical violation** and **two medium-risk concerns** that must be resolved before
implementation:

| Check                                 | Status           | Finding                           |
| ------------------------------------- | ---------------- | --------------------------------- |
| Database-per-tenant isolation         | ✅ PASS          | No shared rate limit state        |
| License middleware positioning        | ✅ PASS          | Before rate limiting (step 3→5)   |
| Redis pool only (no direct DB)        | ✅ PASS          | Centralized pool referenced       |
| FOR UPDATE locks (idempotency)        | ✅ PASS          | Present in transaction code       |
| Schema version enforcement            | ✅ PASS          | Before rate limit (step 4→5)      |
| Workspace ID from JWT                 | ✅ PASS          | JWT validation implemented        |
| No cross-tenant joins                 | ✅ PASS          | Tenant-scoped Redis keys          |
| **Worker-only grading authority**     | 🔴 **BLOCKED**   | **ARCHITECTURAL VIOLATION**       |
| Middleware order immutable (5 stages) | ✅ PASS          | Explicit order defined            |
| All writes transactional              | ✅ **QUALIFIED** | Mostly yes, but see concerns      |
| Backward compatibility                | ✅ PASS          | Migration strategy sound          |
| Attempt snapshot integrity            | ✅ PASS          | Protected via locks + constraints |

---

## Critical Violations

### 🔴 VIOLATION 1: Grading Authority Violated

**Severity:** CRITICAL (Architecture Drift)  
**File:** Plan section 3 (API Layer Design) & section 6 (Transaction Boundaries)  
**Violation Details:**

The plan **contradicts its own compliance statement** regarding worker authority:

#### What the Plan Claims (Section 13):

```
✅ **Grading Authority:** Worker remains sole authority. Idempotency prevents
duplicate submissions but doesn't change grading logic.
```

#### What the Plan Implements (Section 3, API Handler):

```typescript
// Inside API handler within DB transaction
const gradingResult = await gradeAttempt(attemptId, answers, trx);

// Step 4: Execute grading logic
await trx.attempts.update({ id: attemptId }, {
  status: 'COMPLETED',
  submission_cached_result: gradingResult,
  ...
});
```

#### Constitutional Authority (PROJECT_CONTEXT_PRIMER.md):

```
Worker:
- Executes migrations
- Executes provisioning
- **Executes grading**  ← Worker responsibility
- Handles retry + DLQ

Submission is:
- Idempotent
- **Worker-finalized** ← Must be finalized by worker
- Server-authoritative time
```

#### The Problem:

1. **Grading happens in API layer** (synchronous, in transaction)
2. **Constitution requires worker executes grading** (background job)
3. **Section 7 (Worker Integration) doesn't show grading job enqueue**
   - Only shows dead-letter queue for failed jobs
   - No evidence of grading job being queued initially
4. **Worker comment is misleading** (section 3): "// Worker enqueues this job" appears in API
   handler code

#### Architectural Risk:

- ❌ Violates "Worker-finalized" contract
- ❌ Violates "Worker executes grading" principle
- ❌ Creates synchronous grading dependency in request path
- ❌ Means grading runs in API instance, not isolated worker
- ❌ If API is overloaded, grading delays affect all users
- ⚠️ Could undermine worker queue isolation model

#### Impact on Trust Chain:

```
Trust Chain: Isolation → License → Authentication → Attempt → **Runtime** → Frontoffice

Current Plan Places Grading In: API (Runtime)
Architecture Requires Grading In: Worker (Isolated Background)

BROKEN ISOLATION.
```

**Requirements to Fix:**

1. **Option A (Recommended):** API enqueues grading job to worker, waits for completion
   - API receives `submission` request
   - API validates, locks attempt
   - API enqueues `grade_attempt` job
   - API waits for job completion (with timeout)
   - API returns grading result
   - Worker executes grading async-but-awaited

2. **Option B:** Full async with polling
   - API enqueues grading
   - API returns `202 Accepted` with job_id
   - Client polls for result OR uses WebSocket

3. **Clarification Required:** If synchronous grading in API layer is acceptable, must be:
   - Approved via ADR change
   - Explicitly documented in worker section
   - Removed from "Worker executes grading" list
   - Justified in Constitutional Compliance section

---

## Medium-Risk Concerns

### ⚠️ CONCERN 1: Transaction Writes Without All Middleware Response

**Severity:** MEDIUM  
**File:** Section 3, Attempt Submission flow  
**Issue:**

The plan shows database writes (attempt update, audit log) happening inside the API transaction
(section 6, lines ~300-330):

```typescript
// Inside transaction
await trx.attempts.update({ id: attemptId }, {...});
await trx.attemptAudit.insert({...});
```

But from PROJECT_CONTEXT_PRIMER: "All writes transactional" suggests writes should be wrapped in
transactions WITH middleware guarantees.

**Current Implementation:** ✅ Uses `db.transaction()`  
**Concern:** ⚠️ Ensure all writes include:

- [ ] Correlation ID in audit record
- [ ] Workspace scoping verified
- [ ] User ID verified
- [ ] Timestamp server-authoritative

**Plan Statement:** Audit record includes correlation ID ✅  
**Status:** QUALIFIED PASS (needs verification in code)

---

### ⚠️ CONCERN 2: Worker Knows About Grading Job, Not Shown In Plan

**Severity:** MEDIUM  
**File:** Entire plan, missing job definition  
**Issue:**

Section 7 (Worker Integration) defines dead-letter queue but doesn't show:

- ❌ How grading job is enqueued
- ❌ Job schema/format
- ❌ Job idempotency guarantee
- ❌ Retry strategy for grading (max 3 retries referenced but not for grading)
- ❌ How worker processes grading.grade_attempt job type referenced in DLQ section but never defined

**Impact:**

If grading is meant to happen in worker, the job flow must be documented.  
Currently, DLQ section references `job_type: 'grade_attempt'` but never shows job creation.

**Required:** Clarify whether grading is:

1. Synchronous in API (violates worker authority) → **MUST BE FIXED**
2. Async in worker → **Job enqueue missing from plan**

---

## Passing Checks

### ✅ 1. Database-Per-Tenant Isolation

**Verdict:** PASS  
**Evidence:**

- Section 4 (Redis Schema) defines global prefix: `zidney:tenant:{workspace_slug}`
- Example: `zidney:tenant:example-workspace:rate:auth:ip:192.168.1.1`
- Section 3: All Redis keys include tenant context
- No global counters that ignore workspace
- Specification section confirms: "No cross-tenant rate limit state sharing"

**Compliance:** Constitutional requirement satisfied ✅

---

### ✅ 2. License Middleware Positioning

**Verdict:** PASS  
**Evidence:**

- Section 5 (Middleware Stack) explicit order:
  1. Correlation ID
  2. Tenant Resolver
  3. **License Enforcement** ← Step 3
  4. Schema Version Check
  5. **Rate Limiting** ← Step 5
- Plan states: "No exceptions allowed: Every authenticated route MUST execute all 5 middleware in
  order"
- Spec confirms: License checked before rate limiting

**Impact:** SOFT_LOCKED workspaces return 423 before hitting rate limiter ✅

---

### ✅ 3. No Direct DB Instantiation (Redis Pool Only)

**Verdict:** PASS  
**Evidence:**

- Plan section 1: "centralized Redis pool initialized at boot"
- Section 4 declares: "Reuse platform's centralized Redis pool initialized at boot"
- No tenant-specific Redis connections shown
- Rate limiter uses `redis.get()`, `redis.set()`, `redis.incr()` (pool methods)
- Tenant context in key prefix only, not connection

**Constitutional Compliance:** Rate limiter uses pooled Redis ✅

---

### ✅ 4. FOR UPDATE Locks Present

**Verdict:** PASS  
**Evidence:**

- Section 6, Attempt Submission transaction:

```typescript
const attempt = await trx.attempts.findOne({ where: { id: attemptId } }).forUpdate(); // ← Row lock acquired
```

- Isolation level: SERIALIZABLE
- Lock timeout: 3 seconds with retries
- Rollback on lock timeout

**Idempotency Protection:** FOR UPDATE + UNIQUE constraint dual-layer ✅

---

### ✅ 5. Schema Version Enforcement Before Rate Limiting

**Verdict:** PASS  
**Evidence:**

- Section 5 Middleware Stack order: Schema version is middleware step 4
- Rate limiting is middleware step 5
- Schema version check validates `schema_version >= 1.1.0` required for idempotent columns
- Returns 426 if schema incompatible
- Plan: "Prevent use of missing columns"

**Feature Gate:** Rate limiting tied to schema version ✅

---

### ✅ 6. Workspace ID From JWT (Not Request Body)

**Verdict:** PASS  
**Evidence:**

- Section 3, WebSocket handler:

```typescript
let decoded;
try {
  decoded = await verifyJWT(token);  // ← From JWT
}

// Cross-check workspace and attempt
if (decoded.workspace_id !== workspace.id) {  // ← Verify match
  return c.websocket({ onOpen: (ws) => ws.close(1008, ...) });
}
```

- Specification section confirms: "Extract workspace_id from JWT claims (authoritative)"
- Plan states: "❌ From request body (forbidden)"
- Tenant resolver provides validation cross-check only

**Trust Chain:** Workspace resolved from JWT ✅

---

### ✅ 7. No Cross-Tenant Joins or Shared State

**Verdict:** PASS  
**Evidence:**

- All Redis keys namespaced by tenant: `rate:{endpoint}:{key}`
- No SQL joins shown across workspaces
- Rate limiters per-tenant: `rate:auth:user:{user_id}:{workspace_slug}`
- WebSocket validates workspace_id from JWT against resolved workspace
- Specification confirms: "No shared rate limit bucket across tenants"

**Isolation:** Each workspace has independent rate limit state ✅

---

### ✅ 8. Middleware Order Immutable (5 Stages Defined)

**Verdict:** PASS  
**Evidence:**

- Section 5 explicitly lists 5 middleware stages
- Plan states: "No exceptions allowed: Every authenticated route MUST execute all 5 middleware in
  order."
- Pseudocode shows exact order:
  1. Correlation ID
  2. Tenant Resolver
  3. License Enforcement
  4. Schema Version Check
  5. Rate Limiting

- No conditional skipping shown
- Specification confirms: Immutable order enforced

**Authority:** Middleware order fixed ✅

---

### ✅ 9. Backward Compatibility Strategy

**Verdict:** PASS  
**Evidence:**

**Migration Strategy (Section 2):**

- Old attempts populated with `gen_random_uuid()` for idempotent_submission_key
- UNIQUE constraint NOT added retroactively to existing rows
- Only NEW submissions enforce constraint

**API Graceful Handling:**

- Rejects requests without `idempotency_key` with 400 Bad Request
- Older SDK versions can still work (constraint only on new rows)
- Feature flag tied to schema_version: 1.0.0 → 1.1.0

**Feature Activation:**

- Rate limiting activates only when schema_version ≥ 1.1.0
- Older workspaces on 1.0.0 don't get rate limiting yet
- Safe rollback: Feature flag disables rate limiting

**Versioning:** MINOR version bump (1.0.0 → 1.1.0) indicates backward compatible ✅

---

### ✅ 10. Attempt Snapshot Integrity Preserved

**Verdict:** PASS  
**Evidence:**

**Lock Strategy (Section 6):**

```typescript
// Acquire exclusive lock
const attempt = await trx.attempts.findOne({ where: { id: attemptId } }).forUpdate();

// Verify state unchanged
if (attempt.status !== "IN_PROGRESS") {
  throw new Error(`ATTEMPT_STATE_CHANGED`);
}
```

**Idempotency Protection:**

- UNIQUE(attempt_id, idempotency_key) constraint
- Redis cache prevents reprocessing (< 100ms)
- Duplicate submissions return original result without re-grading

**Snapshot Preservation:**

- Plan doesn't modify snapshot configuration
- Rate limiting is read-only for snapshot data
- Snapshot columns (from ADR-0002) untouched

**Result:** Snapshot integrity preserved ✅

---

### ✅ 11. All Writes Transactional

**Verdict:** QUALIFIED PASS  
**Evidence:**

**Transactional Writes Shown:**

1. **Attempt Submission (Section 6):**
   - Uses `db.transaction()` with SERIALIZABLE isolation
   - All updates within transaction boundary
   - Rollback on error

2. **License Updates (Section 6):**
   - Uses `db.transaction()` with SERIALIZABLE isolation
   - Audit record included in same transaction
   - All-or-nothing semantics

3. **User Account Lock (Section 6):**
   - Only operation is Redis `SET` (atomic in Redis)
   - Audit log insert is non-critical, can fail independently

**Qualification:** Writes are transactional where needed ✅  
**Exception:** Redis operations atomic by nature ✅

---

## Constitutional Alignment Summary

| Constitutional Principle                                               | Status          | Evidence                       |
| ---------------------------------------------------------------------- | --------------- | ------------------------------ |
| Isolation → License → Authentication → Attempt → Runtime → Frontoffice | 🔴 **BROKEN**   | Grading in API violates chain  |
| Database-per-tenant                                                    | ✅ **PASS**     | Tenant-scoped Redis keys       |
| Multi-tenancy isolation                                                | ✅ **PASS**     | No shared rate limit state     |
| License first, then middleware                                         | ✅ **PASS**     | Middleware order 3 before 5    |
| Version compatibility enforced                                         | ✅ **PASS**     | Schema check before rate limit |
| Idempotent submission                                                  | ✅ **PASS**     | FOR UPDATE + UNIQUE constraint |
| Worker-only grading                                                    | 🔴 **VIOLATED** | Grading in API layer           |
| Server-authoritative time                                              | ✅ **PASS**     | Server time used for deadlines |
| No cross-tenant references                                             | ✅ **PASS**     | Tenant-scoped queries          |

---

## Required Fixes Before Implementation

### 🔴 CRITICAL (Blocking)

**1. Clarify/Fix Grading Authority**

- [ ] **Decision Required:** Does grading happen in API (synchronous) or Worker (async/await)?

  **If API (synchronous):**
  - [ ] Update Constitution to remove "Worker executes grading"
  - [ ] Update plan section 13 compliance statement
  - [ ] Document why API grading is acceptable
  - [ ] Add job enqueu pattern to worker section (DLQ monitoring only)
  - [ ] Request ADR update if changing established architecture

  **If Worker (async/await):**
  - [ ] Add job enqueue in plan section 3 (API handler)
  - [ ] Add job processing in plan section 7 (Worker)
  - [ ] Show retry strategy for grading jobs
  - [ ] Add job schema definition
  - [ ] Show API wait-for-job-completion pattern
  - [ ] Add DLQ definition for failed grading jobs

---

### ⚠️ MEDIUM (Must verify before code review)

**2. Document Worker Grading Job Flow**

- [ ] If grading is async, define job schema
- [ ] Define retry strategy (max 3 retries - is grading included?)
- [ ] Define DLQ behavior for grading failures
- [ ] Add testcases for worker grading path

**3. Verify Audit Trail Completeness**

- [ ] Ensure all writes include correlation_id
- [ ] Ensure all writes include workspace_id
- [ ] Ensure all security events logged

**4. Add Missing Implementation Details**

- [ ] How is `gradeAttempt()` implemented?
- [ ] Is it a service, or does it need to be a job?
- [ ] Where is grading business logic defined?

---

## Positive Observations

✅ **Strong Points:**

- Comprehensive middleware ordering with explicit immutability guarantee
- Clear tenant isolation via Redis key prefixing
- Solid idempotency pattern (dual-layer: Redis + DB)
- FOR UPDATE locks prevent race conditions
- Backward compatibility strategy well thought out
- Security headers properly specified
- Logging strategy detailed with correlation ID propagation
- Transaction boundaries clearly defined
- Rate limiting algorithm (sliding window) appropriate
- Comprehensive testing strategy (unit, integration, load, security)
- Error code mapping complete
- Schema migration plan sound

✅ **Architectural Maturity:**

- Plan demonstrates deep understanding of tenancy isolation
- Constitutional compliance checklist present (though contains inaccuracy)
- Dead-letter queue pattern shown (even if not fully detailed)
- Cross-workspace protection implemented
- WebSocket security strong

---

## Recommendations

### Before Implementation Phase

1. **Resolve CRITICAL violation** regarding grading authority (worker vs API)
2. **Clarify job enqueu pattern** if grading is async
3. **Update Constitutional Compliance section** to be accurate
4. **Add implementation details** for grading service/function
5. **Cross-reference Worker section** with complete job lifecycle

### Before Code Review

1. Verify all writes include correlation_id + workspace_id
2. Verify all security events logged with appropriate context
3. Validate that rate limit keys are tenant-exclusive
4. Ensure backward compatibility tests included
5. Validate DLQ overflow thresholds and alerting

### During Implementation

1. **Do not bypass middleware order** - add assertion that all 5 run in order
2. **Do not add direct DB connections** - all access through tenant context
3. **Do not assume client time** - use server time for all authorization
4. **Do not skip idempotency** - all write operations must be idempotent or deduped
5. **Do not share Redis keys** across workspaces

---

## Conclusion

**VERDICT: 🔴 BLOCKED**

The technical plan for STAGE_08 is **architecturally mature** in most areas, but contains **one
critical architectural violation** that must be resolved before entering the implementation phase:

**The Violation:** Grading authority placement contradicts constitutional requirement that "Worker
executes grading"

**Impact:** Breaks the trust chain isolation model and undermines asynchronous job isolation

**Resolution Path:** Clarify whether grading happens in API or Worker, then update plan accordingly

**Timeline:** This issue must be resolved before planning phase completion. **Recommend escalation
to Product/Architecture team for decision.**

**Recommendation:** Request ADR clarification if API-layer grading is acceptable, OR redesign
grading flow to use worker with result availability pattern.

Once this critical violation is resolved, the plan is ready for implementation phase.

---

**Auditor:** Zidney Architecture Guardian (Claude)  
**Date:** 2026-02-19  
**Authority:** AGENT_GOVERNANCE v1.0 + Zidney Constitution v1.2.0  
**Next Step:** Escalate to architecture review board
