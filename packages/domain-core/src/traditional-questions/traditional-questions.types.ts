/**
 * Traditional Questions — Types
 *
 * File: packages/domain-core/src/traditional-questions/traditional-questions.types.ts
 * Stage: STAGE_35_TRADITIONAL_QUESTION_MODEL
 *
 * Shared type definitions for the Traditional Questions domain module.
 */

// ── Database Client Interface ────────────────────────────────────────────────

export interface DbClient {
  query<T = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>
  connect?(): Promise<{
    query<T = Record<string, unknown>>(
      text: string,
      values?: unknown[]
    ): Promise<{ rows: T[]; rowCount: number | null }>
    release(): void
  }>
}

// ── Audit Context ────────────────────────────────────────────────────────────

export interface AuditContext {
  user_id: string
  correlation_id: string
  workspace_slug: string
  workspace_id: string
  caller_permissions?: string[]
}

// ── Domain Enums ─────────────────────────────────────────────────────────────

export type TraditionalQuestionType = 'TRUE_FALSE' | 'FILL_BLANK' | 'SHORT_ANSWER'

export const VALID_QUESTION_TYPES: TraditionalQuestionType[] = [
  'TRUE_FALSE',
  'FILL_BLANK',
  'SHORT_ANSWER',
]

export type TraditionalQuestionStatus =
  | 'DRAFT'
  | 'COMPLETED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'ENABLED'

export const VALID_QUESTION_STATUSES: TraditionalQuestionStatus[] = [
  'DRAFT',
  'COMPLETED',
  'UNDER_REVIEW',
  'APPROVED',
  'ENABLED',
]

// ── Row Types ────────────────────────────────────────────────────────────────

export interface TraditionalQuestionRow {
  id: string
  subject_id: string
  division_id: string | null
  lesson_id: string | null
  subsection_id: string
  question_type: TraditionalQuestionType
  language: string
  content: string
  correct_answer: Record<string, unknown> | null
  correction_criteria: Record<string, unknown> | null
  score: string // NUMERIC returns string from pg driver
  status: TraditionalQuestionStatus
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
  status_updated_at: Date | null
  status_updated_by: string | null
}

export interface TraditionalQuestionCategoryRow {
  id: string
  question_id: string
  category_value_id: string
}

export interface TraditionalQuestionTagRow {
  id: string
  question_id: string
  tag_id: string
}

// ── Input DTOs ───────────────────────────────────────────────────────────────

export interface CreateTraditionalQuestionInput {
  subject_id: string
  division_id?: string | null
  lesson_id?: string | null
  subsection_id: string
  question_type: TraditionalQuestionType
  language: string
  content: string
  correct_answer?: Record<string, unknown> | null
  correction_criteria?: Record<string, unknown> | null
  score: number
}

export interface UpdateTraditionalQuestionInput {
  division_id?: string | null
  lesson_id?: string | null
  language?: string
  content?: string
  correct_answer?: Record<string, unknown> | null
  correction_criteria?: Record<string, unknown> | null
  score?: number
  updated_at?: Date | string
}

export interface ListTraditionalQuestionsInput {
  page: number
  per_page: number
  subject_id?: string
  division_id?: string
  lesson_id?: string
  subsection_id?: string
  question_type?: TraditionalQuestionType
  status?: TraditionalQuestionStatus
  category_value_id?: string
  tag_id?: string
  search?: string
}

// ── Output DTOs ──────────────────────────────────────────────────────────────

/** Full question detail with all classification links. */
export interface TraditionalQuestionDetail extends TraditionalQuestionRow {
  categories: TraditionalQuestionCategoryRow[]
  tags: TraditionalQuestionTagRow[]
}

export interface ListTraditionalQuestionsResult {
  data: TraditionalQuestionRow[]
  total: number
  page: number
  per_page: number
}

export interface DeletionGuardResult {
  has_dependencies: boolean
  registry_count: number
}
