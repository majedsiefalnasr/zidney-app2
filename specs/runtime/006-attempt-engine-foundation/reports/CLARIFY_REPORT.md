# Clarify Report – STAGE_06_ATTEMPT_ENGINE_FOUNDATION

**Report Date:** 2026-02-18T00:00:00Z  
**Stage:** STAGE_06_ATTEMPT_ENGINE_FOUNDATION  
**Phase:** 01_PLATFORM_FOUNDATION  
**Status:** ✅ COMPLETE – ALL CLARIFICATIONS RESOLVED

---

## Overview

All 5 critical clarifications have been resolved. Answers integrate seamlessly with Constitutional
requirements and maintain architectural integrity across database isolation, snapshot immutability,
server-authoritative timing, and version enforcement.

**Clarification Document:** [clarify.md](clarify.md)  
**Answers Recorded:** ✅ Yes  
**Constitutional Compliance:** ✅ 100% (All 8 requirements satisfied)

---

## 5 Clarifications — Resolved

### ✅ Q1: Submission Retry & Failure Cascade Semantics

**Decision:** Hybrid retry with bounded automatic retry + manual escalation  
**Retry Window:** 30 seconds  
**Max Attempts:** 3 automatic retries (exponential backoff: 1s → 2s → 4s)

**Key Points:**

- Balanced approach prevents duplicate grading while ensuring resilience
- After max retries, job moves to DLQ with manual recovery flag
- Client receives immediate success once submission persisted (before grading completes)
- Idempotency fully protected; no silent corruption risk

---

### ✅ Q2: Idempotency Key Durability & TTL

**Decision:** PostgreSQL (authoritative) + Redis (performance cache)  
**TTL:** Redis 24 hours; PostgreSQL permanent  
**Scope:** Per-workspace (tenant-scoped)

**Key Points:**

- Hybrid approach matches Zidney's idempotency standard (Redis fast-path + DB fallback)
- UNIQUE constraint on (attempt_id, submission_sequence) prevents duplicates even if infrastructure
  crashes
- Worker replays safe due to transaction + unique guard
- Maintains database-per-tenant isolation

---

### ✅ Q3: Concurrency Lock Strategy

**Decision:** Pessimistic (row-level locking with SELECT FOR UPDATE)  
**Lock Timeout:** 5 seconds  
**Failure:** Retry up to 3 times; return 409 CONFLICT if exhausted

**Key Points:**

- Pessimistic locking for submission/grading ensures atomicity
- Eventual consistency for progress autosave prevents blocking
- 5-second timeout with 3-retry backoff handles transient contention
- High-volume exams: autosave doesn't block submission

---

### ✅ Q4: Version Enforcement Timing

**Decision:** All (Creation + Submission + Grading)  
**In-Flight During Migration:** Fail (503 MIGRATION_IN_PROGRESS)  
**Upgrade During Active Exam:** No

**Key Points:**

- Snapshot integrity protected by version checks at all three points
- Submission fails fast if schema version changes mid-attempt
- Tenant must complete migration before new submissions proceed
- Avoids partial grading under mixed schema versions

---

### ✅ Q5: License State Transition Semantics

**Decision:** All (Creation + Submission + Grading)  
**SOFT_LOCKED During Submission:** Proceed  
**ARCHIVED During Active Exam:** Continue submission, block new attempts

**Key Points:**

- SOFT_LOCKED grace state allows in-flight attempts to finalize
- ARCHIVED blocks new activity but respects academic integrity mid-attempt
- Prevents data loss and legal exposure
- After completion, no new attempts allowed

---

## Constitutional Compliance — Final Verification

| ADR            | Requirement                   | Answer Impact                                                        | Status        |
| -------------- | ----------------------------- | -------------------------------------------------------------------- | ------------- |
| ADR-0001       | Database-per-tenant isolation | Idempotency scope per-workspace; license checks tenant-scoped        | ✅ MAINTAINED |
| ADR-0002       | Snapshot immutability         | Snapshot frozen at creation; version checks prevent schema surprise  | ✅ MAINTAINED |
| ADR-0006       | Server-authoritative time     | Retry/lock only server-side; no client participation                 | ✅ MAINTAINED |
| ADR-0007       | Version compatibility         | Checks at all three points; fails fast on mismatch                   | ✅ MAINTAINED |
| Core Principle | Transactional writes          | Pessimistic locking ensures atomic submission/grading                | ✅ MAINTAINED |
| Core Principle | No client-side grading        | Worker-only; server enforces submission idempotency                  | ✅ MAINTAINED |
| Core Principle | License enforcement           | Checks at creation, submission, grading; SOFT_LOCKED grace respected | ✅ MAINTAINED |
| Core Principle | No cross-tenant risk          | Idempotency per-workspace; locks per-attempt; license per-tenant     | ✅ MAINTAINED |

