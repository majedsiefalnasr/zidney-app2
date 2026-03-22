# Specify Report — Categories (Classification Dimensions)

**Step:** 1 — Specify
**Timestamp:** 2026-03-22T00:00:00.000Z
**Status:** COMPLETE

---

## Summary

Specification complete for **Categories (Classification Dimensions)** — the structured academic classification dimension feature of the Zidney exam platform. The stage implements a full Category CRUD API with parent-child hierarchy, subject/division scoping, and RBAC enforcement. All 10 Constitutional rules confirmed compliant. Zero `[NEEDS CLARIFICATION]` markers remain.

---

## Inputs Reviewed

- `specs/runtime/030-categories/spec.md` (1,148 lines)
- `specs/runtime/030-categories/checklists/requirements.md` (143 lines)
- `specs/phases/03_BACKOFFICE_CORE/03_CONTENT_CLASSIFICATION/STAGE_30_CATEGORIES.md`

---

## Key Decisions

| #   | Decision                                                              | Rationale                                                                           |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Category is a classification axis, NOT a content hierarchy            | Prevents confusion with subjects/divisions; categories only annotate questions      |
| 2   | Three tables: `categories`, `category_subjects`, `category_divisions` | Separates scope restriction into explicit join tables; empty = global scope         |
| 3   | Soft-delete only (status DISABLED), hard delete restricted            | Prevents data loss when categories referenced in questions or auto-selection config |
| 4   | Parent-child hierarchy limited to max depth 3                         | Avoids unbounded recursion; enforced at write time via ancestor chain traversal     |
| 5   | Circular parent detection enforced at write time                      | Database cannot enforce this; application-level validation required                 |
| 6   | `question_manage` OR `classification_manage` permission gates writes  | Supports both question-centric and classification-centric staff roles               |
| 7   | `MIN_SCHEMA_VERSION = "1.14.0"` set                                   | Ensures tenants are migrated before API calls can succeed                           |
| 8   | Static `/tree` route before `/:id`                                    | Hono routing rule: static segments must precede parameterized segments              |
| 9   | Empty `category_subjects` / `category_divisions` = global scope       | Explicit semantic: no rows = category applies to all subjects/divisions             |
| 10  | No category_values in this stage                                      | Category values are STAGE_31; this stage provides the dimension container only      |

---

## Functional Requirements Captured

- Category CRUD: Create, Read (single + list), Update, Soft-delete (status DISABLED)
- Category tree view endpoint (`GET /tree`) returning nested hierarchy
- Parent-child relationships with circular reference detection
- Max hierarchy depth = 3 levels
- Subject scoping via `category_subjects` join table (optional; empty = global)
- Division scoping via `category_divisions` join table (optional; empty = global)
- Unique constraint on `name` per tenant
- Unique constraint on `code` per tenant (when provided)
- Status lifecycle: ENABLED → DISABLED; hard delete blocked when referenced
- RBAC: `question_manage` OR `classification_manage` permission required for all writes
- License middleware mandatory on all workspace category routes
- Server-authoritative timestamps only

---

## Clarifications Required

None — all 10 Q&A pairs resolved within spec.md.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                                                       |
| --------------------------------------- | ------ | --------------------------------------------------------------------------- |
| No cross-tenant access introduced       | ✅     | All three tables in tenant DB exclusively                                   |
| License middleware requirement captured | ✅     | Mandatory on all workspace routes                                           |
| Snapshot integrity requirement captured | ✅     | Category FKs in downstream content captured at attempt start                |
| Idempotency strategy defined            | ✅     | Upsert semantics for scope replacement                                      |
| Transaction boundaries identified       | ✅     | All writes (create, update, soft-delete, scope mutations) are transactional |
| Server-authoritative time enforced      | ✅     | `created_at`/`updated_at` set server-side only                              |

**Overall:** COMPLIANT

---

## Open Risks

None identified.

---

## Next Step

Proceed to Step 2 — Clarify.
