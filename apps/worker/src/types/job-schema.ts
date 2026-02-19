/**
 * T043: Job schema definitions for worker queue
 *
 * Defines TypeScript interfaces for all job types processed by the worker
 */

/**
 * Base job schema - all jobs inherit from this
 */
export interface BaseJob {
  job_id: string
  type: string
  workspace_id: string
  workspace_slug: string
  user_id: string
  correlation_id: string
  created_at: string
  scheduled_for?: string // Optional: when job should execute
  retry_count: number
  max_retries: number
}

/**
 * Grade Attempt Job - main job type for grading student submissions
 */
export interface GradeAttemptJob extends BaseJob {
  type: 'grade_attempt'
  attempt_id: string
  attempt_snapshot: AttemptSnapshot
  submission_data: SubmissionData
}

/**
 * Attempt snapshot - immutable configuration at submission time
 */
export interface AttemptSnapshot {
  attempt_id: string
  exam_id: string
  user_id: string
  workspace_id: string
  question_list: Question[]
  grading_rules: GradingRules
  duration_minutes: number
  password_reset_enabled: boolean
  started_at: string
  deadline_at: string
}

/**
 * Question definition
 */
export interface Question {
  question_id: string
  type: 'multiple_choice' | 'short_answer' | 'essay'
  text: string
  points: number
  options?: QuestionOption[] // For multiple choice
  rubric?: AnswerRubric // For grading
}

/**
 * Multiple choice option
 */
export interface QuestionOption {
  option_id: string
  text: string
  is_correct?: boolean // Used for grading
}

/**
 * Answer rubric for grading
 */
export interface AnswerRubric {
  type: 'exact_match' | 'fuzzy_match' | 'keyword_match'
  expected_answer?: string
  keywords?: string[]
  confidence_threshold?: number // For fuzzy matching (0-1)
}

/**
 * Grading rules configuration
 */
export interface GradingRules {
  passing_score_percent: number // e.g., 70
  auto_grade_enabled: boolean
  feedback_template?: string // Optional: template for feedback generation
  show_answers_after_submission: boolean
  show_score_immediately: boolean
}

/**
 * Submitted answers from student
 */
export interface SubmissionData {
  submission_id: string
  submitted_at: string
  answers: StudentAnswer[]
  client_time_remaining_ms?: number // Client-reported time (not authoritative)
}

/**
 * Single student answer
 */
export interface StudentAnswer {
  question_id: string
  answer_text: string
  answer_options?: string[] // For multiple choice
  submission_sequence: number // At answer submission order
}

/**
 * Grading result - output of worker grading job
 */
export interface GradingResult {
  job_id: string
  attempt_id: string
  user_id: string
  workspace_id: string
  score: number // Raw score (sum of question points)
  max_score: number // Total possible points
  score_percent: number // Percentage 0-100
  passed: boolean // Based on passing_score_percent
  feedback: string
  graded_at: string
  question_results: QuestionResult[]
  processing_time_ms: number
}

/**
 * Individual question grading result
 */
export interface QuestionResult {
  question_id: string
  earned_points: number
  max_points: number
  is_correct: boolean
  feedback?: string
  grading_confidence?: number // 0-1 for AI-graded answers
}

/**
 * Job state - used internally by worker
 */
export enum JobState {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  DLQ = 'dlq', // Dead letter queue
}

/**
 * Job execution context - passed to job handlers
 */
export interface JobExecutionContext {
  job: GradeAttemptJob
  retryCount: number
  maxRetries: number
  startTime: number
  state: JobState
}

/**
 * Type guard for GradeAttemptJob
 */
export function isGradeAttemptJob(job: BaseJob): job is GradeAttemptJob {
  return job.type === 'grade_attempt' && 'attempt_id' in job
}

/**
 * Create grade attempt job
 */
export function createGradeAttemptJob(
  workspaceId: string,
  workspaceSlug: string,
  userId: string,
  correlationId: string,
  attemptId: string,
  attemptSnapshot: AttemptSnapshot,
  submissionData: SubmissionData,
  jobId?: string
): GradeAttemptJob {
  return {
    job_id: jobId || `grade-${attemptId}-${Date.now()}`,
    type: 'grade_attempt',
    workspace_id: workspaceId,
    workspace_slug: workspaceSlug,
    user_id: userId,
    correlation_id: correlationId,
    created_at: new Date().toISOString(),
    retry_count: 0,
    max_retries: 5,
    attempt_id: attemptId,
    attempt_snapshot: attemptSnapshot,
    submission_data: submissionData,
  }
}

/**
 * Validate job structure
 */
export function validateJob(job: unknown): job is BaseJob {
  if (typeof job !== 'object' || job === null) {
    return false
  }

  const j = job as Record<string, unknown>

  return (
    typeof j.job_id === 'string' &&
    typeof j.type === 'string' &&
    typeof j.workspace_id === 'string' &&
    typeof j.workspace_slug === 'string' &&
    typeof j.user_id === 'string' &&
    typeof j.correlation_id === 'string' &&
    typeof j.created_at === 'string' &&
    typeof j.retry_count === 'number' &&
    typeof j.max_retries === 'number'
  )
}