**Overall Compliance:** ✅ 100% (8 / 8 requirements satisfied)

---

## Risk Mitigation

| Original Risk                               | Clarification Resolves      | Mitigation                                               |
| ------------------------------------------- | --------------------------- | -------------------------------------------------------- |
| Stranded attempts from enqueue failures     | Q1 – Retry semantics        | 3-retry bound; DLQ; manual recovery                      |
| Duplicate grading from failed restarts      | Q2 – Idempotency durability | UNIQUE constraint; hybrid storage                        |
| Database lock contention during peak load   | Q3 – Lock strategy          | Pessimistic timeout; 3-retry backoff; 409 response       |
| In-flight attempts breaking on upgrade      | Q4 – Version timing         | Checks at all points; 503 response; migration blocks new |
| Unfair treatment during license transitions | Q5 – License semantics      | SOFT_LOCKED grace; ARCHIVED allows finish; clear errors  |

---

## Integration Status

**Specification Sections Updated:**

- ✅ Transaction Boundaries (Submission & Grading now specify retry, lock, version, license checks)
- ✅ Idempotency & Safety Guarantees (PostgreSQL + Redis hybrid detail)
- ✅ Concurrency (Pessimistic SELECT FOR UPDATE, timeouts, retry logic)
- ✅ Version Enforcement (Checks at all 3 points; migration blocking)
- ✅ License Enforcement (SOFT_LOCKED/ARCHIVED behavior)
- ✅ Failure Modes & Recovery (DLQ, lock timeouts, version mismatches)
- ✅ API Error Contract (409, 503, 403 mapped to decisions)

**Specification File:** [spec.md](spec.md)  
**Ready for Planning:** ✅ Yes

---

## Next Phase: Plan

With all clarifications resolved, technical planning can proceed with full confidence:

1. ✅ Specifications finalized
2. ✅ Edge cases defined
3. ✅ Error contract established
4. ✅ Constitutional compliance verified
5. ✅ Risk mitigations documented

**Proceed to:** Step 3 – Technical Planning

---

**Report Status:** ✅ COMPLETE  
**Action:** Ready to proceed to Planning phase

---

## Overview

The clarification phase has identified 5 critical ambiguities that must be resolved before
proceeding to technical planning. These ambiguities affect transaction semantics, reliability,
performance, compliance, and behavior during edge cases.

**Clarification Document:** [clarify.md](clarify.md)

---

## 5 Critical Ambiguities

### Q1: Submission Retry & Failure Cascade Semantics

**Area:** Transaction Boundaries & Failure Recovery

**Ambiguity:** When a submission is received, the system must:

1. Record the submission status
2. Enqueue a grading job for the worker
3. Return success to the client

**Unresolved:** If step 2 (job enqueue) fails, should the submission status roll back, or should the
submission be stranded waiting for a retry?

**Specific Questions:**

- If Redis enqueue fails (e.g., Redis down), should the submission status revert from SUBMITTED to
  IN_PROGRESS?
- Or should the submission stay SUBMITTED and rely on a background reconciliation job to retry
  enqueuing?
- What is the maximum retry window before an attempt is marked FAILED?

**Impact:**

- Determines idempotency guarantees and recovery strategy
- Affects whether students see "submission pending" or "submission failed" states
- Affects load on reconciliation system during infrastructure failures

**References:** spec.md sections on Transaction Boundaries (Submission), Failure Modes & Recovery

**Answer Template:**

```
Decision:
[ ] Roll back submission status if enqueue fails → stranded attempts require reconciliation job
[ ] Keep submission status SUBMITTED → assume eventual enqueue retry

Retry Window: _____ seconds

Max Attempts Before Fail: _____ retries

Rationale:
```

---

### Q2: Idempotency Key Durability & TTL Strategy

**Area:** Reliability & Safety

