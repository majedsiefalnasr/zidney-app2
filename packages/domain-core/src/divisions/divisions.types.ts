/**
 * Divisions Domain Types — STAGE_22
 *
 * File: packages/domain-core/src/divisions/divisions.types.ts
 * Stage: STAGE_22_DIVISIONS
 * Date: 2026-03-16
 *
 * Pure TypeScript type definitions for the Divisions domain.
 * No HTTP logic. No framework dependencies. No pg imports.
 *
 * Constitutional Compliance:
 * ✓ Pure types — no runtime logic
 * ✓ No framework imports
 * ✓ No DB imports (DbClient is a structural type only)
 */

// ---------------------------------------------------------------------------
// DB Client (structural type — no pg import)
// ---------------------------------------------------------------------------

/**
 * Minimal database client interface for divisions service functions.
 * Matches the `{ query(sql, params): Promise<{rows, rowCount}> }` shape
 * exposed by `tenant.pool` in the Hono context.
 * No direct `pg` import — services accept this type via injection.
 */
export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Division lifecycle status.
 * ENABLED  → division is operational and assignable to students/staff.
 * DISABLED → division is inactive; existing assignments preserved but
 *            new assignments rejected (DIVISION_DISABLED error).
 */
export enum DivisionStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
}

// ---------------------------------------------------------------------------
// Row Interfaces (mirror DB schema)
// ---------------------------------------------------------------------------

/** Full database row for the `divisions` table. */
export interface DivisionRow extends Record<string, unknown> {
  id: string
  name: string
  description: string | null
  is_default: boolean
  status: DivisionStatus
  created_at: Date
  updated_at: Date
}

/** Full database row for the `staff_divisions` join table. */
export interface StaffDivisionRow extends Record<string, unknown> {
  staff_id: string
  division_id: string
  assigned_at: Date
}

// ---------------------------------------------------------------------------
// Command Inputs
// ---------------------------------------------------------------------------

export interface CreateDivisionInput {
  name: string
  description?: string | null
}

export interface UpdateDivisionInput {
  name: string
  description?: string | null
}

export interface UpdateDivisionStatusInput {
  status: DivisionStatus
}

// ---------------------------------------------------------------------------
// Query Inputs / Results
// ---------------------------------------------------------------------------

export interface ListDivisionsInput {
  /** Page size. Clamped to 100 max by service. */
  limit: number
  /**
   * Cursor value from a previous page's `nextCursor`.
   * Format: ISO timestamp for created_at of the last row.
   */
  cursor?: string | null
  /** Filter by status, or 'all' to skip the filter. */
  status: DivisionStatus | 'all'
}

export interface ListDivisionsResult {
  items: DivisionRow[]
  /** Cursor for the next page, null when on the last page. */
  nextCursor: string | null
  /** Total count of rows matching the filter (excluding pagination). */
  total: number
}

// ---------------------------------------------------------------------------
// Operation Results
// ---------------------------------------------------------------------------

/**
 * Result of the `disableDivisions` transactional operation.
 * Reports how many records were affected in each entity.
 */
export interface DisableDivisionsResult {
  /** Number of students whose division_id was reassigned to the default division. */
  students_reassigned: number
  /**
   * Number of staff division assignments that were cleared and reinserted
   * pointing to the default division.
   */
  staff_divisions_reassigned: number
  /** Number of non-default divisions that had their status set to DISABLED. */
  divisions_disabled: number
}

// ---------------------------------------------------------------------------
// Audit Context
// ---------------------------------------------------------------------------

/**
 * Contextual audit data passed through service functions for structured logging.
 * Populated from the Hono request context at the route handler layer.
 */
export interface AuditContext {
  user_id: string
  request_id: string
  workspace_slug: string
  workspace_id: string
}
