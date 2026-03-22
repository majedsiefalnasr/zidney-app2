# Specify Report — Category Values

**Step:** 1 — Specify
**Timestamp:** 2026-03-22T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Specification for **Category Values** (STAGE_31) is complete. The spec establishes Category Values as the selectable dimension entries belonging to a parent Category — they are the concrete, enumerable options operators tag onto questions and exam configurations.

The specification covers all functional requirements, a complete data model, status workflow integration, translation-driven display, optional scope-filter linking tables, a full CRUD API with 5 endpoints, and all constitutional compliance guards. No `[NEEDS CLARIFICATION]` markers remain.

---

## Inputs Reviewed

- `specs/phases/03_BACKOFFICE_CORE/03_CONTENT_CLASSIFICATION/STAGE_31_CATEGORY_VALUES.md`
- `specs/runtime/030-categories/spec.md` (parent Categories stage — dependency context)
- `specs/runtime/031-category-values/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                                                                     | Rationale                                                                                   |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | `name` and `description` stored in shared `translations` table, not as columns               | Consistent with Categories design; workspace default language fallback supported            |
| 2   | `category_id` is immutable post-creation                                                     | Moving a value between categories would break classification integrity in snapshots         |
| 3   | Hard delete blocked if value is referenced by questions or exams; soft delete only           | Referential integrity preserved; historical records remain valid                            |
| 4   | Scope filters (`category_value_subjects`, `category_value_divisions`) are optional FK tables | Only created when parent Category has explicit scope restrictions; avoids unnecessary joins |
| 5   | `SELECT FOR UPDATE` on status transitions                                                    | Prevents concurrent workers from racing on a transition to `APPROVED` or `ENABLED`          |
| 6   | `code` unique per `(category_id, workspace_slug)` composite                                  | Enforces namespace uniqueness within classification dimension                               |
| 7   | Schema version `1.15.0`                                                                      | Follows semver minor bump after Stage 030 (Categories) which was `1.14.0`                   |
| 8   | ENABLED values are the only valid targets for question tagging and auto-selection            | Guarantees exam content is built from approved, active classifications only                 |

---

## Functional Requirements Captured

- US-01: Create a Category Value with code, translations (name + description), and optional scope filters
- US-02: List Category Values for a given Category with pagination, status filter, and translation resolution
- US-03: Read a single Category Value by ID including all translations and scope links
- US-04: Update code, translations, and scope filters (status transitions via dedicated endpoint)
- US-05: Advance status through workflow: COMPLETED → UNDER_REVIEW → APPROVED → ENABLED; ENABLED ↔ DISABLED
- US-06: Manage scope filters — link/unlink subjects and divisions (must be subset of parent Category's scope)
- US-07: Soft-delete a Category Value if unreferenced; block hard delete if referenced by questions or exams

---

## Clarifications Required

None — specification is fully resolved.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                      |
| --------------------------------------- | ------ | -------------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | All tables scoped to tenant DB; workspace_slug in all queries              |
| License middleware requirement captured | ✅     | Declared mandatory on all `/workspaces/:slug/category-values` routes       |
| Snapshot integrity requirement captured | ✅     | Category Value FK captured at attempt start; no live re-resolution         |
| Idempotency strategy defined            | ✅     | POST uses category_id + code dedup; PATCH uses version field check         |
| Transaction boundaries identified       | ✅     | Write + translation upsert in single transaction; scope table ops included |
| Server-authoritative time enforced      | ✅     | `created_at`, `updated_at`, `deleted_at` set server-side only              |
| Error contract enforced                 | ✅     | All endpoints return `{ success, data, error }`                            |
| Structured logging declared             | ✅     | `request_id`, `workspace_slug`, `category_value_id` in log events          |

**Overall:** COMPLIANT

---

## Open Risks

| Risk                                                               | Severity | Mitigation                                                               |
| ------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------ |
| High row count when workspace has many categories with many values | MEDIUM   | Mandatory indexes on `(category_id, status)` ensure query performance    |
| Scope filter table joins could be slow without proper coverage     | MEDIUM   | FK indexes on both linking tables; queries filtered by category_id first |
| Concurrent status transitions under load                           | LOW      | `SELECT FOR UPDATE` locking prevents race conditions                     |

---

## Output Artifacts

| Artifact                   | Path                                                           | Status     |
| -------------------------- | -------------------------------------------------------------- | ---------- |
| spec.md                    | `specs/runtime/031-category-values/spec.md`                    | ✅ Written |
| checklists/requirements.md | `specs/runtime/031-category-values/checklists/requirements.md` | ✅ Written |
