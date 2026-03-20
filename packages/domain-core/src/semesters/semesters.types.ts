/**
 * Semesters — Domain Types
 *
 * File: packages/domain-core/src/semesters/semesters.types.ts
 * Stage: STAGE_27_SEMESTERS
 */

// ---------------------------------------------------------------------------
// Database Client Interface (structural — no pg import)
// ---------------------------------------------------------------------------

export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>
}

// ---------------------------------------------------------------------------
// Audit Context
// ---------------------------------------------------------------------------

export interface AuditContext {
  user_id: string
  correlation_id: string
  workspace_slug: string
  workspace_id: string
}

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export enum SemesterStatus {
  ENABLED = 'ENABLED',
  DISABLED = 'DISABLED',
}

// ---------------------------------------------------------------------------
// Row Shape (mirrors DB columns; date fields returned as string by pg driver)
// ---------------------------------------------------------------------------

export interface SemesterRow {
  id: string
  name: string
  description: string | null
  start_date: string | null
  end_date: string | null
  status: 'ENABLED' | 'DISABLED'
  deleted_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

// ---------------------------------------------------------------------------
// Service Input / Result Types
// ---------------------------------------------------------------------------

export interface ListSemestersInput {
  page: number
  limit: number
  status?: 'ENABLED' | 'DISABLED'
  search?: string
}

export interface ListSemestersResult {
  items: SemesterRow[]
  total: number
  page: number
  limit: number
}

export interface CreateSemesterInput {
  name: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
}

export interface UpdateSemesterInput {
  name?: string
  description?: string | null
  start_date?: string | null
  end_date?: string | null
  status?: 'ENABLED' | 'DISABLED'
}

export interface DeleteSemesterResult {
  deleted: boolean
}
