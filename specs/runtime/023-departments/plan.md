# STAGE_23_DEPARTMENTS — Implementation Plan

**Stage**: STAGE_23_DEPARTMENTS  
**Phase**: 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Date**: 2026-03-17  
**Author**: speckit.plan (AI)  
**Depends on**: STAGE_22_DIVISIONS (divisions table must exist)  
**Must complete before**: STAGE_24_GROUPS

---

## Phase 1: Data Layer

### 1.1 Migration File

**File to create**: `apps/api/src/db/tenant/migrations/20260317_001_departments.ts`

See `data-model.md` §4 for the complete TypeScript source.

**Migration ID**: `20260317_001_departments`  
**Version bump**: `1.5.0` → `1.6.0`

**Steps in order** (all inside a single BEGIN…COMMIT block):

| Step  | Action                                                                                                                                                       |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | `CREATE TABLE IF NOT EXISTS departments` — all columns, `CHECK` constraints, `PRIMARY KEY`, `FOREIGN KEY (parent_id)`, `FOREIGN KEY (division_id)`           |
| 1a    | `CREATE UNIQUE INDEX IF NOT EXISTS departments_name_parent_lower_unique` — functional composite index on `(LOWER(name), COALESCE(parent_id, sentinel_uuid))` |
| 1b–1f | `CREATE INDEX IF NOT EXISTS` for `parent_id`, `division_id`, `status`, `type`, `(created_at, id)`                                                            |
| 2     | `CREATE TABLE IF NOT EXISTS staff_departments` — composite PK, `FK → backoffice_staff_users` CASCADE, `FK → departments` CASCADE                             |
| 2a    | `CREATE INDEX IF NOT EXISTS idx_staff_departments_department_id`                                                                                             |
| 3     | `ALTER TABLE students ADD COLUMN IF NOT EXISTS department_id UUID` (nullable)                                                                                |
| 4     | `ALTER TABLE students ADD CONSTRAINT IF NOT EXISTS students_department_id_fkey FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL`    |
| 5     | `CREATE INDEX IF NOT EXISTS idx_students_department_id ON students (department_id)`                                                                          |
| 6     | `UPDATE schema_version SET version = '1.6.0'`                                                                                                                |

**Verification after running**: `SELECT version FROM schema_version` should return `1.6.0`.

---

### 1.2 Drizzle Schema Files

#### 1.2.1 `apps/api/src/db/tenant/schemas/departments.schema.ts` _(NEW)_

See `data-model.md` §1 for complete source.

Key points:

- `parent_id` self-reference via `(): AnyPgColumn =>` deferred lambda (TypeScript strict mode compliance)
- `division_id` standard references to `divisions.id`, `{ onDelete: 'restrict' }`
- No `uniqueIndex()` for the composite functional index (migration-owned; see data-model.md §1)
- Exports: `Department` (select type), `NewDepartment` (insert type)

#### 1.2.2 `apps/api/src/db/tenant/schemas/staff-departments.schema.ts` _(NEW)_

See `data-model.md` §2 for complete source.

Key points:

- Composite PK via `primaryKey({ columns: [table.staff_id, table.department_id] })`
- `department_id` FK uses `{ onDelete: 'cascade' }` — differs from staff_divisions which uses `restrict`
- Exports: `StaffDepartment` (select type), `NewStaffDepartment` (insert type)

#### 1.2.3 `apps/api/src/db/tenant/schemas/students.schema.ts` _(UPDATE)_

Add at top of file (new import):

```typescript
import { departments } from "./departments.schema";
```

Add inside columns object:

```typescript
department_id: uuid('department_id').references(() => departments.id, { onDelete: 'setNull' }),
```

Add inside index callback:

```typescript
departmentIdIdx: index('idx_students_department_id').on(table.department_id),
```

---

### 1.3 Schema Index Barrel Update

**File**: `apps/api/src/db/tenant/schemas/index.ts` _(UPDATE)_

Add:

```typescript
export * from "./departments.schema";
export * from "./staff-departments.schema";
```

---

## Phase 2: Domain Layer

**Location pattern**: `packages/domain-core/src/departments/`  
_(Mirrors the divisions domain at `packages/domain-core/src/divisions/`)_

### 2.1 `departments.errors.ts` _(NEW)_

```
packages/domain-core/src/departments/departments.errors.ts
```

Defines `DepartmentsErrorCode` union type, `DEPARTMENTS_ERROR_HTTP_STATUS` map, and `DepartmentsError` class (extends `Error`).

Error codes (matching spec §Error Codes Reference):

