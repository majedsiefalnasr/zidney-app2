# STAGE_23_DEPARTMENTS — Research Decisions

**Stage**: STAGE_23_DEPARTMENTS  
**Phase**: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Date**: 2026-03-17  
**Author**: speckit.plan (AI)  
**Status**: REFERENCE — feeds plan.md and data-model.md

---

## 1. PostgreSQL Recursive CTE for Cycle Detection

### Problem

Department hierarchy is a self-referencing tree (`parent_id → departments.id`). Setting
`parent_id` during create or update can introduce a cycle (e.g., A → B → C → A). The DB-level
`ON DELETE RESTRICT` FK protects against orphaned children but cannot detect cycles. Cycle
detection must run in application logic, inside the write transaction.

### Decision: Recursive CTE Inside Transaction

**Pattern**: Before executing the INSERT/UPDATE that changes `parent_id`, run a recursive CTE
against the `departments` table within the same open transaction. The CTE traverses the ancestor
chain of the _proposed parent_ upward. If the target department's `id` appears anywhere in that
chain, the reparenting would create a cycle.

```sql
WITH RECURSIVE ancestor_chain AS (
  -- Seed: start from the proposed new parent
  SELECT id, parent_id
    FROM departments
   WHERE id = $1                      -- $1 = proposed_parent_id
  UNION ALL
  -- Recurse: walk up the tree following parent_id links
  SELECT d.id, d.parent_id
    FROM departments d
    JOIN ancestor_chain ac ON d.id = ac.parent_id
   WHERE ac.parent_id IS NOT NULL     -- stop at root nodes
)
SELECT 1 FROM ancestor_chain WHERE id = $2  -- $2 = department_id being reparented
```

**If this query returns any row**: setting `parent_id = proposed_parent_id` for the department
with `id = department_id` would create a cycle. Return `DEPARTMENT_CIRCULAR_REFERENCE` (422).

**Why inside the transaction**: Concurrent updates to the hierarchy could create phantoms between
a separate read and the write. By running the CTE just before the UPDATE within `BEGIN … COMMIT`,
any concurrent hierarchy change on the same nodes will be blocked by the row-level locks already
held by the transaction.

