/**
 * Departments Domain — Types & Interfaces
 *
 * File: packages/domain-core/src/departments/departments.types.ts
 * Stage: STAGE_23_DEPARTMENTS
 * Date: 2026-03-17
 *
 * Pure TypeScript types and interfaces. No runtime logic.
 * No pg imports — services accept DbClient via injection (ADR-0001).
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — definitions only
 * ✓ No framework dependencies beyond TypeScript
 * ✓ Tenant DB compatible (no master_db references)
 */

// ---------------------------------------------------------------------------
// DbClient — Structural Type (Injected)
// ---------------------------------------------------------------------------

/**
 * Structural type for a database client.
 * Matches the shape of pg.Pool — allows service injection without
 * importing 'pg' into the domain layer.
 *
 * No direct `pg` import — services accept this type via injection.
 */
export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>
}

// ---------------------------------------------------------------------------
// AuditContext — Request Metadata
// ---------------------------------------------------------------------------

/**
 * Audit context — propagated from the HTTP layer via middleware.
 * Includes user identity, correlation ID, and workspace scope.
 */
export interface AuditContext {
  user_id: string
  correlation_id: string // NOT request_id — matches logging contract (AGENTS.md §Logging Rules)
  workspace_slug: string
  workspace_id: string
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Department lifecycle status.
 * ENABLED  → department is operational and assignable to students/staff.
 * DISABLED → department is inactive; existing assignments preserved but
 *            new assignments rejected (DEPARTMENT_DISABLED error).
 */
export enum DepartmentStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
}

/**
 * Department classification type.
 * MAIN   → primary organizational unit.
 * SUB    → sub-unit within a parent department.
 * SIMPLE → leaf-level department (no children).
 */
export enum DepartmentType {
  MAIN = 'MAIN',
  SUB = 'SUB',
  SIMPLE = 'SIMPLE',
}

// ---------------------------------------------------------------------------
// Row Interfaces (mirror DB schema)
// ---------------------------------------------------------------------------

/** Full database row for the `departments` table. */
export interface DepartmentRow extends Record<string, unknown> {
  id: string
  name: string
  type: DepartmentType
  parent_id: string | null
  division_id: string | null
  max_users: number | null
  description: string | null
  status: DepartmentStatus
  created_at: Date
  updated_at: Date
}

/** Hierarchical tree node — used by getDepartmentTree(). */
export interface DepartmentTreeNode {
  id: string
  name: string
  type: DepartmentType
  status: DepartmentStatus
  parent_id: string | null
  division_id: string | null
  children: DepartmentTreeNode[]
}

/** Full database row for the `staff_departments` join table. */
export interface StaffDepartmentRow extends Record<string, unknown> {
  staff_id: string
  department_id: string
  assigned_at: Date
}

// ---------------------------------------------------------------------------
// Command Inputs
// ---------------------------------------------------------------------------

export interface CreateDepartmentInput {
  name: string
  type: DepartmentType
  parent_id?: string | null
  division_id?: string | null
  max_users?: number | null
  description?: string | null
}

export interface UpdateDepartmentInput {
  name?: string
  type?: DepartmentType
  parent_id?: string | null // absent = no-op; explicit null = reparent to root
  division_id?: string | null
  max_users?: number | null
  description?: string | null
  status?: DepartmentStatus
}

// ---------------------------------------------------------------------------
// Query Inputs / Results
// ---------------------------------------------------------------------------

export interface ListDepartmentsInput {
  limit: number
  cursor: string | null
  status?: DepartmentStatus | 'all'
  division_id?: string | null
  parent_id?: string | null | 'root' // 'root' = filter by null parent_id
  type?: DepartmentType
}

export interface ListDepartmentsResult {
  items: DepartmentRow[]
  nextCursor: string | null
  total: number
}