| Code                              | HTTP Status |
| --------------------------------- | ----------- |
| `DEPARTMENT_NOT_FOUND`            | 404         |
| `DEPT_STAFF_ASSIGNMENT_NOT_FOUND` | 404         |
| `DEPARTMENT_NAME_DUPLICATE`       | 409         |
| `DEPARTMENT_CIRCULAR_REFERENCE`   | 422         |
| `DEPARTMENT_DIVISION_MISMATCH`    | 422         |
| `DEPARTMENT_HAS_CHILDREN`         | 422         |
| `DEPARTMENT_HAS_ASSIGNMENTS`      | 422         |
| `DEPARTMENT_MAX_USERS_EXCEEDED`   | 422         |
| `DEPARTMENT_DISABLED`             | 422         |
| `VALIDATION_ERROR`                | 422         |

`DepartmentsError` must expose `.httpStatus: number`, `.code: DepartmentsErrorCode`, `.message: string`.

---

### 2.2 `departments.types.ts` _(NEW)_

```
packages/domain-core/src/departments/departments.types.ts
```

Pure TypeScript types only — no runtime logic, no pg imports.

```typescript
// DbClient — structural type, same shape as divisions DbClient
export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}

// AuditContext — same shape as divisions AuditContext
export interface AuditContext {
  user_id: string;
  correlation_id: string; // renamed from request_id — must match logging contract (AGENTS.md §Logging Rules)
  workspace_slug: string;
  workspace_id: string;
}

// Enums
export enum DepartmentStatus {
  ENABLED = "ENABLED",
  DISABLED = "DISABLED",
}

export enum DepartmentType {
  MAIN = "MAIN",
  SUB = "SUB",
  SIMPLE = "SIMPLE",
}

// Row interfaces
export interface DepartmentRow extends Record<string, unknown> {
  id: string;
  name: string;
  type: DepartmentType;
  parent_id: string | null;
  division_id: string | null;
  max_users: number | null;
  description: string | null;
  status: DepartmentStatus;
  created_at: Date;
  updated_at: Date;
}

export interface DepartmentTreeNode {
  id: string;
  name: string;
  type: DepartmentType;
  status: DepartmentStatus;
  parent_id: string | null;
  division_id: string | null;
  children: DepartmentTreeNode[];
}

export interface StaffDepartmentRow extends Record<string, unknown> {
  staff_id: string;
  department_id: string;
  assigned_at: Date;
}

// Command inputs
export interface CreateDepartmentInput {
  name: string;
  type: DepartmentType;
  parent_id?: string | null;
  division_id?: string | null;
  max_users?: number | null;
  description?: string | null;
}

export interface UpdateDepartmentInput {
  name?: string;
  type?: DepartmentType;
  parent_id?: string | null; // absent = no-op; explicit null = reparent to root
  division_id?: string | null;
  max_users?: number | null;
  description?: string | null;
  status?: DepartmentStatus;
}

// Query inputs / results
export interface ListDepartmentsInput {
  limit: number;
  cursor: string | null;
  status?: DepartmentStatus | "all";
  division_id?: string | null;
  parent_id?: string | null | "root"; // 'root' = filter by null parent_id
  type?: DepartmentType;
}

export interface ListDepartmentsResult {
  items: DepartmentRow[];
  nextCursor: string | null;
  total: number;
}
```

---

### 2.3 `departments.service.ts` _(NEW)_

```
packages/domain-core/src/departments/departments.service.ts
```

All service functions use injected `DbClient`. No `Pool` import. All writes are transactional.

Module-level declarations (top of file):

```typescript
import { createLogger } from "@zidney/logger";
const logger = createLogger("departments-service");
```

All mutating functions use `logger` to emit structured audit events with `correlation_id`, `workspace_slug`, `workspace_id`, and `user_id`.

**Functions to implement**:

#### `listDepartments(db, input): Promise<ListDepartmentsResult>`

- Keyset pagination on `(created_at ASC, id ASC)`
- Supports filters: `status`, `division_id`, `parent_id`, `type`
- `parent_id = 'root'` → `WHERE parent_id IS NULL`
- Uses `limit + 1` trick to detect next page
- Separate `COUNT(*)` for `total` (respects all filters, ignores cursor)

#### `getDepartment(db, id): Promise<DepartmentRow>`

- `SELECT * FROM departments WHERE id = $1`
- Throws `DEPARTMENT_NOT_FOUND` (404) if no row

#### `createDepartment(db, input, audit): Promise<DepartmentRow>`

Inside `BEGIN … COMMIT`:

1. Validate `parent_id` exists (if provided) — throws `DEPARTMENT_NOT_FOUND`
2. Validate `division_id` exists (if provided): `SELECT id FROM divisions WHERE id = $1 AND status = 'ENABLED'` — throws `VALIDATION_ERROR` (message: `'Division with the given ID does not exist.'`)
3. Division consistency check (if `parent_id` and `division_id` both provided) — throws `DEPARTMENT_DIVISION_MISMATCH`
4. Name uniqueness within parent scope (case-insensitive) — throws `DEPARTMENT_NAME_DUPLICATE`
5. `INSERT INTO departments …` returning all columns
6. Log `DEPARTMENT_CREATED`

