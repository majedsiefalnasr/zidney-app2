# Specification Quality Checklist: Scheduled Exam Engine

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-04-01
**Feature**: [spec.md](../spec.md)
**Stage**: STAGE_38_SCHEDULED_ENGINE

---

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) — spec describes WHAT, not HOW in terms of tech stack
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders (Feature Summary) while providing sufficient technical detail for engineering
- [x] All mandatory sections completed

---

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable (SC-001 through SC-005 with time/count metrics)
- [x] Success criteria are technology-agnostic (describe outcomes, not framework-specific behavior)
- [x] All acceptance scenarios are defined (8 user stories × multiple scenarios each)
- [x] Edge cases are identified (6 edge cases documented)
- [x] Scope is clearly bounded (Assessments and Exercises explicitly excluded)
- [x] Dependencies and assumptions identified (6 assumptions, dependency table)

---

## Architecture Governance Checklist

- [x] **Tenant isolation verified** — all queries explicitly scoped to tenant DB pool; no cross-tenant joins; no shared tables; `workspace_slug` in every log
- [x] **License middleware applied on all routes** — NFR-005 mandates license validation on every `/api/v1/workspace/:slug/` route; explicitly listed in Validation Criteria
- [x] **Server-side time authority enforced** — NFR-001 and BR-005 prohibit client timestamps for any time-gate decision; all comparisons use database `NOW()` / server UTC; documented in BR-005 table
- [x] **Immutability rules defined** — FR-004, BR-003, BR-004, and FR-013 specify exactly which fields are immutable under which conditions (post-ENABLED vs post-attempts)
- [x] **Auto-submit worker contract defined** — Worker Contract section specifies query, lock, transaction, update, commit, release, log, idempotency, and failure behavior
- [x] **Single attempt enforcement specified** — FR-008, BR-008 specify transactional row-level lock pattern for race-free enforcement
- [x] **Idempotency required for submission operations** — NFR-002 and FR-010 define idempotency contract; worker re-validation step documented
- [x] **Error contract followed (Zidney standard)** — all error responses use `{ success: false, data: null, error: { code, message } }` format; full error code table provided
- [x] **Structured logging with required fields** — Observability section lists `workspace_slug`, `scheduled_exam_id`, `attempt_id`, `request_id`, `submission_reason`, `event_type` as mandatory log fields
- [x] **Reconnection grace logic defined** — BR-009 documents 30-second grace window formula; worker condition 3 handles `CONNECTION_TIMEOUT`; heartbeat resume path documented
- [x] **Workflow status enforcement specified** — FR-006, BR-011, FR-007 define APPROVED → ENABLED transition, pre-conditions, blocking conditions, and re-approval path
- [x] **Database indexes specified** — all indexes for `scheduled_exams` and `attempts` additions explicitly defined with SQL in Database Schema section
- [x] **Migration strategy identified (forward-only)** — NFR-008 and Database Schema section mandate forward-only migrations in `apps/api/src/db/tenant/migrations/`; two separate migration files identified

---

## Feature Readiness

- [x] All functional requirements (FR-001 through FR-013) have clear acceptance criteria
- [x] User scenarios cover primary flows (create, enable, start attempt, heartbeat, auto-submit, reconnection, manage, workflow invalidation)
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification outside of schema and API shape examples (which are necessary for clarity)
- [x] Worker contract is implementation-oriented by design — necessary for the auto-submit worker to be built to spec

---

## Scope Boundary Verification

- [x] Assessments excluded (BR-001, Overview)
- [x] Exercises excluded (BR-001, Overview)
- [x] Reminder delivery mechanism scoped out (Assumption 6)
- [x] Grading logic deferred to attempt/grading engine (Overview "What is NOT")
- [x] Queue infrastructure setup deferred to Worker Infrastructure (Assumption 5)
- [x] Client-side timing authority explicitly forbidden in multiple sections

---

## Notes

- **FR-012** (Base Exam Modification Detection) depends on a hook or trigger in Stage 36 (MCQ)
  and Stage 35 (Traditional) to notify the scheduled exam layer when a base exam is updated.
  The integration point should be confirmed during planning.
- **Reminder delivery** (FR-001 fields `reminder_before_start`, `reminder_before_end`) is
  schema-captured in this stage but the actual dispatch mechanism is deferred. A follow-up
  stage or ticket should define the notification pipeline.
- The `base_exam_snapshot_hash` field (used to detect base exam drift post-scheduling) requires
  a canonical field list for hashing to be agreed on during implementation. Suggested: hash of
  `(subject_id, selection_mode, total_questions, pass_type, pass_value, duration_minutes)` for
  MCQ and equivalent for Traditional.
- Items marked complete above have been validated against the spec content. All items passed.
