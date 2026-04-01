# Specify Report — Scheduled Exam Engine

**Step:** 1 — Specify
**Timestamp:** 2026-04-01T00:05:00Z
**Status:** COMPLETE

---

## Summary

Specification complete for STAGE_38_SCHEDULED_ENGINE. The `spec.md` (49 KB) defines the full
Scheduled Exam Engine: a per-tenant `scheduled_exams` table that binds an existing ENABLED base
exam (MCQ or Traditional) to a UTC time window with server-side enforcement, attempt binding,
reconnection grace logic, auto-submit worker contract, and single-attempt protection.

Zero `[NEEDS CLARIFICATION]` markers — all decisions resolved inline.

---

## Inputs Reviewed

- `specs/phases/03_BACKOFFICE_CORE/04_EXAM_ENGINE_CORE/STAGE_38_SCHEDULED_ENGINE.md`
- `specs/runtime/036-mcq-exam-config/spec.md` (MCQ exam config — base exam reference)
- `specs/runtime/035-traditional-question-model/spec.md` (Traditional exam — base exam reference)

---

## Artefacts Created

| Artefact                   | Path                                                                 | Size  |
| -------------------------- | -------------------------------------------------------------------- | ----- |
| spec.md                    | `specs/runtime/038-scheduled-exam-engine/spec.md`                    | 49 KB |
| checklists/requirements.md | `specs/runtime/038-scheduled-exam-engine/checklists/requirements.md` | 5 KB  |

---

## Key Decisions

| #   | Decision                                                                                | Rationale                                                                                                             |
| --- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | `base_exam_snapshot_hash` column captures base exam state at ENABLED transition         | Enables drift detection — if base exam changes post-scheduling the hash mismatch triggers `base_exam_modified = true` |
| 2   | Polymorphic FK (`base_exam_id + exam_type`) validated at application layer only         | PostgreSQL cannot enforce polymorphic FK natively; validated in service layer                                         |
| 3   | Heartbeat persistence in DB (`last_heartbeat_at`), Redis used only for distributed lock | Ensures connection-state survives worker restarts; Redis lock prevents duplicate force-submission                     |
| 4   | `attempt_end_time = min(start_time + exam_duration, scheduled_exam.end_datetime)`       | Guarantees no attempt exceeds the scheduled window regardless of exam duration                                        |
| 5   | Reminder dispatch deferred to follow-up stage                                           | Schema columns captured (`reminder_before_start`, `reminder_before_end`); implementation deferred                     |

---

## Functional Requirements Captured (13)

- FR-001: Scheduled exam CRUD (create, list, get, update, soft-delete) per tenant
- FR-002: Workflow transition APPROVED → ENABLED (base exam must be ENABLED)
- FR-003: Re-approval API after detected base exam change invalidation
- FR-004: Server-side time gate for attempt start (tolerance window respected)
- FR-005: Attempt binding with `scheduled_end_time = min(start_time + duration, end_datetime)`
- FR-006: Single-attempt enforcement (`allow_single_attempt` flag, transactional count check)
- FR-007: Heartbeat API endpoint (client pings, server persists `last_heartbeat_at`)
- FR-008: Auto-submit worker — monitors active scheduled attempts, force-submits on expiry/grace
- FR-009: Reconnection grace (30s window from last heartbeat)
- FR-010: Immutability enforcement post-ENABLED on core scheduling fields
- FR-011: Immutability enforcement post-attempts on all structural fields
- FR-012: Workflow invalidation if base exam modified after scheduling
- FR-013: All submission operations idempotent (duplicate submission prevention)

---

## API Endpoints (10)

| #   | Method | Path                                                | Auth Level |
| --- | ------ | --------------------------------------------------- | ---------- |
| 1   | POST   | `/api/v1/:workspace/scheduled-exams`                | Admin      |
| 2   | GET    | `/api/v1/:workspace/scheduled-exams`                | Admin      |
| 3   | GET    | `/api/v1/:workspace/scheduled-exams/:id`            | Admin      |
| 4   | PATCH  | `/api/v1/:workspace/scheduled-exams/:id`            | Admin      |
| 5   | DELETE | `/api/v1/:workspace/scheduled-exams/:id`            | Admin      |
| 6   | POST   | `/api/v1/:workspace/scheduled-exams/:id/workflow`   | Admin      |
| 7   | POST   | `/api/v1/:workspace/scheduled-exams/:id/re-approve` | Admin      |
| 8   | POST   | `/api/v1/:workspace/scheduled-exams/:id/attempts`   | Student    |
| 9   | POST   | `/api/v1/:workspace/attempts/:id/heartbeat`         | Student    |
| 10  | POST   | `/api/v1/:workspace/attempts/:id/submit`            | Student    |

---

## Clarifications Required

None — all decisions resolved inline by speckit.specify.

---

## Architecture Governance Compliance

| Check                                              | Status | Notes                                                                        |
| -------------------------------------------------- | ------ | ---------------------------------------------------------------------------- |
| No cross-tenant access introduced (ADR-0001)       | ✅     | All queries scoped by tenant pool                                            |
| License middleware requirement captured            | ✅     | Specified on all workspace routes                                            |
| Snapshot integrity requirement captured (ADR-0002) | ✅     | `base_exam_snapshot_hash` + snapshot columns at ENABLED                      |
| Idempotency strategy defined                       | ✅     | Idempotency key required on submit; duplicate check on heartbeat             |
| Transaction boundaries identified                  | ✅     | Single-attempt check + attempt create in one TX; worker submit transactional |
| Server-authoritative time enforced (ADR-0006)      | ✅     | All time decisions use server UTC; client time explicitly forbidden          |
| Trust chain respected                              | ✅     | worker-only finalization; frontend has no submission authority               |
| Import boundaries respected                        | ✅     | No UI → DB imports; domain packages only                                     |

**Overall:** COMPLIANT

---

## Open Risks

- Reminder dispatch deferred — schema captures fields but no background job logic yet. Low risk; explicitly noted as deferred.
- Polymorphic FK not enforced at DB level — application-layer validation required; must be covered by service tests.

---

## Next Step

Proceed to Step 2 — Clarify.
