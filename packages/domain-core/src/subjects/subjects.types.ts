/**
 * Subjects — Domain Types
 *
 * File: packages/domain-core/src/subjects/subjects.types.ts
 * Stage: STAGE_28_SUBJECTS
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

export type SubjectStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

// ---------------------------------------------------------------------------
// Row Shape (mirrors DB columns)
// ---------------------------------------------------------------------------

export interface SubjectRow {
  id: string
  name: string
  code: string | null
  division_id: string | null
  semester_id: string | null
  is_multilanguage: boolean
  default_language: string
  description: string | null
  status: SubjectStatus
  deleted_at: Date | string | null
  created_at: Date | string
  updated_at: Date | string
}

// ---------------------------------------------------------------------------
// Service Input / Result Types
// ---------------------------------------------------------------------------

export interface ListSubjectsInput {
  page: number
  limit: number
  status?: SubjectStatus
  search?: string
  division_id?: string
  semester_id?: string
}

export interface ListSubjectsResult {
  items: SubjectRow[]
  total: number
  page: number
  limit: number
}

export interface CreateSubjectInput {
  name: string
  code?: string | null
  division_id?: string | null
  semester_id?: string | null
  is_multilanguage?: boolean
  default_language: string
  description?: string | null
}

export interface UpdateSubjectInput {
  name?: string
  code?: string | null
  division_id?: string | null
  semester_id?: string | null
  is_multilanguage?: boolean
  default_language?: string
  description?: string | null
}

export interface TransitionSubjectInput {
  target_status: SubjectStatus
  expected_current_status: SubjectStatus
}
