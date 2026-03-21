/**
 * Lessons Domain — Shared Types
 *
 * File: packages/domain-core/src/lessons/lessons.types.ts
 * Stage: STAGE_29_LESSONS
 *
 * Structural `DbClient` interface (raw `pg` Pool/PoolClient duck-typing),
 * `AuditContext` with nullable user_id, domain status union, DB row shape,
 * and all service-layer input/result contracts.
 *
 * Note: user_id is `string | null` because the runtime endpoint (/runtime)
 * is unauthenticated — the authenticated backoffice handlers pass the resolved
 * user ID string, unauthenticated callers pass null.
 */

// ---------------------------------------------------------------------------
// Database client abstraction
// ---------------------------------------------------------------------------

export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>
}

// ---------------------------------------------------------------------------
// Audit context — user_id is nullable for unauthenticated runtime endpoint
// ---------------------------------------------------------------------------

export interface AuditContext {
  user_id: string | null
  correlation_id: string
  workspace_slug: string
  workspace_id: string
}

// ---------------------------------------------------------------------------
// Status lifecycle
// ---------------------------------------------------------------------------

export type LessonStatus = 'ENABLED' | 'DISABLED'

// ---------------------------------------------------------------------------
// Database row shape (mirrors the PostgreSQL `lessons` table exactly)
// ---------------------------------------------------------------------------

export interface LessonRow {
  id: string
  subject_id: string
  name: string
  code: string | null
  description: string | null
  status: LessonStatus
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
}

// ---------------------------------------------------------------------------
// Service input / result contracts
// ---------------------------------------------------------------------------

export interface ListLessonsInput {
  page: number
  limit: number
  subject_id?: string
  status?: LessonStatus
  search?: string
}

export interface ListLessonsResult {
  items: LessonRow[]
  total: number
  page: number
  limit: number
}

export interface CreateLessonInput {
  subject_id: string
  name: string
  code?: string | null
  description?: string | null
}

export interface UpdateLessonInput {
  name?: string
  code?: string | null
  description?: string | null
  status?: LessonStatus
}

export interface ActiveLessonItem {
  id: string
  name: string
  code: string | null
}
