/**
 * Job Envelope Types - Defines the structure for all queued jobs.
 *
 * Job envelope provides:
 * - Dual ID tracking: request_id (from API) + job_id (per job execution)
 * - Payload hashing: SHA256 for integrity verification
 * - Retry tracking: retry_count for observability
 * - Workspace isolation: workspace_id for multi-tenancy
 *
 * Per clarification Q3: Each job receives unique job_id while inheriting request_id from API context.
 * Per clarification Q5: Payload hash computed at enqueue, verified at dequeue for config mutation detection.
 */

/**
 * Base job envelope structure (generic over payload type T).
 * All jobs in the queue follow this envelope format for consistency.
 */
export interface JobEnvelope<T = any> {
  /**
   * Unique identifier for this job execution.
   * Generated at enqueue time (UUID-v4).
   * Per clarification Q3: job_id ≠ request_id (separate tracking IDs)
   */
  job_id: string

  /**
   * Request ID inherited from API request context.
   * Enables end-to-end request tracing: API → Worker → Completion.
   * Propagated through entire job lifecycle.
   */
  request_id: string

  /**
   * Workspace UUID for multi-tenancy isolation.
   * Ensures jobs cannot access cross-tenant data.
   */
  workspace_id: string

  /**
   * User ID associated with job (optional).
   * Set if job was triggered by user action; null for system jobs.
   */
  user_id?: string

  /**
   * Job name/type identifier (enum-like).
   * Examples: 'finalize_attempt', 'generate_certificate', 'send_email'
   */
  job_name: string

  /**
   * Attempt ID (optional, for attempt-specific jobs).
   * Links job to specific attempt for traceability.
   */
  attempt_id?: string

  /**
   * Job-specific payload (custom per job type).
   * Generic T allows type-safe payload access.
   */
  payload: T

  /**
   * SHA256 hash of payload at enqueue time.
   * Per clarification Q5: Used for config mutation detection on dequeue.
   * If recomputed hash differs, payload was mutated (logged but non-blocking).
   */
  payload_hash: string

  /**
   * Retry counter (incremented on each retry).
   * Tracks how many times job has been attempted.
   */
  retry_count: number

  /**
   * Maximum retry attempts before dead-lettering.
   * Job-specific constraint (e.g., 3, 5, unlimited).
   */
  max_retries: number

  /**
   * Job creation timestamp (server-authoritative).
   * ISO8601 format (e.g., "2026-02-18T14:32:00.000Z")
   * Set at enqueue time, never updated.
   */
  created_at: string

  /**
   * Job processing start timestamp (optional).
   * ISO8601 format.
   * Set when worker picks up job, undefined until processing starts.
   */
  processing_started_at?: string

  /**
   * Job completion/failure timestamp (optional).
   * ISO8601 format.
   * Set when job finishes (success or final failure).
   */
  completed_at?: string

  /**
   * Job final status (optional).
   * 'SUCCESS' | 'FAILED' | 'DEAD_LETTERED'
   */
  status?: 'SUCCESS' | 'FAILED' | 'DEAD_LETTERED'

  /**
   * Error message if job failed (optional).
   */
  error?: {
    code: string
    message: string
    attempt_number?: number
  }
}

/**
 * Specific job type: Finalize Attempt (grading).
 * Payload contains attempt identifiers for grading worker.
 */
export interface GradeAttemptJob extends JobEnvelope<GradeAttemptPayload> {
  job_name: 'finalize_attempt'
  attempt_id: string // Required for attempt-specific jobs
}

export interface GradeAttemptPayload {
  attempt_id: string
  exam_id: string
  student_id: string
  submission_data?: Record<string, any>
}

/**
 * Specific job type: Generate Certificate.
 * Payload contains certificate generation parameters.
 */
export interface GenerateCertificateJob extends JobEnvelope<GenerateCertificatePayload> {
  job_name: 'generate_certificate'
  attempt_id: string
}

export interface GenerateCertificatePayload {
  attempt_id: string
  student_id: string
  exam_id: string
  certificate_template?: string
}

/**
 * Specific job type: Send Email Notification.
 * Payload contains email parameters.
 */
export interface SendEmailJob extends JobEnvelope<SendEmailPayload> {
  job_name: 'send_email'
}

export interface SendEmailPayload {
  template: string
  recipient: string
  context: Record<string, any>
  retry_limit?: number
}

/**
 * Type guard to check if job is a GradeAttemptJob.
 */
export function isGradeAttemptJob(job: JobEnvelope): job is GradeAttemptJob {
  return job.job_name === 'finalize_attempt' && !!job.attempt_id
}

/**
 * Type guard to check if job is a GenerateCertificateJob.
 */
export function isGenerateCertificateJob(
  job: JobEnvelope
): job is GenerateCertificateJob {
  return job.job_name === 'generate_certificate' && !!job.attempt_id
}

/**
 * Type guard to check if job is a SendEmailJob.
 */
export function isSendEmailJob(job: JobEnvelope): job is SendEmailJob {
  return job.job_name === 'send_email'
}
