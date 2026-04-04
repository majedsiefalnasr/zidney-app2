/**
 * Staff Domain — Types
 *
 * File: packages/domain-core/src/staff/staff.types.ts
 * Stage: STAGE_41_STAFF_MANAGEMENT
 *
 * Pure type definitions — no logic, no imports from framework layer.
 */

// ---------------------------------------------------------------------------
// Database client interface
// ---------------------------------------------------------------------------

/** Minimal structural interface for query execution — satisfied by DbClient, TransactionClient, or Pool */
export interface QueryClient {
  query<T = unknown>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>
}

/** Minimal structural interface for a checked-out pool client with release */
export interface TransactionClient extends QueryClient {
  release(): void
}

/** Minimal structural interface for query execution — satisfied by Pool, PoolClient, or mock */
export interface DbClient extends QueryClient {
  connect(): Promise<TransactionClient>
}

// ---------------------------------------------------------------------------
// Domain Enums
// ---------------------------------------------------------------------------

export type StaffStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

// ---------------------------------------------------------------------------
// Raw DB rows (internal — never exposed directly in HTTP responses)
// ---------------------------------------------------------------------------

/** Full database row including sensitive fields */
export interface StaffRow {
  id: string
  workspace_id: string
  email: string
  name: string
  password_hash: string
  token_version: number
  is_active: boolean
  status: StaffStatus
  role_id: string | null
  division_ids: string[]
  failed_login_count: number
  locked_until: Date | null
  last_login: Date | null
  created_at: Date
  updated_at: Date
}

// ---------------------------------------------------------------------------
// Public record (safe to serialize in HTTP responses)
// ---------------------------------------------------------------------------

/** Staff record without password_hash — safe for API responses */
export interface StaffRecord {
  id: string
  workspace_id: string
  email: string
  name: string
  status: StaffStatus
  is_active: boolean
  role_id: string | null
  division_ids: string[]
  last_login: Date | null
  created_at: Date
  updated_at: Date
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateStaffInput {
  workspace_id: string
  email: string
  name: string
  password: string
  role_id?: string | null
  division_ids?: string[]
}

export interface UpdateStaffInput {
  name?: string
  email?: string
  division_ids?: string[]
  role_id?: string | null
}

export interface StaffListQuery {
  workspace_id: string
  page: number
  limit: number
  status?: StaffStatus
  division_id?: string
  search?: string
  cursor?: string
}

export interface StaffListResult {
  items: StaffRecord[]
  total: number
  page: number
  limit: number
}

// ---------------------------------------------------------------------------
// Audit context
// ---------------------------------------------------------------------------

export interface AuditContext {
  user_id: string
  workspace_id: string
  workspace_slug: string
  correlation_id: string
}

// ---------------------------------------------------------------------------
// Bulk import types
// ---------------------------------------------------------------------------

export interface StaffBulkImportRow {
  email: string
  name: string
  password: string
  role_id?: string | null
}

export interface StaffBulkImportRowError {
  row_index: number
  email: string
  reason: string
  code: string
}

export interface StaffBulkImportResult {
  inserted: number
  skipped: number
  errors: StaffBulkImportRowError[]
}
