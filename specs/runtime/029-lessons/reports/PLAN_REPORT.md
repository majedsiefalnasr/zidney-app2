# Plan Report — Lessons

**Step:** 3 — Plan  
**Timestamp:** 2026-03-21T00:20:00.000Z  
**Status:** COMPLETE

---

## Summary

Full technical implementation plan produced for the Lessons feature (STAGE_29). The plan
mirrors the Subjects domain pattern (STAGE_28) exactly: raw-SQL repository, service-managed
transactions, Drizzle schema definition only, Zod validation, Hono router factory. No ADR
required — all patterns are established precedents. A total of 16 new files and 3 modified
files are planned. The data model is finalized, migration DDL is complete, error code registry
is defined, and all API contracts align with the spec after guardian remediation.

Guardian 3.1A ran 3 passes (both guardians PASS on final pass). All critical and high
violations were remediated before this report was written.

---

## Inputs Reviewed

- `specs/runtime/029-lessons/spec.md` (updated with 5 spec fixes during guardian remediation)
- `specs/runtime/029-lessons/plan.md` (updated with 3 plan fixes during guardian remediation)
- `specs/runtime/029-lessons/data-model.md`
- Subject domain reference patterns: `packages/domain-core/src/subjects/`

---

## Architecture Layers Touched

| Layer      | Planned Changes                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------- |
| API        | 7 new route files under `apps/api/src/routes/backoffice/lessons/`; mount in `backoffice/index.ts` |
| Worker     | None                                                                                              |
| Frontend   | None (Backoffice UI not in scope)                                                                 |
| DB Master  | None                                                                                              |
| DB Tenant  | New `lessons` table; 3 indexes; migration `20260321_007_lessons.ts`; version 1.12.0 → 1.13.0      |
| Domain     | New `packages/domain-core/src/lessons/` package (6 files); barrel export added to domain index    |
| Validation | `packages/validation/src/backoffice/lessons.schemas.ts` (5 Zod schemas)                           |

---

## Key Technical Decisions

| #   | Decision                                                                 | Rationale                                                                                                   |
| --- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 1   | Mirror STAGE_28_SUBJECTS pattern exactly                                 | Establishes consistent domain pattern; no new architectural patterns needed                                 |
| 2   | Case-insensitive functional index `LOWER(name)` for uniqueness           | Prevents race condition gap that plain `UNIQUE (subject_id, name)` would have                               |
| 3   | `GET /lessons/runtime` — license-only, no auth                           | Runtime endpoint for Frontoffice/MMC; subject_id required; returns flat `[{ id, name, code }]`              |
| 4   | `activeLessonsQuerySchema` distinct from `listLessonsQuerySchema`        | `subject_id` must be required for runtime endpoint; optional for admin list endpoint                        |
| 5   | `countLessonsForSubject` registered in `subjects.dependency-registry.ts` | Prevents subject soft-delete when lessons exist (two-layer: service + DB RESTRICT)                          |
| 6   | `lessons.dependency-registry.ts` stubbed for stage                       | Downstream tables (`mcq_questions` etc.) do not exist yet; each downstream stage registers its own FK check |
| 7   | PATCH guard ordering per Q10                                             | Fetch → LESSON_DISABLED check → idempotent status check → name-duplicate check → UPDATE                     |
| 8   | Soft-delete only (`DELETE` sets `status = DISABLED`)                     | Preserves referential integrity; downstream hard-delete protected by `ON DELETE RESTRICT` FKs               |
| 9   | Transaction via raw SQL (`BEGIN/COMMIT/ROLLBACK`)                        | `DbClient` interface has no `transaction()` method; matches Subjects domain pattern                         |

---

## Migration Impact

| Item                  | Value        | Notes                                                       |
| --------------------- | ------------ | ----------------------------------------------------------- |
| Migration required    | Yes          | `apps/api/src/db/tenant/migrations/20260321_007_lessons.ts` |
| `schema_version` bump | Yes          | `1.12.0 → 1.13.0` in `_schema_versions` table               |
| Backward compatible   | No           | All lesson routes require `MIN_SCHEMA_VERSION = "1.13.0"`   |
| Migration direction   | Forward-only | Idempotent DDL with `IF NOT EXISTS` guards                  |
| Master DB affected    | No           | Lessons reside exclusively in tenant DB                     |

