/**
 * MCQ Questions — Types
 *
 * File: packages/domain-core/src/mcq-questions/mcq-questions.types.ts
 * Stage: STAGE_34_MCQ_QUESTION_MODEL
 *
 * Shared type definitions for the MCQ Questions domain module.
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

export type McqQuestionType = 'SINGLE' | 'MULTIPLE' | 'TRUE_FALSE' | 'ARRANGEMENT'

export const VALID_QUESTION_TYPES: McqQuestionType[] = [
  'SINGLE',
  'MULTIPLE',
  'TRUE_FALSE',
  'ARRANGEMENT',
]

export type McqQuestionStatus = 'DRAFT' | 'COMPLETED' | 'UNDER_REVIEW' | 'APPROVED' | 'ENABLED'

export const VALID_QUESTION_STATUSES: McqQuestionStatus[] = [
  'DRAFT',
  'COMPLETED',
  'UNDER_REVIEW',
  'APPROVED',
  'ENABLED',
]

// ── Row Types ────────────────────────────────────────────────────────────────

export interface McqQuestionRow {
  id: string
  subject_id: string
  division_id: string | null
  lesson_id: string | null
  question_type: McqQuestionType
  language: string
  content: string
  explanation: string | null
  is_revision_only: boolean
  is_exam_only: boolean
  status: McqQuestionStatus
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
  status_updated_at: Date | null
  status_updated_by: string | null
}

export interface McqQuestionOptionRow {
  id: string
  question_id: string
  content: string
  is_correct: boolean
  order_index: number
  created_at: Date
}

export interface McqQuestionWithOptions extends McqQuestionRow {
  options: McqQuestionOptionRow[]
}

export interface McqQuestionCategoryRow {
  id: string
  question_id: string
  category_value_id: string
}

export interface McqQuestionTagRow {
  id: string
  question_id: string
  tag_id: string
}

export interface McqQuestionBasketRow {
  id: string
  question_id: string
  basket_id: string
}

// ── Input DTOs ───────────────────────────────────────────────────────────────

export interface OptionInput {
  content: string
  is_correct: boolean
  order_index: number
}

export interface CreateMcqQuestionInput {
  subject_id: string
  division_id?: string | null
  lesson_id?: string | null
  question_type: McqQuestionType
  language: string
  content: string
  explanation?: string | null
  is_revision_only?: boolean
  is_exam_only?: boolean
  options: OptionInput[]
}

export interface UpdateMcqQuestionInput {
  subject_id?: string
  division_id?: string | null
  lesson_id?: string | null
  question_type?: McqQuestionType
  language?: string
  content?: string
  explanation?: string | null
  is_revision_only?: boolean
  is_exam_only?: boolean
  options?: OptionInput[]
  updated_at?: Date | string
}

export interface ListMcqQuestionsInput {
  page: number
  per_page: number
  subject_id?: string
  division_id?: string
  lesson_id?: string
  question_type?: McqQuestionType
  status?: McqQuestionStatus
  category_value_id?: string
  tag_id?: string
  basket_id?: string
  is_revision_only?: boolean
  is_exam_only?: boolean
  search?: string
}

// ── Output DTOs ──────────────────────────────────────────────────────────────

/** Full question detail with options and all classification links. */
export interface McqQuestionDetail extends McqQuestionWithOptions {
  categories: McqQuestionCategoryRow[]
  tags: McqQuestionTagRow[]
  baskets: McqQuestionBasketRow[]
}

export interface ListMcqQuestionsResult {
  data: McqQuestionRow[]
  total: number
  page: number
  per_page: number
}

export interface DeletionGuardResult {
  has_dependencies: boolean
  basket_count: number
  registry_count: number
}
