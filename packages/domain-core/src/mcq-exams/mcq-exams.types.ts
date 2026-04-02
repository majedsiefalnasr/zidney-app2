/**
 * MCQ Exams — Types
 *
 * File: packages/domain-core/src/mcq-exams/mcq-exams.types.ts
 * Stage: STAGE_36_MCQ_EXAM_CONFIG
 *
 * Shared type definitions for the MCQ Exam Configuration domain module.
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

export type McqExamSelectionMode = 'MANUAL' | 'AUTOMATIC'

export const VALID_SELECTION_MODES: McqExamSelectionMode[] = ['MANUAL', 'AUTOMATIC']

export type McqExamPassType = 'PERCENTAGE' | 'SCORE'

export const VALID_PASS_TYPES: McqExamPassType[] = ['PERCENTAGE', 'SCORE']

export type McqExamStatus = 'DRAFT' | 'COMPLETED' | 'UNDER_REVIEW' | 'APPROVED' | 'ENABLED'

export const VALID_EXAM_STATUSES: McqExamStatus[] = [
  'DRAFT',
  'COMPLETED',
  'UNDER_REVIEW',
  'APPROVED',
  'ENABLED',
]

// ── Row Types ────────────────────────────────────────────────────────────────

export interface McqExamRow {
  id: string
  subject_id: string
  division_id: string | null
  name: string
  code: string
  description: string | null
  language: string
  total_questions: number
  duration_minutes: number | null
  pass_type: McqExamPassType
  pass_value: number
  allow_multiple_attempts: boolean
  selection_mode: McqExamSelectionMode
  status: McqExamStatus
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
}

export interface McqExamSettingsRow {
  id: string
  exam_id: string
  allow_relax_mode: boolean
  allow_chrono_mode: boolean
  allow_rush_mode: boolean
  allow_review_answers: boolean
  allow_review_hints: boolean
  allow_result_effects: boolean
  show_results_after_submit: boolean
  show_correct_answers: boolean
  show_explanations: boolean
  enable_certificate: boolean
  message_template_id: string | null
  created_at: Date
  updated_at: Date
}

export interface McqExamQuestionRow {
  id: string
  exam_id: string
  question_id: string
  order_index: number
  created_at: Date
}

export interface McqExamAutoCriteriaRow {
  id: string
  exam_id: string
  lesson_ids: string[] | null
  category_value_ids: string[] | null
  tag_ids: string[] | null
  basket_ids: string[] | null
  category_ids: string[] | null
  semester_id: string | null
  /** Mutually exclusive with fixed_count. */
  percentage: number | null
  /** Mutually exclusive with percentage. */
  fixed_count: number | null
  created_at: Date
  updated_at: Date
}

// ── Detail Types ─────────────────────────────────────────────────────────────

export interface McqExamDetail extends McqExamRow {
  settings: McqExamSettingsRow | null
  questions: McqExamQuestionRow[]
  criteria: McqExamAutoCriteriaRow[]
}

// ── Input DTOs ───────────────────────────────────────────────────────────────

export interface CreateMcqExamInput {
  name: string
  code: string
  description?: string | null
  subject_id: string
  division_id?: string | null
  language: string
  total_questions: number
  duration_minutes?: number | null
  pass_type: McqExamPassType
  pass_value: number
  allow_multiple_attempts?: boolean
  selection_mode: McqExamSelectionMode
}

export interface UpdateMcqExamInput {
  name?: string
  code?: string
  description?: string | null
  division_id?: string | null
  language?: string
  total_questions?: number
  duration_minutes?: number | null
  pass_type?: McqExamPassType
  pass_value?: number
  allow_multiple_attempts?: boolean
  selection_mode?: McqExamSelectionMode
}

export interface UpsertExamSettingsInput {
  allow_relax_mode?: boolean
  allow_chrono_mode?: boolean
  allow_rush_mode?: boolean
  allow_review_answers?: boolean
  allow_review_hints?: boolean
  allow_result_effects?: boolean
  show_results_after_submit?: boolean
  show_correct_answers?: boolean
  show_explanations?: boolean
  enable_certificate?: boolean
  message_template_id?: string | null
}

export interface QuestionOrderEntry {
  question_id: string
  order_index: number
}

export interface AddExamQuestionsInput {
  questions: QuestionOrderEntry[]
}

export interface ReorderQuestionsInput {
  order: QuestionOrderEntry[]
}

export interface CriteriaEntry {
  lesson_ids?: string[] | null
  category_value_ids?: string[] | null
  tag_ids?: string[] | null
  basket_ids?: string[] | null
  category_ids?: string[] | null
  semester_id?: string | null
  /** Mutually exclusive with fixed_count. Percentage of total_questions (0-100). */
  percentage?: number | null
  /** Mutually exclusive with percentage. Absolute question count (> 0). */
  fixed_count?: number | null
}

export interface SetCriteriaInput {
  criteria: CriteriaEntry[]
}

export interface ListMcqExamsInput {
  page: number
  per_page: number
  subject_id?: string
  division_id?: string
  selection_mode?: McqExamSelectionMode
  status?: McqExamStatus
  search?: string
}

// ── Output DTOs ──────────────────────────────────────────────────────────────

export interface ListMcqExamsResult {
  data: McqExamRow[]
  total: number
  page: number
  per_page: number
}

export interface DeletionGuardResult {
  has_dependencies: boolean
  is_active_attempt: boolean
}
