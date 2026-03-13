/**
 * Attempt Engine Type Definitions
 * STAGE_06_ATTEMPT_ENGINE_FOUNDATION
 *
 * Comprehensive TypeScript interfaces for the attempt engine.
 * All types must match database schema exactly.
 *
 * ADRs: ADR-0001 (tenant isolation), ADR-0002 (snapshot model)
 */

/**
 * Enum: AttemptType
 * Defines all supported exam delivery modes
 */
export enum AttemptType {
  MCQ_ASSESSMENT = 'MCQ_ASSESSMENT', // Single-topic assessment
  MCQ_EXAM = 'MCQ_EXAM', // Full exam
  MCQ_SCHEDULED = 'MCQ_SCHEDULED', // Scheduled system
  TOPIC_EXAM = 'TOPIC_EXAM', // Topic-restricted exam
  EXERCISE_EXAM = 'EXERCISE_EXAM', // Exercise/practice mode
  TRADITIONAL_SCHEDULED = 'TRADITIONAL_SCHEDULED', // Traditional scheduled exam
}

/**
 * Enum: AttemptMode
 * Defines timing behavior for attempts
 */
export enum AttemptMode {
  RELAX = 'RELAX', // No timer; manual submission only
  CHRONO = 'CHRONO', // Countdown timer; auto-submit on expiration
  RUSH = 'RUSH', // Total duration timer; strict deadline
}

/**
 * Enum: AttemptStatus
 * Defines attempt lifecycle states
 */
export enum AttemptStatus {
  IN_PROGRESS = 'IN_PROGRESS', // Attempt in progress
  SUBMITTED = 'SUBMITTED', // Submitted; grading in progress or queued
  FINALIZED = 'FINALIZED', // Grading complete; score and result available
  EXPIRED = 'EXPIRED', // Attempt timed out
  ABORTED = 'ABORTED', // Student aborted attempt
}

/**
 * Enum: QuestionType
 * Defines supported question formats
 */
export enum QuestionType {
  MCQ = 'MCQ', // Multiple choice question
  SHORT_ANSWER = 'SHORT_ANSWER', // Short text answer
  ESSAY = 'ESSAY', // Long text answer
  MATCH = 'MATCH', // Matching/pairing question
  TRUE_FALSE = 'TRUE_FALSE', // True/false question
  FILL_BLANK = 'FILL_BLANK', // Fill-in-the-blank
  ORDERING = 'ORDERING', // Ordering/sequencing
}

/**
 * Interface: QuestionSnapshot
 * Complete question metadata captured at attempt start.
 * Server-side immutable data structure used for deterministic grading.
 */
export interface QuestionSnapshot {
  id: string // UUID of question
  text: string // Question text (may include HTML)
  type: QuestionType // Question format
  options?: string[] // MCQ options: ["A", "B", "C", "D"]
  correct_answer: unknown // Correct answer (secret; server-only)
  points: number // Points possible for this question
  metadata?: Record<string, unknown> // Additional metadata (hints, difficulty, etc.)
}

/**
 * Interface: QuestionSnapshotContainer
 * Wrapper for question snapshot storage and retrieval
 */
export interface QuestionSnapshotContainer {
  questions: QuestionSnapshot[]
}

/**
 * Interface: GradingConfigSnapshot
 * Complete grading configuration captured at attempt start.
 * Defines how questions are scored and pass/fail determination.
 */
export interface GradingConfigSnapshot {
  pass_score_percentage: number // Percentage needed to pass (0-100)
  total_points: number // Maximum achievable points
  question_weights?: Record<string, number> // Per-question weight multipliers
  pass_fail_logic: string // Logic expression: "SUM_SCORE >= pass_score_percentage"
  review_allowed: boolean // Whether student can review answers after submission
  hints_allowed: boolean // Whether hints are available during attempt
  show_correct_answer: boolean // Whether to show correct answer after attempt
  randomize_options: boolean // Whether MCQ options are randomized
  one_question_per_page: boolean // UI layout hint
}

/**
 * Interface: FlagsSnapshot
 * UI behavior and feature flags captured at attempt start.
 */
export interface FlagsSnapshot {
  review_allowed: boolean // Can review answers
  hints_allowed: boolean // Hints available
  show_correct_answer: boolean // Show answer key
  randomize_options: boolean // Randomize MCQ options
  one_question_per_page: boolean // Page layout
}

/**
 * Interface: UserAnswer
 * Student's answer to a single question.
 * Format varies by question type.
 */
export interface UserAnswer {
  // MCQ
  selected_option?: string

  // Short answer / Essay
  text?: string
  word_count?: number

  // Matching
  matches?: Array<{ from: string; to: string }>

  // Ordering
  order?: string[]

  // Other
  [key: string]: unknown
}

/**
 * Interface: AttemptProgress
 * Per-question progress and answer tracking
 */
export interface AttemptProgress {
  id: string // UUID
  attempt_id: string // Reference to Attempt
  question_id: string // UUID of question
  user_answer?: UserAnswer // Student's answer (null if unanswered)
  answered_at?: Date // Server timestamp when answered
  flagged: boolean // Flagged for review by student
  created_at: Date
  updated_at: Date
}

/**
 * Interface: Attempt
 * Complete attempt record
 */
export interface Attempt {
  // Identification
  id: string
  workspace_id: string
  user_id: string
  attempt_type: AttemptType
  exam_id: string

