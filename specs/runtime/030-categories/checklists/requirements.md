# Requirements Checklist — Categories (Classification Dimensions)

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-03-22
**Feature**: [spec.md](../spec.md)
**Stage**: STAGE_30_CATEGORIES
**Phase**: 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION

---

## Content Quality

- [x] No implementation details (languages, frameworks, APIs) in user stories or business rules
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders (user stories section)
- [x] All mandatory sections completed

---

## Functional Requirements

- [ ] CRUD endpoints implemented (list, create, get, update, soft-delete, tree view)
- [ ] `categories` table created with `parent_id` self-reference (`ON DELETE RESTRICT`)
- [ ] `category_subjects` join table created (FK → `categories.id ON DELETE CASCADE`, FK → `subjects.id ON DELETE CASCADE`)
- [ ] `category_divisions` join table created (FK → `categories.id ON DELETE CASCADE`, FK → `divisions.id ON DELETE CASCADE`)
- [ ] Hierarchy depth validated at service layer: root = depth 1, max allowed = depth 3
- [ ] `CATEGORY_MAX_DEPTH_EXCEEDED` (422) returned when parent is at depth 3
- [ ] Circular reference detection: category cannot be set as descendant of itself
- [ ] `CATEGORY_CIRCULAR_REFERENCE` (422) returned when `parent_id` creates ancestor cycle
- [ ] `parent_id` may be changed via PATCH (unlike `subject_id` in lessons domain)
- [ ] `parent_id: null` via PATCH promotes category to root (always depth-safe)
- [ ] Tenant-wide `name` uniqueness enforced (case-insensitive functional index)
- [ ] `CATEGORY_NAME_DUPLICATE` (409) returned for duplicate name
- [ ] Tenant-wide `code` uniqueness enforced (partial functional index — non-null only)
- [ ] `CATEGORY_CODE_DUPLICATE` (409) returned for duplicate code
- [ ] Multiple categories may have `code = NULL`
- [ ] Soft delete only — `DELETE /categories/:id` sets `status = DISABLED`, no SQL DELETE issued
- [ ] `CATEGORY_ALREADY_DISABLED` (422) returned on double-disable attempt
- [ ] Status lifecycle enforced: `ENABLED | DISABLED` only (CHECK constraint + service validation)
- [ ] DISABLED categories are read-only for non-status fields (BR-06)
- [ ] `CATEGORY_DISABLED` (422) returned when updating non-status fields on a DISABLED category
- [ ] Initial `status` on creation is `ENABLED`
- [ ] Scope: absent `subject_ids` key — no change; `subject_ids: []` — clears all subject scope (global); `subject_ids: [...]` — replaces scope
- [ ] Same distinct semantics enforced for `division_ids`
- [ ] Scope replacement is atomic (DELETE old scope + INSERT new scope in same transaction)
- [ ] `CATEGORY_SUBJECT_NOT_FOUND` (404) returned if any `subject_id` in scope does not exist
- [ ] `CATEGORY_DIVISION_NOT_FOUND` (404) returned if any `division_id` in scope does not exist
- [ ] Static route `/categories/tree` declared before dynamic route `/categories/:id` in router
- [ ] Tree endpoint returns only ENABLED categories; disabled categories excluded
- [ ] `created_by` set once at creation; `updated_by` updated on every mutation
- [ ] `ON DELETE SET NULL` on `created_by` and `updated_by` FKs

---

## Access Control

- [ ] `question_manage` OR `classification_manage` permission required for all write operations
- [ ] Read endpoints accessible to any authenticated Backoffice user (standard session check)
- [ ] Tenant isolation enforced — all queries use tenant-scoped DB client via `c.get('tenant').pool`
- [ ] No cross-tenant access possible (tenant resolved from slug before any handler)
- [ ] 403 returned (not 404) when a user lacks write permission on an existing resource
- [ ] 404 returned (not 403) when a resource from another tenant is requested (no info leakage)
- [ ] License middleware enforced on all category routes before any handler executes

---

## Data Integrity

- [ ] All writes (create, update, soft-delete, scope mutations) wrapped in explicit `BEGIN / COMMIT / ROLLBACK`
- [ ] Repository functions do not open transactions (service layer owns transaction boundaries)
- [ ] `CATEGORY_NAME_DUPLICATE` (409) raised before hitting DB constraint on duplicate create/update
- [ ] `CATEGORY_CODE_DUPLICATE` (409) raised before hitting DB constraint on duplicate code
- [ ] DB-level `23505` constraint violation on name caught and translated to `CATEGORY_NAME_DUPLICATE`
- [ ] DB-level `23505` constraint violation on code caught and translated to `CATEGORY_CODE_DUPLICATE`
- [ ] Indexes created: `unique_categories_name`, `unique_categories_code`, `idx_categories_parent_id`, `idx_categories_status`
- [ ] Scope table indexes created: `idx_category_subjects_category_id`, `idx_category_subjects_subject_id`, `idx_category_divisions_category_id`, `idx_category_divisions_division_id`
- [ ] All FK columns covered by an index

---

## Hierarchy Correctness

- [ ] Depth is computed from root (root = depth 1, max = depth 3)
- [ ] Depth traversal is bounded to at most 3 ancestor hops (no unbounded recursion)
- [ ] Re-parenting validates that no existing descendant would exceed depth 3
- [ ] Promoting to root (`parent_id: null`) passes depth check unconditionally
- [ ] Circular reference traversal checks at most 3 ancestor hops
- [ ] Direct self-reference (`parent_id == category.id`) rejected as circular reference

---

## Infrastructure

- [ ] Tenant DB migration `20260322_008_categories.ts` created (forward-only, no down migration)
- [ ] All DDL statements idempotent (`IF NOT EXISTS` guards on table, FKs, indexes)
- [ ] Schema version incremented: `1.13.0 → 1.14.0`
- [ ] License middleware applied to all category routes (before any handler executes)
- [ ] Requests to tenants below `MIN_SCHEMA_VERSION = "1.14.0"` rejected with `SCHEMA_VERSION_MISMATCH` (409)
- [ ] Route registered in `apps/api/src/app.ts` under the Backoffice namespace
- [ ] Structured logging with `correlation_id` and `workspace_id` on every handler
- [ ] Error contract enforced: `{ success: false, data: null, error: { code, message } }`
- [ ] Stack traces never returned in API responses

---

## Testing

- [ ] Unit tests for domain service logic (`packages/domain-core/src/categories/__tests__/`)
  - [ ] `createCategory` — success (root), success (child), name duplicate, code duplicate
  - [ ] `createCategory` — parent not found, max depth exceeded (parent at depth 3)
  - [ ] `createCategory` — subject not found rollback, division not found rollback
  - [ ] `updateCategory` — success, name duplicate, code duplicate, disabled guard
  - [ ] `updateCategory` — circular reference (direct), circular reference (indirect)
  - [ ] `updateCategory` — max depth exceeded on re-parent, scope replacement
  - [ ] `deleteCategory` (soft) — success path, already-disabled guard
  - [ ] Status lifecycle transitions (`ENABLED → DISABLED → ENABLED`)
  - [ ] Depth computation: valid at depths 1, 2, 3; rejected at depth 4
  - [ ] Circular ref: direct cycle (A→A), two-hop cycle (A→B→A), three-hop cycle (A→B→C→A)
  - [ ] Scope semantics: absent key (no change), empty array (global), populated array (restricted)
- [ ] Integration tests for API routes (`apps/api/...`)
  - [ ] POST creates category and scope rows atomically
  - [ ] POST rolls back fully if any `subject_id` or `division_id` is invalid
  - [ ] PATCH replaces scope atomically; absent key preserves existing scope
  - [ ] PATCH `subject_ids: []` clears all subject scope
  - [ ] Tenant isolation: category from tenant A not visible on tenant B
  - [ ] License middleware: SOFT_LOCKED workspace → 423
  - [ ] Schema version: tenant below `1.14.0` → 409 `SCHEMA_VERSION_MISMATCH`
  - [ ] Static `/categories/tree` resolves before dynamic `/categories/:id`
- [ ] Transaction rollback test
  - [ ] Simulate FK violation mid-transaction — verify no partial row committed
- [ ] Migration test
  - [ ] Migration applies cleanly on empty tenant DB
  - [ ] All three tables and all indexes created
  - [ ] Schema version incremented to `1.14.0`

---

## Notes

- Items marked incomplete require spec updates or implementation before `/speckit.plan`
- Scope semantics (absent vs empty array) must be explicitly enforced by Zod schema (not just runtime logic)
- Tree endpoint assembly approach (in-memory vs recursive CTE) is an implementation choice; spec specifies in-memory as default
- `dependency-registry.ts` is a stub for this stage; downstream question stages must register their FK checks
