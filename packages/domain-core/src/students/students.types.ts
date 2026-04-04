/**
 * Students Domain — Types
 *
 * File: packages/domain-core/src/students/students.types.ts
 * Stage: STAGE_42_STUDENT_MANAGEMENT
 *
 * Pure type definitions — no logic, no imports from framework layer.
 */

// ---------------------------------------------------------------------------
// Database client interface
// ---------------------------------------------------------------------------

/** Minimal structural interface for query execution and transaction control */
export interface TransactionClient {
  query<T = unknown>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>
  release(): void
}

/** Database pool with transaction capabilities */
export interface DbClient {
  query<T = unknown>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>
  connect(): Promise<TransactionClient>
}

// ---------------------------------------------------------------------------
// Domain Enums
// ---------------------------------------------------------------------------

export type StudentStatus = 'ACTIVE' | 'DISABLED'
export type SubscriptionStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'NONE'

// ---------------------------------------------------------------------------
// Raw DB rows (internal — never exposed directly in HTTP responses)
// ---------------------------------------------------------------------------

/** Full database row including sensitive / lockout fields */
export interface StudentRow {
  id: string
  workspace_id: string
  external_id: string | null
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  password_hash: string | null
  division_id: string
  department_id: string | null
  group_id: string | null
  semester_id: string | null
  subscription_status: SubscriptionStatus
  status: StudentStatus
  token_version: number
  failed_login_count: number
  locked_until: Date | null
  created_at: Date
  updated_at: Date
}

// ---------------------------------------------------------------------------
// Public record (safe to serialize in HTTP responses)
// ---------------------------------------------------------------------------

/** Student record without password_hash, failed_login_count, locked_until, workspace_id — safe for API responses */
export interface StudentRecord {
  id: string
  external_id: string | null
  email: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  division_id: string
  department_id: string | null
  group_id: string | null
  semester_id: string | null
  subscription_status: SubscriptionStatus
  status: StudentStatus
  token_version: number
  created_at: Date
  updated_at: Date
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateStudentInput {
  workspace_id: string
  email: string
  password: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  external_id?: string | null
  division_id: string
  department_id?: string | null
  group_id?: string | null
  semester_id?: string | null
  subscription_status?: SubscriptionStatus
}

export interface UpdateStudentInput {
  email?: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  external_id?: string | null
  division_id?: string
  department_id?: string | null
  group_id?: string | null
  semester_id?: string | null
}

export interface UpdateSubscriptionInput {
  student_id: string
  workspace_id: string
  subscription_status: SubscriptionStatus
}

// ---------------------------------------------------------------------------
// Query / list types
// ---------------------------------------------------------------------------

export interface StudentListQuery {
  workspace_id: string
  page: number
  limit: number
  status?: StudentStatus
  subscription_status?: SubscriptionStatus
  division_id?: string
  department_id?: string
  group_id?: string
  semester_id?: string
  search?: string
}

export interface StudentListResult {
  items: StudentRecord[]
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

export interface BulkImportRow {
  email: string
  password: string
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  external_id?: string | null
  division_id: string
  department_id?: string | null
  group_id?: string | null
  semester_id?: string | null
  subscription_status?: SubscriptionStatus
}

export interface BulkImportRowError {
  row_index: number
  email: string
  reason: string
  code: string
}

export interface BulkImportResult {
  inserted: number
  skipped: number
  errors: BulkImportRowError[]
}
