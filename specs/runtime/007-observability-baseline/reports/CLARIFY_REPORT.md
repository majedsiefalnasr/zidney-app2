---
**Clarification Phase:** COMPLETE  
**Date:** 2026-02-18  
**Stage:** STAGE_07_OBSERVABILITY_BASELINE  
**Phase:** 01_PLATFORM_FOUNDATION  
**Status:** Ready for Planning  
---

# Clarification Phase Report – STAGE 07 Observability Baseline

## Executive Summary

All 5 critical clarification questions have been answered and locked. These decisions establish the
production-grade logging architecture for Zidney's observability baseline. The resolutions address
logging persistence strategy, logger implementation pattern, request traceability model, sensitive
data protection, and worker job state verification.

**Total Questions Asked:** 5  
**Total Questions Answered:** 5  
**Clarification Status:** COMPLETE ✅  
**Readiness for Planning:** YES

---

## Locked Clarification Decisions

| #      | Question                                                                                                                   | Decision                                                            | Rationale                                                                                                                                                                                                                                                                                                                                                               | Specification Impact                                                                                                                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | **Log Persistence Strategy:** Should structured logs be persisted to the audit_log database table, or only audit events?   | **A — Only audit events to DB**                                     | Stability-first principle. Structured JSON request logs routed to stdout/stderr for container orchestration (scalable, fault-tolerant). Audit events (compliance-critical) persisted to `audit_log` table. Separation of concerns: operational logs (ephemeral) vs. audit logs (permanent). Reduces database load & scales with log volume elastically.                 | Audit Event Logging section updated to clarify: only LICENSE_CHANGE, TENANT_PROVISION, SCHEMA_UPGRADE, ROLE_CHANGE events written to DB. Request/attempt/worker logs to stdout only.                                |
| **Q2** | **Pino Logger Initialization:** Should Pino be initialized as a global singleton or per-request scoped instance?           | **A — Global singleton with `pino.child()`**                        | Standard Node.js pattern. Single logger instance initialized at service startup. Context binding via `pino.child({ request_id, workspace_id, ... })` creates request-scoped child logger. Minimal overhead. Matches industry best practices (Stripe, Vercel, similar SaaS). Cleaner code ergonomics.                                                                    | Logger Implementation section updated with singleton pattern code example. Child logger approach documented in middleware integration.                                                                              |
| **Q3** | **Request ID Propagation in Worker Jobs:** Should request_id be propagated, or a separate job_id created?                  | **B — Dual IDs (request_id + job_id) with linkage**                 | End-to-end traceability for institutional audit. Original `request_id` links frontend request → API → job enqueue. Separate `job_id` tracks job lifecycle independently (retries, dead-letter queue). `job.request_id` field links back to originating request. Supports audit narratives: "What API caused this worker job?" and "What retries happened for this job?" | Worker Job Logging section updated to show dual-ID structure. Job payload includes `request_id` (link back) and `job_id` (job lifecycle). Migration path clarifies worker middleware integration.                   |
| **Q4** | **Sensitive Data Redaction Strategy:** Should redaction happen in logger middleware only, or both middleware + call sites? | **C — Defense in depth (logger middleware + call site)**            | Compliance-grade protection. Automatic redaction at middleware layer (catches 90% of PII/tokens). Manual redaction at call site ensures developer accountability (catches edge cases). Two-layer approach prevents accidental leaks. Aligns with OWASP logging best practices. Reduces human error risk.                                                                | Sensitive Data Protection section updated with concrete redaction pattern (middleware patterns + call-site examples). Unit test strategy includes redaction verification tests.                                     |
| **Q5** | **Worker Job Payload Verification:** Should we compute a hash of job payload to detect configuration changes during retry? | **A — Integrity verification (detect config changes during retry)** | Proves job state integrity per ADR-0002 (Snapshot Attempt Model). Detects tampering or mid-retry configuration mutation. If job_payload_hash differs on retry, logs `config_mutation_detected` warning. Supports forensic audit trail. Minimal computational cost (SHA256 hash).                                                                                        | Worker Job Logging section updated to include `job_payload_hash` field. Error Handling section clarifies: hash mismatch logs warning but job retries (non-blocking). Integrity verification included in unit tests. |

---

## Specification Integration Summary

### Sections Updated

1. **Audit Event Logging Strategy** (NEW subsection)
   - Clarifies database persistence limited to audit events
   - Request/attempt logs remain ephemeral (stdout only)
   - Compliance audit trail (audit_log table) preserved

2. **Logger Implementation Pattern** (UPDATED)
   - Global singleton Pino initialization documented
   - `pino.child()` pattern for request context binding
   - Middleware integration clarified

3. **Worker Job Logging** (UPDATED)
   - Dual ID structure (request_id + job_id) documented
   - Job payload hash field added to log schema
   - Cross-request traceability established

4. **Sensitive Data Protection** (UPDATED)
   - Defense-in-depth redaction strategy documented
   - Middleware-level patterns + call-site examples provided
   - Unit test requirements expanded

