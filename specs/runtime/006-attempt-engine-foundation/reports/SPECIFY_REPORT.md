# Specify Report – STAGE_06_ATTEMPT_ENGINE_FOUNDATION

**Report Date:** 2026-02-18T00:00:00Z  
**Stage:** STAGE_06_ATTEMPT_ENGINE_FOUNDATION  
**Phase:** 01_PLATFORM_FOUNDATION  
**Status:** ✅ COMPLETE

---

## Overview

The specification phase has successfully defined the formal requirements for the Attempt Engine Foundation. The output document (`spec.md`) comprehensively defines all functional, technical, and compliance requirements for this critical academic integrity layer.

**Specification File:** [spec.md](spec.md)  
**Size:** 1,241 lines

---

## Specification Coverage

### ✅ Sections Completed

1. **Executive Summary** – Core guarantees and design principles
2. **Feature Overview** – Unified attempt model, snapshot integrity, worker-based grading
3. **Constitutional Compliance Declaration** – All 7 ADRs verified
4. **Isolation Impact Analysis** – Database-per-tenant, connection pooling, tenant resolution
5. **License & Version Enforcement** – Middleware, license states, version compatibility
6. **Data Model Changes** – `attempts` and `attempt_progress` tables with indexes
7. **Transaction Boundaries** – 5 critical operations fully defined
8. **Idempotency & Safety** – Double-submission protection, worker failure recovery
9. **Authoritative Time Usage** – Server-only validation, mode-specific rules
10. **Observability Requirements** – Structured logging, event taxonomy, error contract
11. **Rate Limiting & Abuse Protection** – Per-endpoint classifications
12. **Layer Separation Confirmation** – Frontoffice/API/Worker roles verified
13. **Failure Modes & Recovery** – Database, version, license, worker failures
14. **Test Strategy** – Unit, integration, transaction, idempotency, version, isolation, concurrency
15. **Explicit Non-Goals** – 7 items confirmed out of scope
16. **Success Criteria** – 10 measurable production readiness outcomes
17. **Final Constitutional Compliance Statement** – Verified against all ADRs

---

## Key Constraints Enforced

✅ **ADR-0001:** Database-per-tenant isolation (connection pooling per tenant)  
✅ **ADR-0002:** Snapshot immutability for attempts (serialized snapshots, no live references)  
✅ **ADR-0006:** Server-authoritative time only (started_at, submitted_at server-generated)  
✅ **ADR-0007:** Version compatibility enforcement (exam_version, schema_version validation)  
✅ **Transactional Writes:** All database operations wrapped in transactions  
✅ **No Client-Side Grading:** Worker-only grading pipeline  
✅ **License Middleware:** Enforced before any attempt access  
✅ **No Cross-Tenant Sharing:** Tenant isolation verified throughout

---

## Scope Definition

### In Scope

- Unified attempts table supporting all delivery types (MCQ_ASSESSMENT, MCQ_EXAM, TOPIC_EXAM, etc.)
- Snapshot-based configuration immutability
- Mode-aware behavior (RELAX, CHRONO, RUSH)
- Real-time progress tracking (idempotent)
- Worker-based grading pipeline
- License enforcement before attempt start
- Concurrency safety with optimistic locking
- Upgrade-safe schema versioning
- Structured logging with correlation IDs
- Failure recovery mechanisms

### Deferred/Out of Scope

- Advanced analytics queries (scheduled for Phase 3)
- Attempt history/audit trail (may extend snapshot model)
- Real-time WebSocket integration (covered in Frontoffice phase)
- Mobile-specific attempt modes
- Third-party LMS integration
- Offline attempt support
- Attempt migration between workspaces

---

## Compliance Verification

| ADR      | Requirement                   | Specification Status                                    |
| -------- | ----------------------------- | ------------------------------------------------------- |
| ADR-0001 | Database-per-tenant           | ✅ Isolation rules defined, connection pooling mandated |
| ADR-0002 | Snapshot immutability         | ✅ Snapshots frozen at start, no live references        |
| ADR-0003 | White-label visual only       | ✅ N/A for backend engine                               |
| ADR-0004 | Single runtime engine         | ✅ Unified attempts table confirmed                     |
| ADR-0005 | Upgrade opt-in                | ✅ Version compatibility enforced                       |
| ADR-0006 | Server-authoritative time     | ✅ All timing server-generated                          |
| ADR-0007 | Product version compatibility | ✅ Version matrix defined                               |
| ADR-0008 | Semantic versioning           | ✅ Schema versioning enforced                           |

---

## Critical Dependencies Identified

1. **Database Schema Migration** – Requires migration system (Phase 01)
2. **License Middleware** – Must be functional before Attempt Engine
3. **Tenant Resolver** – Must distribute connections per tenant
4. **Worker Infrastructure** – Required for grading pipeline
5. **Structured Logging** – Correlation ID propagation mandatory

---

## Risk Assessment

| Risk                           | Level    | Mitigation                                              |
| ------------------------------ | -------- | ------------------------------------------------------- |
| Snapshot corruption on upgrade | Medium   | Version compatibility matrix, snapshot validation tests |
| Concurrency race conditions    | High     | Optimistic locking, transaction tests, test suite       |
| Cross-tenant data leakage      | Critical | Connection pool isolation, explicit tenant context      |
| Client-side grading bypass     | High     | Worker-only enforcement, no scoring on frontend         |
| License enforcement bypass     | High     | Middleware pre-execution, license validation tests      |

---

## Recommendations for Clarification Phase

The following items should be clarified before proceeding to planning:

1. **Submission Idempotency Window** – How long after submission can duplicate submissions be accepted?
2. **Concurrency Lock Strategy** – Pessimistic vs. optimistic locking trade-offs for high-volume exams?
3. **Snapshot Size Limits** – Maximum JSON size for question/grading snapshots?
4. **Grading Latency SLA** – Maximum time for worker-based grading completion?
5. **Version Rollback Strategy** – How to handle attempts from superseded schema versions?

---

## Next Phase: Clarify

The specification is ready for clarification. The Clarify agent will address ambiguities in:

- Transaction boundaries and failure recovery
- Idempotency semantics and window sizing
- Concurrency resolution strategies
- Version enforcement edge cases
- Middleware enforcement ordering

**Proceed to:** [Step 2 – Clarify](#)

---

**Report Status:** ✅ COMPLETE  
**Action:** Awaiting confirmation to proceed to Clarify phase