**Scope per the spec clarification (Key Clarification #1)**: The cycle detection CTE runs once per
reparent request, checking the ancestor chain of the proposed parent node. It does NOT scan the
entire subtree of the department being moved. Only the path from the proposed parent to the root
is checked.

### Edge Case: Creating a New Department

New departments have no existing children; a fresh INSERT cannot create a cycle from scratch. Cycle
detection is therefore **skipped on create**. The guard only runs on UPDATE when `parent_id` is
explicitly changed.

### Exception: parent_id → null (Reparent to Root)

`parent_id = null` means root level. A root department has no ancestor chain, so no cycle is
possible. Skip the CTE check when `parent_id` is explicitly set to `null`.

---

## 2. SELECT FOR UPDATE for max_users Race-Condition Prevention

### Problem

`max_users` is a per-department capacity limit on student assignments. Under concurrent requests
(e.g., two staff members simultaneously assigning the last open slot to different students), a
naive read → check → write pattern (TOCTOU) allows both to succeed, exceeding the limit.

### Decision: Lock the departments Row Before Counting

**Pattern** (per Key Clarification #4):

```sql
BEGIN;

-- Step 1: Lock the departments row to serialize concurrent capacity checks
SELECT id, max_users
  FROM departments
 WHERE id = $1                    -- $1 = department_id
   FOR UPDATE;

-- Step 2: Count current student assignments (inside the locked scope)
SELECT COUNT(*) AS current_count
  FROM students
 WHERE department_id = $1;

-- Step 3: Compare; abort if at capacity
-- If current_count >= max_users → ROLLBACK, raise DEPARTMENT_MAX_USERS_EXCEEDED

-- Step 4: Perform the assignment
UPDATE students
   SET department_id = $1,
       updated_at    = NOW()
 WHERE id = $2;                   -- $2 = student_id

COMMIT;
```

**Why `SELECT FOR UPDATE` on `departments`, not `students`**: Locking the `departments` row
serializes all concurrent assignment requests for the same department. Any second transaction
attempting `SELECT … FOR UPDATE` on the same `departments.id` will block until the first commits
or rolls back. This prevents two transactions from both observing `count < max_users` and both
proceeding with the assignment.

**Why NOT optimistic concurrency**: Optimistic locking requires a retry loop. Under burst
conditions, many retries can degrade performance. The `SELECT FOR UPDATE` approach serializes at
the row level with zero retry overhead, matching the divisions service's pattern for count checks.

**`max_users = null` case**: Skip the entire lock + count sequence. No capacity limit → no lock
needed. This keeps the hot path (no limit set) fast.

**Key Clarification #2 — max_users reduction**: If `max_users` is reduced via UPDATE to a value
below the current assignment count, the system silently accepts the forward-only cap. Existing
assignments are not ejected. New assignments will immediately be blocked. No backfill or ejection
logic is required.

---

## 3. Drizzle ORM Self-Referencing Tables

### Problem

`departments.parent_id` references `departments.id` on the same table. Standard Drizzle
`.references(() => table.column)` cannot be applied at declaration time because the `departments`
variable does not exist yet when the column list is being built.

### Decision: Use `AnyPgColumn` Type Annotation for Forward Reference

Drizzle ORM supports self-referencing tables via a deferred function signature:

```typescript
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  parent_id: uuid("parent_id").references((): AnyPgColumn => departments.id, {
    onDelete: "restrict",
  }),
  // ...
});
```

The `(): AnyPgColumn =>` return type annotation satisfies TypeScript's strict mode. The lambda
captures the `departments` variable after it has been fully initialized. This is the standard
pattern documented in Drizzle ORM for self-referential tables.

**Division FK**: The `division_id` column uses the normal `.references(() => divisions.id, ...)`
form since `divisions` is imported from a separate file and is fully resolved by import time.

**Functional unique index caveat**: The composite functional unique index
`UNIQUE (LOWER(name), COALESCE(parent_id, uuid_sentinel))` cannot be expressed via Drizzle's
`uniqueIndex()` API (which only supports plain column references). The index is owned exclusively
by the migration. No `uniqueIndex()` declaration in the schema to avoid Drizzle generating a
conflicting plain unique constraint. This mirrors the exact pattern used in `divisions.schema.ts`
for `divisions_name_lower_unique`.

---

## 4. Tree Endpoint Strategy: In-App Recursive Assembly vs Recursive CTE

### Options Evaluated

| Option                         | Approach                                                | Pros                            | Cons                                                              |
| ------------------------------ | ------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------- |
| **A — Recursive CTE**          | One SQL query returns flat ordered list; JS builds tree | Single DB round-trip; efficient | CTE result ordering requires `DEPTH` column; slightly complex SQL |
| **B — In-App with flat fetch** | Fetch all rows, build tree in JavaScript                | Simple SQL, easy to understand  | Multiple rows in memory; O(n) JS tree build                       |
| **C — Multiple round-trips**   | Fetch root nodes, then children recursively             | Easy to page per level          | N+1 query problem; unacceptable at depth                          |

### Decision: Option B — In-App Recursive Assembly from Flat Fetch

**Rationale**:

1. The `departments/tree` endpoint returns the **full workspace tree in one call**. A workspace
   may have hundreds of departments but rarely tens of thousands.
2. Fetching all rows ordered by `(parent_id NULLS FIRST, created_at ASC)` in a single query gives
   the in-app tree builder a sorted flat list that builds the tree in O(n) with a `Map<id, node>`.
3. The divisions service uses a similar flat-fetch + transform pattern for its list operations.
   Staying consistent reduces the surface area of SQL complexity.
4. A recursive CTE approach would be optimal for very deep hierarchies but adds SQL complexity
   and a `depth` tracking column that is not needed for the initial stage.
5. The spec notes the tree endpoint "may be paginated by top-level root nodes in a future stage",
   confirming the current scope is a full-tree fetch.

**Tree build algorithm** (O(n)):

```typescript
const nodeMap = new Map<string, DepartmentTreeNode>();
const roots: DepartmentTreeNode[] = [];

for (const row of flatRows) {
  nodeMap.set(row.id, { ...row, children: [] });
}
for (const node of nodeMap.values()) {
  if (node.parent_id === null) {
    roots.push(node);
  } else {
    const parent = nodeMap.get(node.parent_id);
    if (parent) parent.children.push(node);
  }
}
return roots;
```

---

## 5. staff_departments vs staff_divisions — Key Differences

| Attribute                  | staff_divisions                                        | staff_departments                                                              |
| -------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| FK on `*_id` column        | `division_id` → `divisions(id)` **ON DELETE RESTRICT** | `department_id` → `departments(id)` **ON DELETE CASCADE**                      |
| FK on `staff_id`           | `backoffice_staff_users(id)` ON DELETE CASCADE         | `backoffice_staff_users(id)` ON DELETE CASCADE                                 |
| Index beyond PK            | `idx_staff_divisions_division_id` only                 | `idx_staff_departments_department_id` only                                     |
| Idempotency                | Composite PK (staff_id, division_id)                   | Composite PK (staff_id, department_id)                                         |
| Division consistency guard | N/A (divisions are independent)                        | Staff's `staff_divisions` must include the department's `division_id` (FR-019) |
| Cascade behavior           | DELETE division → blocked by RESTRICT                  | DELETE department → cascades, removes staff assignments                        |

### Rationale for CASCADE on department_id

Divisions are first-class academic boundaries; their staff assignments use RESTRICT to force
explicit cleanup. Departments are secondary segmentation that may be deleted as long as student
and active-assignment guards are satisfied at the service layer. Once the service confirms no active
assignments remain, the staff_departments rows for that department can safely cascade-delete
alongside the department row.

Note: the service layer checks for active staff assignments in `staff_departments` **before**
issuing the DELETE on `departments`. The FK `ON DELETE CASCADE` is a safety net, not the primary
guard.

---

## 6. Division Consistency on Reparent

**Per Key Clarification #3**: When a department is reparented (its `parent_id` changes), only the
**moved node itself** needs the division consistency check. The subtree of the moved node is NOT
scanned.

**Rule**: After the reparent, the moved node's `division_id` must be compatible with its new
parent's `division_id`:

- If new parent has `division_id = null` → any `division_id` on the moved node is valid.
- If new parent has `division_id = X` → moved node must have `division_id = X` or `division_id = null`.
- If moved node has `division_id = X` and new parent has `division_id = Y (Y ≠ X, Y ≠ null)` → 422 `DEPARTMENT_DIVISION_MISMATCH`.

The subtree is not validated because it would require a recursive scan. If subtree consistency is
required, it should be enforced at a future stage or via a separate consistency audit operation.

---

## 7. parent_id Partial-Update Semantics

**Per Key Clarification #5**:

- `parent_id` explicitly set to `null` in the request body → **reparent to root**.
- `parent_id` field **absent** from the request body → **no-op on parent_id** (do not change it).

This creates a two-state ambiguity in JSON: `null` vs missing. The service layer must receive a
typed indicator distinguishing "explicitly null" from "not provided". Implementation approaches:

**Option A**: Use `Partial<UpdateDepartmentInput>` where `parent_id?: string | null`. The
validation schema returns the field only if present in the body; absence means no-op.

**Option B**: Accept a separate `clearParent: boolean` field.

**Decision**: Option A, following the divisions update pattern. The validation schema uses
`.optional()` at the top level. If `parent_id` key is absent in the parsed body, the service
skips the parent update entirely. If `parent_id` key is present with value `null`, the service
sets `parent_id = null` and skips the cycle detection check (root placement cannot cycle).

---

## Summary of Research Decisions

| Topic                            | Decision                                                                           |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| Cycle detection                  | Recursive CTE inside write transaction, checking ancestor chain of proposed parent |
| max_users enforcement            | SELECT departments FOR UPDATE → COUNT students → compare → update                  |
| max_users reduction              | Forward-only cap accepted silently; no backfill/ejection                           |
| Self-referencing Drizzle schema  | `(): AnyPgColumn =>` deferred lambda                                               |
| Tree endpoint                    | Flat SQL fetch + O(n) in-app tree build                                            |
| staff_departments FK behavior    | department_id ON DELETE CASCADE (vs divisions' RESTRICT)                           |
| Division consistency on reparent | Moved node only; no subtree scan                                                   |
| parent_id partial update         | Absent = no-op; explicit null = reparent to root                                   |