_No cycle detection on create_ (new node has no descendants).

#### `updateDepartment(db, id, input, audit): Promise<DepartmentRow>`

Inside `BEGIN … COMMIT`:

1. Fetch current department row — throws `DEPARTMENT_NOT_FOUND`
2. If `division_id` key present in input: validate `division_id` exists: `SELECT id FROM divisions WHERE id = $1 AND status = 'ENABLED'` — throws `VALIDATION_ERROR` (message: `'Division with the given ID does not exist.'`)
3. If `parent_id` key present in input AND new value differs from current:
   - If new `parent_id` is not null: run cycle detection CTE (throws `DEPARTMENT_CIRCULAR_REFERENCE`)
   - Division consistency check against new parent (throws `DEPARTMENT_DIVISION_MISMATCH`)
4. If `name` changes or `parent_id` changes: name uniqueness check in new parent scope
5. Build `SET` clause from provided fields only
6. `UPDATE departments SET …, updated_at = NOW() WHERE id = $1`
7. Log `DEPARTMENT_UPDATED`

_parent_id field absent in input_ → skip parent update entirely (no-op).  
_parent_id = null explicitly_ → reparent to root; skip cycle check; run division consistency (parent = null → any division valid).

#### `deleteDepartment(db, id, audit): Promise<void>`

Inside `BEGIN … COMMIT`:

1. Fetch department row — throws `DEPARTMENT_NOT_FOUND`
2. Check children: `SELECT COUNT(*) FROM departments WHERE parent_id = $1` → throws `DEPARTMENT_HAS_CHILDREN`
3. Check student assignments: `SELECT COUNT(*) FROM students WHERE department_id = $1` → throws `DEPARTMENT_HAS_ASSIGNMENTS`
4. Check staff assignments: `SELECT COUNT(*) FROM staff_departments WHERE department_id = $1` → throws `DEPARTMENT_HAS_ASSIGNMENTS`
5. `DELETE FROM departments WHERE id = $1`
6. Log `DEPARTMENT_DELETED`

#### `getDepartmentChildren(db, id): Promise<DepartmentRow[]>`

- Verify department exists — throws `DEPARTMENT_NOT_FOUND`
- `SELECT * FROM departments WHERE parent_id = $1 ORDER BY created_at ASC, id ASC`

#### `getDepartmentTree(db): Promise<DepartmentTreeNode[]>`

- `SELECT id, name, type, status, parent_id, division_id FROM departments ORDER BY parent_id NULLS FIRST, created_at ASC`
- Build tree in-app using `Map<id, node>` (O(n), see research.md §4)
- Returns roots array with nested `children`

#### `getStaffDepartments(db, staffId): Promise<StaffDepartmentRow[]>`

- `SELECT sd.*, d.name, d.status FROM staff_departments sd JOIN departments d ON sd.department_id = d.id WHERE sd.staff_id = $1`

#### `assignStaffDepartment(db, staffId, departmentId, audit): Promise<StaffDepartmentRow>`

Inside `BEGIN … COMMIT`:

1. Fetch department — throws `DEPARTMENT_NOT_FOUND`
2. Check `status = ENABLED` — throws `DEPARTMENT_DISABLED`
3. If department has `division_id ≠ null`: check staff member's `staff_divisions` includes that division — throws `DEPARTMENT_DIVISION_MISMATCH`
4. `INSERT INTO staff_departments … ON CONFLICT (staff_id, department_id) DO NOTHING` (idempotent)
   4b. `SELECT * FROM staff_departments WHERE staff_id = $1 AND department_id = $2` — always retrieve the row regardless of whether step 4 inserted or skipped (handles both insert and idempotent-skip paths)
5. Return the row fetched in step 4b
6. Log `DEPARTMENT_STAFF_ASSIGNED`

#### `removeStaffDepartment(db, staffId, departmentId, audit): Promise<void>`

Inside `BEGIN … COMMIT`:

1. Verify assignment exists in `staff_departments` — throws `DEPT_STAFF_ASSIGNMENT_NOT_FOUND`
2. `DELETE FROM staff_departments WHERE staff_id = $1 AND department_id = $2`
3. Log `DEPARTMENT_STAFF_REMOVED`

#### `checkDepartmentCapacity(db, departmentId): Promise<void>` _(internal helper used by student assignment)_

> **@internal** — For use by student-assignment domain only. Not a stable public API surface. Add `/** @internal — for use by student-assignment domain only */` JSDoc in the implementation file and on the barrel re-export.

Inside caller's open transaction:

1. `SELECT id, max_users FROM departments WHERE id = $1 FOR UPDATE`
2. If `max_users IS NULL` → return (no limit)
3. `SELECT COUNT(*) FROM students WHERE department_id = $1`
4. If `count >= max_users` → throw `DEPARTMENT_MAX_USERS_EXCEEDED`