---

## Transaction Boundaries

- `createLesson`: `BEGIN` → `subjectExists` check → name-duplicate check → `insertLesson` → `COMMIT`; catch → `ROLLBACK` → throw `LessonsError`
- `updateLesson`: `BEGIN` → `findLessonById` → PATCH guard sequence → `updateLessonRow` → `COMMIT`; catch → `ROLLBACK`
- `deleteLesson`: `BEGIN` → `findLessonById` → `LESSON_ALREADY_DISABLED` guard → `softDeleteLesson` → `COMMIT`; catch → `ROLLBACK`
- `listLessons`, `getLesson`, `getActiveLessons`: read-only; no transactions opened

Repository functions never open transactions — service layer exclusively owns `BEGIN/COMMIT/ROLLBACK`.

---

## Idempotency Strategy

- `POST /lessons`: name-duplicate pre-check (`lessonNameExistsInSubject`) + DB `23505`
  catch as race guard → always returns `409 LESSON_NAME_DUPLICATE` for duplicate `(subject_id, name)`
- `PATCH /lessons/:id` status field: `LESSON_ALREADY_ENABLED` / `LESSON_ALREADY_DISABLED`
  guards prevent idempotent status flips from issuing unnecessary UPDATEs
- `DELETE /lessons/:id`: `LESSON_ALREADY_DISABLED` guard prevents double soft-delete

---

## Constitutional Compliance

| Check                                  | Status | Notes                                                                         |
| -------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| No cross-tenant logic introduced       | ✅     | All DB access via `c.get('tenant').pool`; no global singleton                 |
| All writes are transactional by design | ✅     | `BEGIN/COMMIT/ROLLBACK` on all 3 write operations                             |
| Server-authoritative time enforced     | ✅     | `created_at`/`updated_at` set via `NOW()` in SQL; no client timestamps        |
| License middleware enforced            | ✅     | All routes: `tenant-resolver → schema-version-check → license-check → (auth)` |
| Version compatibility enforced         | ✅     | `MIN_SCHEMA_VERSION = "1.13.0"` enforced at middleware layer                  |
| No architecture redesign without ADR   | ✅     | All patterns mirror STAGE_28_SUBJECTS; no new architecture introduced         |
| Domain package purity                  | ✅     | No HTTP, no Hono, no env vars in `packages/domain-core/src/lessons/`          |
| Import boundary compliance             | ✅     | `apps/*→packages/*` only; `packages/*→apps/*` not present                     |

**Overall:** COMPLIANT

---

## Guardian 3.1A Summary

| Guardian                    | Pass 1  | Pass 2  | Pass 3 (final) |
| --------------------------- | ------- | ------- | -------------- |
| zidney-architecture-checker | PASS    | BLOCKED | PASS           |
| zidney-api-designer         | BLOCKED | BLOCKED | PASS           |

**Violations remediated** (6 total across 3 passes):

- C-1: `LESSON_HAS_DEPENDENT_CONTENT` HTTP status 422→409 (spec.md)
- C-2: Unique constraint updated to `LOWER(name)` functional index throughout spec.md
- H-3: `GET /lessons/runtime` added to spec (route table + full endpoint contract)
- H-4: `422 VALIDATION_ERROR` added to `GET /lessons/:id` and `DELETE /lessons/:id` error tables
- Arch-1: `getActiveLessons` service guard added (`subjectExists` check before query)
- Arch-2: Spec Q1 corrected to describe `db.query('BEGIN/COMMIT/ROLLBACK')` pattern (removed Drizzle reference)
- Plan-1: `activeLessonsQuerySchema` added to plan.md (required `subject_id` UUID schema)
- Plan-2: `GET /lessons/runtime` response shape aligned (flat array, not wrapped object)

---

## Open Risks

- **Medium:** `subjects.dependency-registry.ts` modification must be executed carefully — a
  missed registration would allow soft-deletion of a subject that still has lessons attached.
  Double-protection (service-layer count check + DB `ON DELETE RESTRICT`) mitigates this, but
  both layers must be in place.

---

## Next Step

Proceed to Step 4 — Tasks.
