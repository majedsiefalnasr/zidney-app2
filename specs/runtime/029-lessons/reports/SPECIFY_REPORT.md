# Specify Report — Lessons

**Step:** 1 — Specify
**Timestamp:** 2026-03-21T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Specification complete for **Lessons** (STAGE_29) — the smallest structured academic classification
unit in Zidney's academic hierarchy, residing directly under Subject. The spec covers a full Lesson
CRUD API, tenant-DB-only migration, status lifecycle management (ENABLED | DISABLED), and
permission-gated operations.

---

## Inputs Reviewed

- `specs/phases/03_BACKOFFICE_CORE/02_ACADEMIC_STRUCTURE/STAGE_29_LESSONS.md`
- `specs/runtime/029-lessons/spec.md`
- `specs/runtime/029-lessons/checklists/requirements.md`
- Patterns from STAGE_28_SUBJECTS (domain convention reference)

---

## Key Decisions

| #   | Decision                                                                     | Rationale                                                                                    |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Status: `ENABLED \| DISABLED` (2 states)                                     | Stage file specifies exactly two states; subjects use 3-state engine but lessons are simpler |
| 2   | `DELETE /lessons/:id` → soft delete (status = DISABLED)                      | Stage file requires "soft delete via status change only"; no SQL DELETE exposed              |
| 3   | PATCH handles both field edits AND status changes                            | Avoids separate `/transition` endpoint; PATCH body must include at least one field           |
| 4   | `subject_id` immutable after creation                                        | Changing subject ownership violates uniqueness invariants and downstream content references  |
| 5   | DISABLED lessons are read-only for field edits                               | Prevents silent data drift on excluded content; re-enable first pattern                      |
| 6   | `created_by`/`updated_by` FK → `ON DELETE SET NULL`                          | Audit FK pattern; user deletion should not cascade-delete lesson records                     |
| 7   | Migration named `20260321_007_lessons.ts`                                    | Follows existing `YYYYMMDD_NNN_name.ts` convention                                           |
| 8   | Write operations require `question_manage` OR `subject_manage`               | Reads require only authenticated session (dropdown use cases)                                |
| 9   | Hard delete blocked when referenced by questions/auto-selection/exam configs | Stage rule: soft delete via status only                                                      |

---

## Functional Requirements Captured

- Lesson CRUD: `GET /lessons`, `POST /lessons`, `GET /lessons/:id`, `PATCH /lessons/:id`, `DELETE /lessons/:id` (soft delete)
- `subject_id` FK enforced (ON DELETE RESTRICT on subjects)
- `unique(subject_id, name)` constraint
- Status lifecycle: ENABLED → DISABLED via PATCH or DELETE endpoint
- Hard delete blocked if referenced by MCQ questions, traditional questions, auto-selection, or exam configs
- Permission gate: `question_manage` OR `subject_manage` for all write operations
- Division-level access scoping inherited transitively via parent Subject
- Tenant isolation: `lessons` table in tenant DB only, never master DB
- Structured logging with correlation ID on all operations
- Error contract: `{ success: boolean, data: object | null, error: { code, message } | null }`
- Forward-only tenant DB migration
- Indexes: `idx_lessons_subject_id`, `idx_lessons_status`, `unique(subject_id, name)`

---

## Clarifications Required

None — all design decisions resolved using stage file + STAGE_28_SUBJECTS patterns.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                |
| --------------------------------------- | ------ | -------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | `lessons` table resides exclusively in tenant DB                     |
| License middleware requirement captured | ✅     | Mandatory on all workspace lesson routes                             |
| Snapshot integrity requirement captured | ✅     | Lesson FK in downstream content snapshot-captured at attempt start   |
| Idempotency strategy defined            | ✅     | `LESSON_ALREADY_DISABLED` / `LESSON_ALREADY_ENABLED` explicit errors |
| Transaction boundaries identified       | ✅     | All writes (create, update, soft-delete) wrapped in transactions     |
| Server-authoritative time enforced      | ✅     | `created_at`/`updated_at` set by server only                         |

**Overall:** COMPLIANT

---

## Open Risks

None identified.

---

## Next Step

Proceed to Step 2 — Clarify.