_Note_: This function is called by the student-assignment service (future stage), not by department CRUD routes. It is defined in this domain package to co-locate the capacity enforcement logic.

---

### 2.4 `index.ts` (domain barrel) _(NEW)_

```
packages/domain-core/src/departments/index.ts
```

```typescript
export * from "./departments.errors";
export * from "./departments.service";
export {
  type AuditContext,
  type CreateDepartmentInput,
  type DbClient, // exported so future consumers (student-assignment) can type the db parameter
  DepartmentStatus,
  DepartmentType,
  type DepartmentRow,
  type DepartmentTreeNode,
  type ListDepartmentsInput,
  type ListDepartmentsResult,
  type StaffDepartmentRow,
  type UpdateDepartmentInput,
} from "./departments.types";
```

---

### 2.5 Update `packages/domain-core/src/index.ts`

Add:

```typescript
export * from "./departments";
```

---

### 2.6 Update `packages/domain-core/package.json` exports

Add the subpath export entry:

```json
"./departments": {
  "import": "./src/departments/index.ts",
  "types": "./src/departments/index.ts"
}
```

_(Follow the exact pattern used for `"./divisions"` entry in the existing package.json.)_

---

## Phase 3: Validation Schemas

**Location**: `packages/validation/src/` (follow divisions validation schema pattern)

Files to create:

- `packages/validation/src/departments/departments.validation.ts` _(NEW)_
- Export from validation barrel

**Schemas to implement** (using Zod, following divisions pattern):

| Schema                              | Used in route                                    |
| ----------------------------------- | ------------------------------------------------ |
| `listDepartmentsQuerySchema`        | GET /departments                                 |
| `createDepartmentBodySchema`        | POST /departments                                |
| `updateDepartmentBodySchema`        | PUT /departments/:id                             |
| `getDepartmentParamsSchema`         | GET /departments/:id                             |
| `deleteDepartmentParamsSchema`      | DELETE /departments/:id                          |
| `staffDepartmentsParamsSchema`      | all /staff/:staffId/departments routes           |
| `assignStaffDepartmentBodySchema`   | POST /staff/:staffId/departments                 |
| `removeStaffDepartmentParamsSchema` | DELETE /staff/:staffId/departments/:departmentId |

**Key validation rules**:

- `name`: `z.string().min(1).max(255).regex(/^[^\x00-\x1F]+$/)`
- `type`: `z.enum(['MAIN', 'SUB', 'SIMPLE'])`
- `status`: `z.enum(['ENABLED', 'DISABLED'])`
- `parent_id`: `z.string().uuid().nullable().optional()`
- `division_id`: `z.string().uuid().nullable().optional()`
- `max_users`: `z.number().int().positive().nullable().optional()`
- `limit`: `z.coerce.number().int().min(1).max(100).default(20)`
- `cursor`: `z.string().uuid().nullable().optional().default(null)`

---

## Phase 4: API Routes

**Directory**: `apps/api/src/routes/backoffice/departments/` _(NEW)_

All routes follow the exact same pattern as divisions routes. The middleware chain is inherited
from the backoffice group registered in `app.ts`.

### 4.1 File Structure

```
apps/api/src/routes/backoffice/departments/
├── helpers.ts            # getDb, buildAuditCtx, departmentErrorResponse
├── list-departments.ts   # GET /departments
├── create-department.ts  # POST /departments
├── get-department.ts     # GET /departments/:id
├── update-department.ts  # PUT /departments/:id
├── delete-department.ts  # DELETE /departments/:id
├── children-department.ts # GET /departments/:id/children
├── tree-departments.ts   # GET /departments/tree
├── staff-departments.ts  # GET/POST/DELETE /staff/:staffId/departments
└── index.ts              # Router barrel
```

### 4.2 `helpers.ts`

```typescript
// Same structure as divisions/helpers.ts
// getDb(c): returns c.get('tenant').pool
// buildAuditCtx(c): returns AuditContext with user_id, correlation_id, workspace_slug, workspace_id
// departmentErrorResponse(c, err): maps DepartmentsError → JSON envelope; unknown → 500
// isValidUuid(s): UUID format guard (reuse UUID_PATTERN from divisions)
```

Import `DepartmentsError` from `@zidney/domain-core/departments`.

### 4.3 `list-departments.ts`

```typescript
// GET /departments
// RBAC: ACADEMIC_STRUCTURE can_view
// Calls: listDepartments(db, { limit, cursor, status, division_id, parent_id, type })
// Query params: limit, cursor, status, division_id, parent_id, type
// Validates with: listDepartmentsQuerySchema
```

### 4.4 `create-department.ts`