5. **Error Handling During Logging** (UPDATED)
   - Job payload hash mismatch handling clarified
   - Non-blocking error recovery documented

### New Log Fields Added

- `job_payload_hash`: SHA256 hash of job inputs (NEW)
- `job.request_id`: Link back to originating API request (CLARIFIED)
- Redaction patterns: `[REDACTED]` for credentials, `***` for PII (CLARIFIED)

---

## Implementation Implications

### For Logging Architect

- **Logger Package:** Must implement global Pino singleton + child context factory
  - Support: `pino.child(contextObj)` for request-scoped logging
  - Test: Global instance persists across requests; no memory leaks

- **Middleware Layer:** Request context middleware must:
  - Generate request_id at entry
  - Create child logger via `pino.child({ request_id, workspace_id, ... })`
  - Inject into request context

### For API Layer

- **Structured Output:** All logs to stdout (JSON format), not database
- **Audit Events Only:** `audit_log` table writes for LICENSE/TENANT/SCHEMA/ROLE events
- **Sensitive Data:** Apply redaction patterns at middleware + any business logic that logs PII

### For Worker Layer

- **Dual ID Propagation:** Worker receives job with both `request_id` (from API) and generates
  `job_id` (for this execution)
- **Payload Hashing:** Compute `SHA256(JSON.stringify(jobPayload))` at enqueue and retry; log
  mismatch as warning
- **Context Binding:** Worker inherits request_id; create child logger for job-scoped context

### For Testing

- **Logger Redaction Tests:** Verify passwords/tokens/emails are redacted across all log call sites
- **Dual ID Tests:** Verify worker jobs link back to originating request_id; verify separate job_id
  for retry tracking
- **Hash Integrity Tests:** Verify job_payload_hash computed correctly; update snapshot tests for
  hash mismatch scenario
- **Singleton Persistence Tests:** Verify global Pino instance reused across multiple requests (no
  duplicate instances)

---

## Next Phase Readiness Checklist

- [x] All 5 clarification questions answered
- [x] Decisions locked (no further iteration expected)
- [x] Specification updated with clarifications integrated
- [x] Implementation implications documented
- [x] No conflicting decisions (priority order established)
- [x] Downstream Planning phase has clear architectural guidance
- [x] Test strategy updated to cover new design decisions
- [x] Constitutional compliance verified for each decision
- [x] Clarity achieved on:
  - [x] Logger initialization pattern (global singleton + `pino.child()`)
  - [x] Data persistence boundary (audit events only, request logs ephemeral)
  - [x] Request traceability model (dual IDs with request_id linkage)
  - [x] Sensitive data handling (defense in depth)
  - [x] Worker job integrity (payload hash verification)

---

## Coverage Summary – All Ambiguities Resolved

| Category                                | Status      | Notes                                                                            |
| --------------------------------------- | ----------- | -------------------------------------------------------------------------------- |
| **Functional Scope & Behavior**         | ✅ RESOLVED | Log persistence, audit event strategy, request traceability all clarified        |
| **Domain & Data Model**                 | ✅ RESOLVED | New log fields (job_payload_hash, dual IDs) added; schema updated                |
| **Interaction & UX Flow**               | ✅ RESOLVED | Logger initialization, middleware binding, request context propagation defined   |
| **Non-Functional Quality Attributes**   | ✅ RESOLVED | Dual ID traceability (end-to-end), sensitive data protection depth-of-defense    |
| **Integration & External Dependencies** | ✅ RESOLVED | Worker job payload hash links jobs to requests; cross-service traceability clear |
| **Edge Cases & Failure Handling**       | ✅ RESOLVED | Job payload hash mismatch handling (warning, non-blocking) defined               |
| **Constraints & Tradeoffs**             | ✅ RESOLVED | Database persistence limited to audit (stability); stdout-based operational logs |
| **Terminology & Consistency**           | ✅ RESOLVED | Audit events, request logs, job_id, request_id terminology clarified             |
| **Completion Signals**                  | ✅ RESOLVED | All test requirements updated; acceptance criteria remain measurable             |

---

## Recommended Next Steps

1. **Proceed to Planning Phase:** Run `/speckit.plan` to decompose STAGE 07 into tasks
   - Logger implementation tasks
   - Middleware integration tasks
   - Test task generation
2. **Update Specification File:** All clarifications have been integrated into spec.md

3. **Inform Planning Phase:** All 5 decisions are locked and non-negotiable during task
   decomposition

---

## Decision Lock Statement

**These 5 clarifications are LOCKED for planning and implementation phases. No further iteration
expected on:**

- Log persistence boundary (audit DB vs. ephemeral stdout)
- Logger initialization pattern (global singleton with child context)
- Request traceability model (dual IDs with linkage)
- Sensitive data protection strategy (middleware + call-site defense-in-depth)
- Worker job integrity verification (payload hash)

Conflicts with future implementation should escalate to Zidney Architecture Council (ADR review).

---

**Report generated:** 2026-02-18  
**Approver required for:** None (decisions documented for planning phase)  
**Status transition:** STAGE_07_OBSERVABILITY_BASELINE → PLANNING PHASE