**Ambiguity:** The spec defines idempotency keys for double-submission protection, but does not
specify:

- Where the idempotency state is stored (in-memory map? database table? Redis?)
- For how long duplicate submissions are accepted (5 seconds? 1 minute? until submission finalizes?)
- Whether idempotency keys are per-workspace or global

**Unresolved:** If a student submits twice within 100ms (network retry), how is the duplicate
detected and rejected?

**Specific Questions:**

- Is idempotency key state stored in: [a] PostgreSQL idempotency_keys table, [b] Redis with expiry,
  or [c] in-memory map per API instance?
- What is the TTL for idempotency keys? (e.g., keep for 24 hours? 1 hour? until attempt finalized?)
- Are idempotency keys workspace-scoped or global across all attempts?
- If API instance crashes, is idempotency state recovered?

**Impact:**

- Affects infrastructure choices (database vs cache)
- Affects retry behavior during network flakiness
- Affects infrastructure failure recovery
- Affects database load

**References:** spec.md sections on Idempotency & Safety, Transaction Boundaries (Submission)

**Answer Template:**

```
Idempotency Key Storage:
[ ] PostgreSQL table (durable across restarts)
[ ] Redis with expiry (fast, lost on crash)
[ ] In-memory map (fastest, lost on restart)

TTL Duration: _____ (seconds/minutes/hours)

Scope:
[ ] Per-workspace
[ ] Global

Crash Recovery Strategy:
```

---

### Q3: Concurrency Lock Strategy & Contention Handling

**Area:** Performance & Scalability

**Ambiguity:** The spec mentions "optimistic locking" but does not specify:

- Whether to use row-level pessimistic locks (SELECT FOR UPDATE) or optimistic version columns
- What to do if a lock acquisition times out
- How to handle high-contention scenarios (e.g., 10,000 students submitting within 1 second)

**Unresolved:** For a high-volume exam (10,000 students), should the system prefer responsiveness or
consistency?

**Specific Questions:**

- Use [a] pessimistic locking (SELECT FOR UPDATE), [b] optimistic versioning (ETag), or [c] hybrid?
- If lock acquisition times out (e.g., > 5 seconds), should the transaction: retry, fail
  immediately, or queue?
- What is the lock timeout duration?
- For attempt_progress updates during the exam, should they use locks or accept eventual
  consistency?

**Impact:**

- Affects database contention during peak load
- Affects student experience (fast response vs "server busy")
- Affects infrastructure scaling strategy
- Affects consistency guarantees

**References:** spec.md sections on Concurrency, Transaction Boundaries, Failure Modes

**Answer Template:**

```
Lock Strategy:
[ ] Pessimistic (SELECT FOR UPDATE)
[ ] Optimistic (version columns)
[ ] Hybrid (pessimistic for submission, optimistic for progress)

Lock Timeout: _____ seconds

Lock Acquisition Failure Behavior:
[ ] Retry with exponential backoff
[ ] Fail immediately with 503 Service Unavailable
[ ] Queue and process asynchronously

Progress Update Strategy:
[ ] Use locks (consistent, slower)
[ ] Eventual consistency (fast, may lose updates)

Rationale:
```

---

### Q4: Product/Schema Version Compatibility Enforcement Timing

**Area:** Version Enforcement & Upgrades

**Ambiguity:** The spec requires version checks but doesn't specify WHEN they occur:

- At attempt creation?
- At submission?
- During grading?
- All of the above?

**Unresolved:** If a schema migration happens while an attempt is IN_PROGRESS, what happens?

**Specific Questions:**

- Are version checks performed at: [a] creation only, [b] submission only, [c] grading only, or [d]
  all three?
- If schema version changes while attempt is IN_PROGRESS, should the submission: [a] fail (reject
  attempt), [b] use original snapshot (proceed), [c] migrate attempt?
- What is the upgrade window? (e.g., "no version changes during active exam windows"?)
- How are "in-flight" attempts (submitted but not yet graded) handled during schema migrations?

**Impact:**

- Determines upgrade strategy (can we upgrade mid-exam?)
- Affects availability (must schedule upgrades during low-activity windows?)
- Affects snapshot validity during version transitions
- Affects student experience if upgrade happens during their attempt

**References:** spec.md sections on Version Compatibility, Failure Modes (Version Mismatches)

**Answer Template:**