```typescript
// POST /departments
// RBAC: ACADEMIC_STRUCTURE can_create
// Calls: createDepartment(db, input, audit)
// Validates body with: createDepartmentBodySchema
// Returns 201 with created department
```

### 4.5 `get-department.ts`

```typescript
// GET /departments/:id
// RBAC: ACADEMIC_STRUCTURE can_view
// Calls: getDepartment(db, id)
// Validates params with: getDepartmentParamsSchema
// Returns 200 with department row
```

### 4.6 `update-department.ts`

```typescript
// PUT /departments/:id
// RBAC: ACADEMIC_STRUCTURE can_edit
// Calls: updateDepartment(db, id, input, audit)
// Validates params + body with: getDepartmentParamsSchema + updateDepartmentBodySchema
// Returns 200 with updated department
```

### 4.7 `delete-department.ts`

```typescript
// DELETE /departments/:id
// RBAC: ACADEMIC_STRUCTURE can_delete
// Calls: deleteDepartment(db, id, audit)
// Validates params with: deleteDepartmentParamsSchema
// Returns 200 with { deleted: true }
```

### 4.8 `children-department.ts`

```typescript
// GET /departments/:id/children
// RBAC: ACADEMIC_STRUCTURE can_view
// Calls: getDepartmentChildren(db, id)
// Validates params with: getDepartmentParamsSchema
// Returns 200 with { items: DepartmentRow[] }
```

### 4.9 `tree-departments.ts`

```typescript
// GET /departments/tree
// RBAC: ACADEMIC_STRUCTURE can_view
// Calls: getDepartmentTree(db)
// No params to validate
// Returns 200 with { tree: DepartmentTreeNode[] }
// ROUTING NOTE: /departments/tree MUST be registered BEFORE /departments/:id
//   to prevent 'tree' being matched as a UUID param
```

### 4.10 `staff-departments.ts`

```typescript
// GET  /staff/:staffId/departments        → handleGetStaffDepartments
// POST /staff/:staffId/departments        → handleAssignStaffDepartment
// DELETE /staff/:staffId/departments/:departmentId → handleRemoveStaffDepartment
//
// RBAC: can_view for GET; can_edit for POST/DELETE
// Calls domain functions: getStaffDepartments, assignStaffDepartment, removeStaffDepartment
```

### 4.11 `index.ts` (Router Barrel)

```typescript
import { Hono } from "hono";
import { PermissionModule } from "@zidney/domain-core/rbac";
import { createLogger } from "@zidney/logger";
import { createPermissionGuard } from "../../../middleware/backoffice-permission-guard-v2";
import type { BackofficeEnv } from "../types";

// Import all handlers...

const logger = createLogger("backoffice-departments");
export const departmentsRouter = new Hono<BackofficeEnv>();

// Route registration order — CRITICAL:
// GET /departments/tree MUST be before GET /departments/:id
// GET /departments/:id/children MUST be before GET /departments/:id if router matches greedily
//   (Hono uses first-match, so register more-specific patterns first)

departmentsRouter.get("/departments", can_view, handleListDepartments);
departmentsRouter.get("/departments/tree", can_view, handleGetDepartmentTree);
departmentsRouter.get("/departments/:id/children", can_view, handleGetDepartmentChildren);
departmentsRouter.get("/departments/:id", can_view, handleGetDepartment);
departmentsRouter.post("/departments", can_create, handleCreateDepartment);
departmentsRouter.put("/departments/:id", can_edit, handleUpdateDepartment);
departmentsRouter.delete("/departments/:id", can_delete, handleDeleteDepartment);
departmentsRouter.get("/staff/:staffId/departments", can_view, handleGetStaffDepartments);
departmentsRouter.post("/staff/:staffId/departments", can_edit, handleAssignStaffDepartment);
departmentsRouter.delete(
  "/staff/:staffId/departments/:departmentId",
  can_edit,
  handleRemoveStaffDepartment,
);
```

**Route registration order note**: In Hono, `GET /departments/tree` must be registered **before**
`GET /departments/:id` otherwise `tree` will be captured as a UUID param and the handler will
return `DEPARTMENT_NOT_FOUND`. Same pattern as divisions router where `POST /divisions/disable`
is registered before `GET /divisions/:id`.

---

## Phase 5: Route Registration in `app.ts`

**File**: `apps/api/src/app.ts` _(UPDATE)_

Add import:

```typescript
import { departmentsRouter } from "./routes/backoffice/departments/index";
```

Add route mount (alongside the existing divisions mount at line 148):

```typescript
app.route("/api/v1/backoffice/workspace", departmentsRouter);
```

The departments router is mounted at the same base path as divisions — each router owns its own
path prefix (`/departments` and `/staff/:staffId/departments`).

---

## Phase 6: Tests

### 6.1 Unit Tests — Domain Service

**File**: `packages/domain-core/src/departments/__tests__/departments.service.test.ts` _(NEW)_

#### Cycle Detection Tests

