/**
 * Zidney Types Package
 *
 * Re-exports all type definitions for use across the monorepo.
 */

export * from './api-response'
// Explicitly re-export from attempt to avoid ErrorResponse conflict with api-response
export {
  type ApiResponse,
  type Attempt,
  AttemptMode,
  type AttemptProgress,
  AttemptStatus,
  AttemptType,
  type CreateAttemptRequest,
  type CreateAttemptResponse,
  // Rename attempt's ErrorResponse to avoid conflict
  type ErrorResponse as AttemptErrorResponse,
  type FlagsSnapshot,
  type GradingConfigSnapshot,
  type GradingJob,
  type ProgressUpdateRequest,
  type ProgressUpdateResponse,
  type QuestionResult,
  type QuestionSnapshot,
  type QuestionSnapshotContainer,
  QuestionType,
  type ResultResponse,
  type ResultSnapshot,
  type StatusResponse,
  type SubmissionIdempotencyKey,
  type SubmissionRequest,
  type SubmissionResponse,
  type SuccessResponse,
  type UserAnswer,
} from './attempt'
export * from './env-config'
export * from './error-codes'
export * from './job-envelope'
export * from './master-db'
export * from './master-db-utils'
export * from './migration'
export * from './mmc.types'
export * from './rbac'
export * from './tenant-rbac'