  // Snapshots (immutable after creation)
  question_snapshot: QuestionSnapshotContainer
  question_order: string[] // Shuffled question IDs
  grading_config_snapshot: GradingConfigSnapshot
  mode: AttemptMode
  flags_snapshot: FlagsSnapshot
  time_limit_snapshot?: number // Seconds (null for RELAX mode)
  exam_version: string
  expected_schema_version: number
  expected_product_version: string

  // Timing
  started_at: Date // Server timestamp (authoritative)
  submitted_at?: Date
  finalized_at?: Date
  server_start_time: Date

  // Configuration
  certificate_enabled: boolean
  single_attempt_rule: boolean

  // Status
  status: AttemptStatus
  score?: number // 0-100 scale (null if not finalized)
  passed?: boolean // null if not finalized
  result_snapshot?: ResultSnapshot

  // Audit
  created_at: Date
  updated_at: Date
}

/**
 * Interface: QuestionResult
 * Grading result for a single question
 */
export interface QuestionResult {
  question_id: string
  user_answer?: UserAnswer // What student answered
  correct_answer: unknown // Correct answer
  points_earned: number // Points awarded
  points_possible: number // Points available
  feedback: string // "Correct!" or explanation
  explanation?: string // Detailed feedback
}

/**
 * Interface: ResultSnapshot
 * Complete grading result with breakdowns
 * Populated by worker after grading completes
 */
export interface ResultSnapshot {
  score: number // 0-100 scale
  passed: boolean // Pass/fail determination
  total_points: number // Maximum achievable (from config)
  pass_score: number // Passing threshold (percentage converted to points)
  question_results: QuestionResult[] // Per-question breakdown
  summary: string // "Congratulations!" or "Try again"
}

/**
 * Interface: SubmissionIdempotencyKey
 * Tracks submissions for deduplication
 */
export interface SubmissionIdempotencyKey {
  id: string
  workspace_id: string
  attempt_id: string
  submission_sequence: number
  idempotency_key: string
  request_timestamp: Date
  response_status: number // HTTP status
  response_body: Record<string, unknown> // Full response JSON
  created_at: Date
  expires_at: Date // TTL: 24 hours
}

/**
 * Interface: CreateAttemptRequest
 * API request body for POST /attempts
 */
export interface CreateAttemptRequest {
  exam_id: string // UUID of exam to attempt
  attempt_type?: AttemptType // Optional; defaults from exam config
}

/**
 * Interface: CreateAttemptResponse
 * API response for POST /attempts
 */
export interface CreateAttemptResponse {
  attempt_id: string
  exam_id: string
  status: AttemptStatus
  started_at: Date
  mode: AttemptMode
  time_limit_seconds?: number
  question_count: number
  questions: Array<{
    id: string
    text: string
    type: QuestionType
    options?: string[]
    points: number
  }>
}

/**
 * Interface: ProgressUpdateRequest
 * API request body for POST /attempts/:id/progress
 */
export interface ProgressUpdateRequest {
  responses: Array<{
    question_id: string
    user_answer: UserAnswer
    flagged?: boolean
  }>
}

/**
 * Interface: ProgressUpdateResponse
 * API response for POST /attempts/:id/progress
 */
export interface ProgressUpdateResponse {
  attempt_id: string
  responses_saved: number
  time_remaining_seconds?: number
}

/**
 * Interface: SubmissionRequest
 * API request body for POST /attempts/:id/submit
 */
export interface SubmissionRequest {
  submission_reason?: 'MANUAL_SUBMIT' | 'AUTO_TIMEOUT'
  idempotency_key?: string // Optional for retry safety
}

/**
 * Interface: SubmissionResponse
 * API response for POST /attempts/:id/submit
 */
export interface SubmissionResponse {
  attempt_id: string
  status: AttemptStatus
  submitted_at: Date
  message: string
}

/**
 * Interface: StatusResponse
 * API response for GET /attempts/:id
 */
export interface StatusResponse {
  attempt_id: string
  status: AttemptStatus
  progress?: {
    answered_count: number
    flagged_count: number
    total_questions: number
  }
  timing?: {
    started_at: Date
    time_limit_seconds?: number
    time_remaining_seconds?: number
    mode: AttemptMode
  }
  score?: number
  passed?: boolean
  submitted_at?: Date
  finalized_at?: Date
}

/**
 * Interface: ResultResponse
 * API response for GET /attempts/:id/result
 */
export interface ResultResponse {
  attempt_id: string
  score: number
  passed: boolean
  total_points: number
  pass_score: number
  summary: string
  question_results: QuestionResult[]
}

/**
 * Interface: GradingJob
 * Background job payload for worker
 */
export interface GradingJob {
  job_type: 'GRADE_ATTEMPT'
  attempt_id: string
  workspace_id: string
  submission_sequence: number
  idempotency_key: string
  correlation_id: string
  created_at: Date
}

/**
 * Interface: ErrorResponse
 * Standard error response (RFC 7807)
 */
export interface ErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
    status: number
    correlation_id: string
  }
}

/**
 * Interface: SuccessResponse<T>
 * Standard success response wrapper
 */
export interface SuccessResponse<T> {
  success: true
  data: T
  error: null
}

/**
 * Type: ApiResponse<T>
 * Union of success and error responses
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse
