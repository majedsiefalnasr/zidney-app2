# Research: Categories (Stage 030)

**Feature Branch**: `spec/030-categories`  
**Resolved**: 2026-03-22  
**Status**: COMPLETE — all unknowns resolved via codebase inspection

---

## R-01: Migration Numbering

**Decision**: `20260322_008_categories.ts`  
**Rationale**: Last migration is `20260321_007_lessons.ts`. Next sequential slot is `008`. Date is 2026-03-22.  
**Schema version bump**: `1.13.0 → 1.14.0` (matches spec declaration).  
**Alternatives considered**: None — sequential numbering is mandatory.

---

## R-02: CONCURRENT Index Creation in Migration Files

**Decision**: Use `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS` for the functional/partial unique indexes inside the migration's `up()` function, but run them **outside the BEGIN/COMMIT block** (PostgreSQL does not allow `CREATE INDEX CONCURRENTLY` inside an explicit transaction).  
**Rationale**: The normal index creation (`SHARE` lock) blocks writes on large tenant tables. `CONCURRENTLY` uses `SHARE UPDATE EXCLUSIVE` (no write block). FKs and table DDL (`CREATE TABLE`) stay inside the transaction; only the two unique functional indexes are extracted to run after `COMMIT`.  
**Implementation pattern** (confirmed via PG docs):

```sql
-- inside BEGIN/COMMIT: table creation, FK constraints, B-tree indexes
-- after COMMIT:
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_categories_name ON categories (LOWER(name));
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_categories_code ON categories (LOWER(code)) WHERE code IS NOT NULL;
```

**Alternatives considered**: Running all DDL in a single transaction (risky on large tenants) or using `CREATE INDEX` synchronously (safe but blocks writes on live tenants).

---

## R-03: Circular Reference Detection Algorithm

**Decision**: Ancestor-chain traversal via iterative SQL SELECT loop (bounded to 3 hops), with `SELECT FOR UPDATE` on the target row before traversal.  
**Rationale**: Max depth 3 means at most 3 ancestor hops before reaching a root. Unbounded recursive CTE is unnecessary. The iterative approach is straightforward and provably bounded.  
**Algorithm**:

```
1. Lock target category row (SELECT ... FOR UPDATE)
2. Load proposed parent_id (= new parent)
3. Traverse ancestor chain:
   current_id = proposed parent_id
   for i in [1..3]:
     if current_id == target_category.id → CATEGORY_CIRCULAR_REFERENCE
     row = SELECT parent_id FROM categories WHERE id = current_id
     if row is null → chain ends (no cycle)
     current_id = row.parent_id
     if current_id is null → chain ends (reached root)
4. Count depth from proposed parent root to check max-depth constraint
```

**Alternatives considered**: Recursive CTE `WITH RECURSIVE` — overkill for max-3-depth, harder to lock mid-traversal.

---

## R-04: Max-Depth Validation on Re-Parent (PATCH)

**Decision**: Count the depth of the proposed parent (by traversing its ancestor chain upward, max 3 hops) to get `parent_depth`. Then count the depth of the deepest existing descendant of the target category (max 3 hops down). Reject if `parent_depth + 1 + descendant_depth > 3`.  
**Rationale**: Re-parenting a non-leaf category drags all its descendants with it. The combined depth must not exceed 3.  
**Depth Calculation**:

- Root category = depth 1
- Proposed new depth = `ancestor_hops_from_root + 1`
- Max allowed descendant depth = `3 - proposed_new_depth`
- If proposed parent is at depth 3 → no children allowed → 422 immediately

---

## R-05: Tree View Query Strategy

**Decision**: Single `SELECT * FROM categories WHERE status = 'ENABLED'` bulk query, then in-memory assembly into tree structure.  
**Rationale**: Max depth 3 means a tenant with N categories emits exactly N rows. In-memory assembly via parent-grouped Map is O(N) with no recursive CTE complexity. For large tenants this is bounded and predictable. A recursive CTE would require PostgreSQL-specific syntax and complexity not justified at depth 3.  
**With `root_id`**: Add `WHERE id IN (SELECT id FROM RECURSIVE CTE starting at root_id)` only if a root_id filter is requested — or simply filter the flat list to the subtree using the same in-memory traversal.  
**Assembly algorithm**:

```
1. Flatten all ENABLED categories into Map<id, {node, children:[]}>
2. For each node:
   if parent_id is null → add to roots[]
   else → add to parent's children[]
3. If root_id provided → return only the subtree rooted at root_id
4. Return roots[]
```

---

## R-06: N+1 Prevention for Scope Queries

**Decision**: Two-pass strategy for list endpoint:

1. Run the main pagination query → get page of category rows
2. Collect `category_ids` from the result set
3. Run single `SELECT category_id, subject_id FROM category_subjects WHERE category_id = ANY($1)` and single `SELECT category_id, division_id FROM category_divisions WHERE category_id = ANY($1)`
4. Group by `category_id` in memory and merge into each row

**Rationale**: Avoids N+1 (one scope SELECT per category). One query per scope table regardless of page size. For single-category GET, a simpler LEFT JOIN approach works fine.  
**Alternatives considered**: `LEFT JOIN LATERAL` or `json_agg` in the main query — valid but adds SQL complexity. The two-pass approach mirrors the existing subjects/lessons pattern and is easier to test.

---

## R-07: requirePermission with OR Semantics

**Decision**: Use `requireAnyPermission(['question_manage', 'classification_manage'])` middleware (already exists in `resolve-rbac.ts`). This grants access if the user has **either** permission.  
**Rationale**: The spec requires `question_manage` OR `classification_manage`. The existing `requireAnyPermission` factory function satisfies this directly without new middleware.  
**Import path**: `apps/api/src/middleware/auth/resolve-rbac.ts`

---

## R-08: Drizzle Schema Location

**Decision**: `apps/api/src/db/tenant/schemas/categories.schema.ts`  
**Rationale**: All tenant Drizzle schemas are in `apps/api/src/db/tenant/schemas/`. Functional/partial unique indexes and FK constraints are migration-owned (not representable in Drizzle schema definition) — per the established pattern in `subjects.schema.ts`.

---

## R-09: Domain Package Module Path

**Decision**: `packages/domain-core/src/categories/` with public exports via `packages/domain-core/src/categories/index.ts`.  
**Rationale**: Mirrors `packages/domain-core/src/lessons/` exactly. Seven files: `categories.types.ts`, `categories.errors.ts`, `categories.repository.ts`, `categories.service.ts`, `categories.tree.ts`, `categories.dependency-registry.ts`, `index.ts`.

---

## R-10: Scope Table Scope Replacement Pattern

**Decision**: DELETE + INSERT in same transaction, using `INSERT INTO category_subjects (id, category_id, subject_id) VALUES ... ON CONFLICT DO NOTHING` for idempotency safety.  
**Validation order**: Validate all subject_ids/division_ids exist BEFORE issuing any DELETE/INSERT. Use `SELECT id FROM subjects WHERE id = ANY($1::uuid[])` and compare count to expected count.  
**Rationale**: Validates existence in a single query (no N+1), then DELETE all existing scope rows, INSERT new rows. Roll back on any error.

---

## R-11: SELECT FOR UPDATE Locking Pattern

**Decision**: Following the lessons pattern (`lockLessonForUpdate`), a `lockCategoryForUpdate` repository function runs `SELECT id, status, parent_id FROM categories WHERE id = $1::uuid FOR UPDATE NOWAIT`.  
**NOWAIT**: Immediately raises error if row is already locked (concurrent request), preventing silent wait. The error is caught and re-thrown as a 409 conflict in the route handler.  
**Applied in**:

- `createCategory`: lock parent row when `parent_id != null`
- `updateCategory`: lock target row when `parent_id` is in payload
- `deleteCategory`: always lock target row

---

## R-12: Validation Schema — Absent Key vs Empty Array Distinction

**Decision**: Use Zod's distinction between `undefined` (field absent from JSON) and `[]` (explicit empty array). `subject_ids: z.array(z.string().uuid()).optional()` — when undefined, scope unchanged; when `[]`, scope cleared; when `[uuid...]`, scope replaced.  
**Implementation**: In service layer, check `'subject_ids' in input` (key presence) to distinguish absent from empty. Zod `optional()` preserves the distinction correctly.

---

## R-13: Lessons-Style Transaction Pattern (No Separate Pool)

**Decision**: Service receives a `DbClient` (raw `pg` Pool/PoolClient duck-type interface). The service calls `db.query('BEGIN')` / `db.query('COMMIT')` / `db.query('ROLLBACK')` directly.  
**Rationale**: Identical to lessons pattern. No repository-level transactions (repositories are pure query functions). Transaction is owned entirely by the service function.

---

## R-14: Test Infrastructure

**Decision**:

- Unit tests: `packages/domain-core/src/categories/__tests__/categories.service.test.ts`
- Integration tests: `apps/api/src/routes/backoffice/categories/__tests__/categories.integration.test.ts`
- Follows exact same pattern as `lessons.service.test.ts` and `lessons.integration.test.ts`

All unknowns resolved. No blocking clarifications required.
