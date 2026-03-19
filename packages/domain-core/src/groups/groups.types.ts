/**
 * Groups Domain — Types & Interfaces
 *
 * File: packages/domain-core/src/groups/groups.types.ts
 * Stage: STAGE_24_GROUPS
 * Date: 2026-03-19
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
  correlation_id: string
  workspace_slug: string
  workspace_id: string
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Group lifecycle status.
 * ENABLED  → group is operational and assignable to students/staff.
 * DISABLED → group is inactive; existing assignments preserved but
 *            new assignments rejected (GROUP_DISABLED error).
 */
export enum GroupStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
}

// ---------------------------------------------------------------------------
// Row Interfaces (mirror DB schema)
// ---------------------------------------------------------------------------

/** Mirror of the `groups` table row. */
export interface GroupRow {
  id: string
  name: string
  department_id: string | null
  max_members: number | null
  description: string | null
  status: 'ENABLED' | 'DISABLED'
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
}

/** Mirror of the `staff_groups` join-table row. */
export interface StaffGroupRow {
  staff_id: string
  group_id: string
  created_at: Date
}

// ---------------------------------------------------------------------------
// Input / Output Types
// ---------------------------------------------------------------------------

export interface ListGroupsInput {
  limit: number
  cursor?: string
  status?: 'ENABLED' | 'DISABLED' | 'all'
  department_id?: string
}

export interface ListGroupsResult {
  items: GroupRow[]
  nextCursor: string | null
  total: number
}

export interface CreateGroupInput {
  name: string
  department_id?: string
  max_members?: number
  description?: string
}

export interface UpdateGroupInput {
  name?: string
  department_id?: string | null
  max_members?: number | null
  description?: string | null
  status?: 'ENABLED' | 'DISABLED'
}

/** Result shape for student assignment / removal. */
export interface StudentGroupResult {
  student_id: string
  group_id: string | null
}