```
describe('updateDepartment — cycle detection')
  ✓ allows reparent when no cycle exists
  ✓ rejects reparent where proposed parent is a descendant (direct)
  ✓ rejects reparent where proposed parent is a descendant (3 levels deep)
  ✓ skips cycle check when parent_id is null (reparent to root)
  ✓ skips cycle check when parent_id field is absent from input (no-op)
  ✓ skips cycle check on createDepartment (new node cannot create cycle)
```

#### max_users Enforcement Tests

```
describe('checkDepartmentCapacity')
  ✓ allows assignment when count < max_users
  ✓ allows assignment when max_users is null (no limit)
  ✓ rejects assignment when count === max_users (at capacity)
  ✓ rejects assignment when count > max_users (degraded state)
```

#### Division Consistency Tests

```
describe('createDepartment — division consistency')
  ✓ allows parent with division_id = null + any child division_id
  ✓ allows parent with division_id X + child division_id X
  ✓ rejects parent with division_id X + child division_id Y (Y ≠ X, Y ≠ null)
  ✓ allows child division_id null when parent has division_id X

describe('updateDepartment — division consistency on reparent')
  ✓ validates only the moved node, not its subtree
```

#### Name Uniqueness Tests

```
describe('createDepartment — name conflicts')
  ✓ rejects duplicate name under same parent (case-insensitive)
  ✓ allows same name under different parents
  ✓ allows same name at root and under a parent simultaneously
```

#### Status Guard Tests

```
describe('assignStaffDepartment — status guard')
  ✓ rejects assignment to DISABLED department
  ✓ allows assignment to ENABLED department
```

#### Delete Guard Tests

```
describe('deleteDepartment — guards')
  ✓ rejects delete when children exist
  ✓ rejects delete when student assignments exist
  ✓ rejects delete when staff assignments exist
  ✓ allows delete when no children, no students, no staff
```

---

### 6.2 Integration Tests — API Endpoints

**File**: `tests/api/departments/` _(NEW directory)_

#### `departments-crud.test.ts`

```
✓ POST /departments — creates top-level department (201)
✓ POST /departments — creates nested department (201)
✓ POST /departments — rejects duplicate name under same parent (409 DEPARTMENT_NAME_DUPLICATE)
✓ POST /departments — rejects division mismatch (422 DEPARTMENT_DIVISION_MISMATCH)
✓ POST /departments — rejects missing required fields (422 VALIDATION_ERROR)
✓ GET  /departments — returns all departments (200)
✓ GET  /departments?status=DISABLED — filters by status (200)
✓ GET  /departments?division_id=X — filters by division (200)
✓ GET  /departments?parent_id=X — returns direct children (200)
✓ GET  /departments?type=MAIN — filters by type (200)
✓ GET  /departments/:id — returns department (200)
✓ GET  /departments/:id — 404 for unknown ID
✓ PUT  /departments/:id — updates name (200)
✓ PUT  /departments/:id — rejects circular reference (422 DEPARTMENT_CIRCULAR_REFERENCE)
✓ PUT  /departments/:id — reparents to root (parent_id: null) (200)
✓ PUT  /departments/:id — no-op when parent_id absent from body (200, unchanged)
✓ DELETE /departments/:id — deletes childless unassigned department (200 { deleted: true })
✓ DELETE /departments/:id — rejects delete with children (422 DEPARTMENT_HAS_CHILDREN)
✓ DELETE /departments/:id — rejects delete with student assignments (422 DEPARTMENT_HAS_ASSIGNMENTS)
✓ DELETE /departments/:id — rejects delete with staff assignments (422 DEPARTMENT_HAS_ASSIGNMENTS)
✓ DELETE /departments/:id — 404 for unknown ID
```

#### `departments-hierarchy.test.ts`

```
✓ GET /departments/tree — returns full nested tree (200)
✓ GET /departments/tree — returns empty array when no departments
✓ GET /departments/tree — correctly nests 3-level hierarchy
✓ GET /departments/:id/children — returns direct children only
✓ GET /departments/:id/children — returns empty array for leaf node
✓ GET /departments/:id/children — 404 for unknown parent
```

#### `departments-staff.test.ts`

```
✓ GET  /staff/:staffId/departments — lists assignments (200)
✓ POST /staff/:staffId/departments — assigns department (200)
✓ POST /staff/:staffId/departments — idempotent re-assign returns success (200)
✓ POST /staff/:staffId/departments — rejects DISABLED department (422 DEPARTMENT_DISABLED)
✓ POST /staff/:staffId/departments — rejects division mismatch (422 DEPARTMENT_DIVISION_MISMATCH)
✓ DELETE /staff/:staffId/departments/:departmentId — removes assignment (200)
✓ DELETE /staff/:staffId/departments/:departmentId — 404 for non-existent assignment
```