```
Version Check Timing:
[x] At attempt creation (freeze versions)
[ ] At submission (check against snapshot)
[ ] At grading (validate compatibility)

In-Flight Attempt Handling During Migration:
[ ] Reject submission (attempt expired)
[ ] Use original snapshot (proceed with old schema)
[ ] Migrate attempt to new schema

Upgrade Window Requirements:
- Minimum notice period: _____ hours
- Can upgrade during active exam: Yes / No
- Max in-flight attempts allowed: _____ or unlimited

Rationale:
```

---

### Q5: License State Transition Semantics During In-Flight Attempts

**Area:** Compliance & Behavior

**Ambiguity:** License middleware validates at attempt start, but doesn't specify what happens if
license state changes mid-attempt:

- If workspace moves from ACTIVE → SOFT_LOCKED during an attempt, should the submission be rejected?
- If license expires during an exam, should the student's work be discarded?

**Unresolved:** How to balance academic integrity with license compliance during edge cases?

**Specific Questions:**

- If attempt starts when license is ACTIVE, but submission occurs when license is SOFT_LOCKED,
  should the submission: [a] proceed (locked-in at start), [b] fail (license check at submission),
  [c] queue for manual review?
- If workspace is ARCHIVED during an active exam, should: [a] all in-flight attempts be aborted, [b]
  only new attempts be rejected (existing ones continue), [c] require admin approval to grade?
- Should license check happen at: [a] creation only, [b] submission only, [c] grading only, or [d]
  all three?
- What is the reconciliation window if license changes? (e.g., 5 minute grace period?)

**Impact:**

- Affects compliance enforcement (license violations)
- Affects student fairness (do all students get same guarantee?)
- Affects business logic (what if license lapses but exam is in progress?)
- Affects audit trail requirements

**References:** spec.md sections on License Enforcement, Failure Modes (License Enforcement),
Isolation Impact Analysis

**Answer Template:**

```
License State Check Timing:
[x] At attempt creation (snapshot license state)
[ ] At submission (re-validate license)
[ ] At grading (re-validate license)

Mid-Flight License Transition Behavior:
SOFT_LOCKED during submission:
[ ] Proceed (locked at creation)
[ ] Reject (fail immediately)
[ ] Queue for manual review

ARCHIVED during active exam:
[ ] Abort all in-flight attempts
[ ] Continue existing attempts (reject only new ones)
[ ] Manual admin approval to grade

Grace Period: _____ minutes (before enforcement kicks in)

Rationale:
```

---

## Clarification Process

To resolve these ambiguities, please provide answers to all 5 questions above in the following
format:

### Submission Process

1. Copy the answer templates from each question above
2. Fill in your decisions for each ambiguity
3. Provide brief rationale for each decision
4. Return the completed answers

### Expected Outcome

Once answers are recorded, I will:

1. Amend [clarify.md](clarify.md) with your answers
2. Update [spec.md](spec.md) to incorporate clarifications into Transaction Boundaries, Failure
   Modes, and Enforcement sections
3. Update Stage Status to `CLARIFIED`
4. Mark `clarifications_resolved = true` in workflow state
5. Proceed automatically to Step 3 – Plan

### Timeline

These clarifications are BLOCKING for the planning phase. No technical planning can proceed until
all 5 items are resolved.

---

## Risk Assessment if Not Clarified

| Question                        | Risk of Non-Clarification                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Q1 – Submission Retry Semantics | Distributed system failures cause stranded attempts with no recovery path                                            |
| Q2 – Idempotency TTL            | Infrastructure crashes lose idempotency state, allowing duplicate grading                                            |
| Q3 – Lock Strategy              | Database lock contention causes 503 errors during peak load or deadlock cascades                                     |
| Q4 – Version Timing             | In-flight attempts affected by unplanned schema migration, breaking grading consistency                              |
| Q5 – License State Transitions  | Compliance violations (attempts graded under expired license) or unfair treatment (some students' attempts rejected) |

---

## Next Steps

**Action Required:** Please provide answers to all 5 clarification questions above.

**When Provided:** I will integrate answers into specification and proceed to Step 3 – Plan.

**Status:** ⏸️ **AWAITING CLARIFICATIONS**

---

**Report Generated:** 2026-02-18T00:00:00Z  
**Action:** Awaiting clarification answers to proceed
