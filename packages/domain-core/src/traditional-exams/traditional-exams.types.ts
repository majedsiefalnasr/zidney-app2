/**
 * Traditional Exams — Types & DTOs
 *
 * File: packages/domain-core/src/traditional-exams/traditional-exams.types.ts
 * Stage: STAGE_37_TRADITIONAL_EXAM_CONFIG
 */

// ── Database Client ──────────────────────────────────────────────

export interface DbClient {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

// ── Audit Context ────────────────────────────────────────────────

export interface AuditContext {
  user_id: string
  correlation_id: string
  workspace_slug: string
  workspace_id: string
  caller_permissions: string[]
}

// ── Enums ────────────────────────────────────────────────────────

export const TRADITIONAL_EXAM_MODULE_TYPES = ['TOPIC', 'EXERCISE'] as const
export type TraditionalExamModuleType = (typeof TRADITIONAL_EXAM_MODULE_TYPES)[number]

export const TRADITIONAL_EXAM_STATUSES = [
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'ENABLED',
  'DISABLED',
] as const
export type TraditionalExamStatus = (typeof TRADITIONAL_EXAM_STATUSES)[number]

// ── Row Types ────────────────────────────────────────────────────

export interface TraditionalExamRow {
  id: string
  subject_id: string
  division_id: string | null
  semester_id: string | null
  template_id: string
  name: string
  code: string
  description: string | null
  duration_minutes: number | null
  pass_percentage: string // NUMERIC comes as string from pg
  module_type: TraditionalExamModuleType
  status: TraditionalExamStatus
  deleted_at: Date | null
  created_at: Date
  updated_at: Date
  created_by: string | null
  updated_by: string | null
}

export interface TraditionalExamSettingsRow {
  id: string
  exam_id: string
  shuffle_questions: boolean
  shuffle_options: boolean
  show_results_immediately: boolean
  allow_back_navigation: boolean
  auto_submit_on_timeout: boolean
  show_question_score: boolean
  require_answer_before_next: boolean
  show_remaining_time: boolean
  allow_flag_questions: boolean
  enable_auto_grading: boolean
  message_template_id: string | null
  created_at: Date
  updated_at: Date
}

export interface TraditionalExamSectionRow {
  id: string
  exam_id: string
  template_section_id: string | null
  header_content: string | null
  order_index: number
  created_at: Date
  updated_at: Date
}

export interface TraditionalExamSubsectionRow {
  id: string
  section_id: string
  template_subsection_id: string | null
  header_content: string | null
  order_index: number
  created_at: Date
  updated_at: Date
}

export interface TraditionalExamQuestionRow {
  id: string
  subsection_id: string
  question_id: string
  score: string // NUMERIC comes as string from pg
  order_index: number
  created_at: Date
  updated_at: Date
}

// ── Detail Type (for getExam) ────────────────────────────────────

export interface TraditionalExamDetail extends TraditionalExamRow {
  settings: TraditionalExamSettingsRow | null
  section_count: number
  subsection_count: number
  question_count: number
  total_score: string
}

// ── Input DTOs ───────────────────────────────────────────────────

export interface CreateTraditionalExamInput {
  name: string
  code: string
  description?: string | null
  subject_id: string
  division_id?: string | null
  semester_id?: string | null
  template_id: string
  duration_minutes?: number | null
  pass_percentage: number
  module_type: TraditionalExamModuleType
}

export interface UpdateTraditionalExamInput {
  name?: string
  code?: string
  description?: string | null
  division_id?: string | null
  semester_id?: string | null
  duration_minutes?: number | null
  pass_percentage?: number
  module_type?: TraditionalExamModuleType
}

export interface UpsertSettingsInput {
  shuffle_questions: boolean
  shuffle_options: boolean
  show_results_immediately: boolean
  allow_back_navigation: boolean
  auto_submit_on_timeout: boolean
  show_question_score: boolean
  require_answer_before_next: boolean
  show_remaining_time: boolean
  allow_flag_questions: boolean
  enable_auto_grading: boolean
  message_template_id?: string | null
}

export interface UpdateSectionInput {
  header_content?: string | null
  order_index?: number
}

export interface UpdateSubsectionInput {
  header_content?: string | null
  order_index?: number
}

export interface AssignQuestionsInput {
  questions: Array<{
    question_id: string
    score: number
  }>
}

export interface ReorderQuestionsInput {
  question_ids: string[]
}

export interface ListTraditionalExamsInput {
  page: number
  per_page: number
  subject_id?: string
  division_id?: string
  module_type?: TraditionalExamModuleType
  status?: TraditionalExamStatus
  search?: string
}

export interface ListTraditionalExamsResult {
  data: TraditionalExamRow[]
  total: number
  page: number
  per_page: number
}

// ── Deletion Guard ───────────────────────────────────────────────

export interface ExamReferenceCheckResult {
  hasReferences: boolean
  isActiveAttempt: boolean
}