#### `departments-auth.test.ts`

```
✓ All read endpoints return 403 without can_view
✓ POST /departments returns 403 without can_create
✓ PUT /departments/:id returns 403 without can_edit
✓ DELETE /departments/:id returns 403 without can_delete
✓ All endpoints return 401 without valid JWT
✓ All endpoints return 423 with SOFT_LOCKED license
✓ All endpoints return 403 with ARCHIVED license
```

---

### 6.3 Concurrent max_users Race Condition Test

**File**: `packages/domain-core/src/departments/__tests__/departments-concurrent.test.ts` _(NEW)_

> **Note:** `checkDepartmentCapacity` has no HTTP endpoint in Stage 23. This is a **domain service unit test**, not an HTTP integration test. The test invokes `checkDepartmentCapacity` directly via two parallel DB client instances (structurally typed `DbClient`).

```
✓ Two concurrent calls to checkDepartmentCapacity for the last slot:
  only one succeeds (returns without throwing),
  the other throws DEPARTMENT_MAX_USERS_EXCEEDED.
  (Test uses Promise.all with two in-process DB clients against the same tenant schema;
   SELECT … FOR UPDATE serializes execution — asserts exactly one success and one error)
```

---

## Phase 7: ARCHITECTURE_MAP.json Registration

No new `packages/*` or `apps/*` modules are introduced. The departments domain lives inside the
existing `packages/domain-core` module (new subdirectory `src/departments/`), which is already
registered in `ARCHITECTURE_MAP.json`.

**Verification**: Run `bun scripts/infra-audit.ts` after implementation to confirm zero violations.

---

## Constitution Check Table

| Constitutional Rule             | Compliance | Notes                                                                                                             |
| ------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------- |
| No cross-tenant access          | ✓          | All queries use `tenant.pool` from resolver context                                                               |
| No middleware bypass            | ✓          | All routes inherit `correlationId → tenantResolver → licenseEnforcement → rateLimit → auth` chain                 |
| No direct DB instantiation      | ✓          | `DbClient` structural type; injected via `c.get('tenant').pool`                                                   |
| Database-per-tenant             | ✓          | `departments` and `staff_departments` tables reside in tenant DB only                                             |
| No shared tenant tables         | ✓          | No global department singleton; no cross-tenant joins                                                             |
| No row-based multi-tenancy      | ✓          | All tables are per-tenant; no tenant_id column                                                                    |
| License middleware mandatory    | ✓          | License gate enforced at backoffice group level in app.ts                                                         |
| SOFT_LOCKED → 423               | ✓          | Inherited from license enforcement middleware                                                                     |
| ARCHIVED → 403                  | ✓          | Inherited from license enforcement middleware                                                                     |
| No attempt engine/grading touch | ✓          | Feature does not touch attempts, snapshots, or grading                                                            |
| SELECT FOR UPDATE on max_users  | ✓          | departments row locked before student count (research.md §2)                                                      |
| Cycle detection mandatory       | ✓          | Recursive CTE inside transaction on every parent_id change                                                        |
| All writes transactional        | ✓          | All service write functions wrap in BEGIN…COMMIT / ROLLBACK                                                       |
| Server-authoritative time       | ✓          | All timestamps use `NOW()` server-side; no client timestamps accepted                                             |
| No console.log                  | ✓          | All logging via `createLogger` from `@zidney/logger`                                                              |
| Structured logging required     | ✓          | All mutating ops log `DEPARTMENT_CREATED` etc. with `correlation_id`, `workspace_slug`, `workspace_id`, `user_id` |
| Forward-only migration          | ✓          | `down()` throws; per ADR-0008                                                                                     |
| schema_version bumped           | ✓          | 1.5.0 → 1.6.0 in migration step 6                                                                                 |
| RBAC enforced per-route         | ✓          | `createPermissionGuard(logger, PermissionModule.ACADEMIC_STRUCTURE, '<action>')` on each route                    |
| Import boundary respected       | ✓          | `apps/api` imports `packages/domain-core`; no cross-app imports                                                   |
| UI does not import DB           | ✓          | N/A — this stage has no UI layer changes                                                                          |
| No secrets in code              | ✓          | No credentials; migration uses pool client injected from runtime                                                  |
| Idempotent staff assignment     | ✓          | `ON CONFLICT (staff_id, department_id) DO NOTHING`                                                                |

---

## Files to Create

