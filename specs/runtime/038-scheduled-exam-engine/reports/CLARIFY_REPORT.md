# Clarify Report — Scheduled Exam Engine

**Step:** 2 — Clarify
**Timestamp:** 2026-04-01T00:15:00Z
**Status:** COMPLETE

---

## Summary

5 targeted clarifications were identified and resolved in-place inside `spec.md` (lines 1203–1389).
Zero `[NEEDS CLARIFICATION]` markers remain. All ambiguities resolved.

**Risk Level: HIGH (score: 16)**

---

## Risk Level Calculation

| Factor                                               | Score          |
| ---------------------------------------------------- | -------------- |
| New table (`scheduled_exams`)                        | +2             |
| New columns on `attempts`                            | +2             |
| Database migrations (2 new files)                    | +3             |
| Multi-tenant isolation logic                         | +3             |
| Security-sensitive logic (attempt auth, role guards) | +3             |
| Worker / async job                                   | +2             |
| More than 10 tasks (>10)                             | +1             |
| **Total**                                            | **+16 → HIGH** |

---

## Clarifications Resolved

### Q1: `base_exam_snapshot_hash` — Field Set and Algorithm

**Finding:** FR-006 referenced "a hash of key base exam fields" without naming them. Ambiguous field set causes false positives/negatives in drift detection.

**Decision:** SHA-256 of sorted-key JSON of `{id, workflow_status, title, duration_minutes, total_marks, passing_marks, questions_count/topics_count (type-specific), updated_at}`. Field list MUST live as a single exported constant in `packages/domain-core`.

**Rationale:** Single source of truth prevents drift between creation-time hash computation and change-detection hash comparison.

**Impact:** FR-006, FR-007, FR-012 all updated to reference the constant.

---

### Q2: Worker Multi-Tenant Iteration and Reactive-Trigger Mechanism

**Finding:** Worker candidate query assumed one DB. Reactive trigger from heartbeat was unspecified (inline call vs. job queue), risking p95 < 100ms SLA breach.

**Decision:** Worker receives `tenantSlug` per job; a "tenant dispatcher" enqueues one BullMQ job per active tenant. Heartbeat MUST enqueue `auto_submit:{attempt_id}` BullMQ job (deduplication ID). Heartbeat endpoint never blocks on submission logic.

**Rationale:** Decouples heartbeat response latency from submission processing. BullMQ deduplication ID prevents duplicate force-submit jobs.

**Impact:** Worker contract section updated with tenant dispatcher pattern.

---

### Q3: Single-Attempt Race Condition — Lock Strategy Correction

**Finding:** BR-008 used invalid PostgreSQL syntax (`WITH LOCK`) and `SELECT COUNT(*) FOR UPDATE` does not prevent phantom reads — two concurrent requests can both see COUNT=0 before either INSERT commits.

**Decision:** Use `pg_try_advisory_xact_lock(hashtext(user_id || ':' || scheduled_exam_id))` to serialize concurrent attempt-start requests for the same `(user_id, scheduled_exam_id)` pair.

**Rationale:** Advisory transaction locks are the correct PostgreSQL mechanism for serializing application-level uniqueness without a blocking FOR UPDATE on a non-existent row.

**Impact:** BR-008 corrected with proper lock syntax.

---

### Q4: HTTP Response When `attempt_end_time` Exceeded at Submit

**Finding:** Late submission path recorded `auto_submitted=true` but HTTP status was unspecified — returning 4xx would break retry logic and risk losing student answers.

**Decision:** Return **HTTP 200** with `{ success: true, data: { status: "SUBMITTED", auto_submitted: true, forced_submission_reason: "ATTEMPT_TIME_EXCEEDED" } }`.

**Rationale:** Late submission is a valid (transformed) success, not an error. The student's answers must be preserved.

**Impact:** Submit endpoint error/success contract updated.

---

### Q5: Student Authorization Boundary

**Finding:** FR-008 validation did not specify required role; no guard preventing Operators from starting attempts. Per-exam enrollment scope undefined.

**Decision:** `role = STUDENT` required; Operators receive `403 AUTH.FORBIDDEN`. Per-exam enrollment deferred to a future stage.

**Rationale:** Workspace authentication is sufficient for Stage 38 scope. Finer enrollment controls are a separate concern.

**Impact:** Attempt start endpoint auth section updated.

---

## Architecture Governance Compliance

| Check                                      | Status | Notes                                             |
| ------------------------------------------ | ------ | ------------------------------------------------- |
| No cross-tenant access (ADR-0001)          | ✅     | Tenant resolver + scoped queries confirmed        |
| License middleware on all workspace routes | ✅     | Explicitly specified                              |
| Server-authoritative time (ADR-0006)       | ✅     | All time logic uses server UTC                    |
| Idempotency for submissions                | ✅     | BullMQ dedup ID + DB guard                        |
| Transaction boundaries complete            | ✅     | Single-attempt TX + worker submit TX              |
| Worker-only finalization                   | ✅     | Auto-submit via BullMQ; frontend has no authority |
| Advisory lock for race condition           | ✅     | `pg_try_advisory_xact_lock` specified             |

**Overall:** COMPLIANT

---

## Scope Update

| Item                | Status                                                                        |
| ------------------- | ----------------------------------------------------------------------------- |
| Reminder dispatch   | DEFERRED — schema fields captured; background job deferred to follow-up stage |
| Per-exam enrollment | DEFERRED — workspace auth boundary sufficient for Stage 38                    |

---

## Next Step

Proceed to Step 3 — Plan.