| File                                                                            | Type |
| ------------------------------------------------------------------------------- | ---- |
| `apps/api/src/db/tenant/migrations/20260317_001_departments.ts`                 | NEW  |
| `apps/api/src/db/tenant/schemas/departments.schema.ts`                          | NEW  |
| `apps/api/src/db/tenant/schemas/staff-departments.schema.ts`                    | NEW  |
| `apps/api/src/routes/backoffice/departments/helpers.ts`                         | NEW  |
| `apps/api/src/routes/backoffice/departments/list-departments.ts`                | NEW  |
| `apps/api/src/routes/backoffice/departments/create-department.ts`               | NEW  |
| `apps/api/src/routes/backoffice/departments/get-department.ts`                  | NEW  |
| `apps/api/src/routes/backoffice/departments/update-department.ts`               | NEW  |
| `apps/api/src/routes/backoffice/departments/delete-department.ts`               | NEW  |
| `apps/api/src/routes/backoffice/departments/children-department.ts`             | NEW  |
| `apps/api/src/routes/backoffice/departments/tree-departments.ts`                | NEW  |
| `apps/api/src/routes/backoffice/departments/staff-departments.ts`               | NEW  |
| `apps/api/src/routes/backoffice/departments/index.ts`                           | NEW  |
| `packages/domain-core/src/departments/departments.errors.ts`                    | NEW  |
| `packages/domain-core/src/departments/departments.types.ts`                     | NEW  |
| `packages/domain-core/src/departments/departments.service.ts`                   | NEW  |
| `packages/domain-core/src/departments/index.ts`                                 | NEW  |
| `packages/validation/src/departments/departments.validation.ts`                 | NEW  |
| `tests/api/departments/departments-crud.test.ts`                                | NEW  |
| `tests/api/departments/departments-hierarchy.test.ts`                           | NEW  |
| `tests/api/departments/departments-staff.test.ts`                               | NEW  |
| `tests/api/departments/departments-auth.test.ts`                                | NEW  |
| `packages/domain-core/src/departments/__tests__/departments-concurrent.test.ts` | NEW  |
| `packages/domain-core/src/departments/__tests__/departments.service.test.ts`    | NEW  |

---

## Files to Update

| File                                                | Change                                                 |
| --------------------------------------------------- | ------------------------------------------------------ |
| `apps/api/src/db/tenant/schemas/students.schema.ts` | Add `department_id` nullable FK column + index         |
| `apps/api/src/db/tenant/schemas/index.ts`           | Add exports for departments + staff-departments        |
| `apps/api/src/app.ts`                               | Import `departmentsRouter`; add `app.route(...)` mount |
| `packages/domain-core/src/index.ts`                 | Add `export * from './departments'`                    |
| `packages/domain-core/package.json`                 | Add `"./departments"` subpath export                   |
| `packages/validation/src/index.ts`                  | Export departments validation schemas                  |

---

## Architectural Concerns Found

### 1. Routing Order is Safety-Critical

`GET /departments/tree` must be registered before `GET /departments/:id`. Hono matches routes in
registration order. If `/:id` is registered first, the literal string `tree` will be interpreted as
a UUID parameter and return `DEPARTMENT_NOT_FOUND`. The router barrel's comment must document this
explicitly (see §4.11 above and the divisions index.ts comment for the analogous `/disable` case).

### 2. Self-Referencing FK and `AnyPgColumn`

Drizzle does not have native "self-reference" sugar. The `(): AnyPgColumn =>` pattern satisfies
TypeScript strict mode but is a workaround. The migration-owned FK constraint is the authoritative
DB-level constraint. The Drizzle declaration is for type-safety and query-builder ergonomics only.
If Drizzle introspection tools are run (e.g., `drizzle-kit push`), the functional unique index
will not be detected and must not be removed — the migration owns it. Include a warning comment
in the schema file (already included in the data-model.md source).

### 3. `max_users` Reduction has No Ejection Logic

Per Key Clarification #2, reducing `max_users` below the current count is allowed and only silently
caps future assignments. If business requirements change (e.g., require automatic student un-assignment
on cap reduction), a new stage or ADR is needed. This is not a concern for STAGE_23.

### 4. Tree Endpoint Scalability Boundary

The in-app tree build loads all department rows into memory. For workspaces with > 10,000
departments, this will cause performance degradation. The spec acknowledges this ("may be
paginated in a future stage"). The current implementation is appropriate for STAGE_23 scope.
A performance SLA test should be added to the integration suite at scale.

### 5. Division Consistency on Subtree Reparent

Per Key Clarification #3, only the moved node is checked for division consistency on reparent.
Children are NOT scanned. This means a reparented subtree can end up with mixed division scopes
(e.g., node A `division_id = X` is moved under a node with `division_id = null`, but node A's
children still have `division_id = X`). This is accepted behavior for STAGE_23. If strict subtree
consistency is required, it must be specified in a future stage.

### 6. `DEPARTMENT_HAS_ASSIGNMENTS` Covers Both Student and Staff

The delete guard checks both `students.department_id` and `staff_departments.department_id`. A
single 422 code covers both cases. This is intentional (the error message differentiates if needed)
and consistent with the spec's §FR-014. No architectural concern, but implementation must check
both tables in the same transaction to avoid a TOCTOU race between the staff and student checks.
