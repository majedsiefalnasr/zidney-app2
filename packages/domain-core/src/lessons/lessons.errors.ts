/**
 * Lessons Domain — Error Catalog
 *
 * File: packages/domain-core/src/lessons/lessons.errors.ts
 * Stage: STAGE_29_LESSONS
 *
 * 8 domain-owned error codes with HTTP status mappings and human-readable messages.
 * Route handlers convert LessonError instances to JSON using the HTTP status map.
 */

// ---------------------------------------------------------------------------
// Error code union
// ---------------------------------------------------------------------------

export type LessonErrorCode =
  | 'LESSON_NOT_FOUND'
  | 'LESSON_SUBJECT_NOT_FOUND'
  | 'LESSON_NAME_DUPLICATE'
  | 'LESSON_DISABLED'
  | 'LESSON_ALREADY_DISABLED'
  | 'LESSON_ALREADY_ENABLED'
  | 'LESSON_HAS_DEPENDENT_CONTENT'
  | 'VALIDATION_ERROR'

// ---------------------------------------------------------------------------
// HTTP status map
// ---------------------------------------------------------------------------

export const LESSON_ERROR_HTTP_STATUS: Record<LessonErrorCode, number> = {
  LESSON_NOT_FOUND: 404,
  LESSON_SUBJECT_NOT_FOUND: 404,
  LESSON_NAME_DUPLICATE: 409,
  LESSON_DISABLED: 422,
  LESSON_ALREADY_DISABLED: 422,
  LESSON_ALREADY_ENABLED: 422,
  LESSON_HAS_DEPENDENT_CONTENT: 409,
  VALIDATION_ERROR: 422,
}

// ---------------------------------------------------------------------------
// Human-readable messages
// ---------------------------------------------------------------------------

export const LESSON_ERROR_MESSAGES: Record<LessonErrorCode, string> = {
  LESSON_NOT_FOUND: 'Lesson not found.',
  LESSON_SUBJECT_NOT_FOUND: 'Subject not found.',
  LESSON_NAME_DUPLICATE: 'A lesson with this name already exists in this subject.',
  LESSON_DISABLED: 'Lesson is disabled. Re-enable it before editing other fields.',
  LESSON_ALREADY_DISABLED: 'Lesson is already disabled.',
  LESSON_ALREADY_ENABLED: 'Lesson is already enabled.',
  LESSON_HAS_DEPENDENT_CONTENT: 'Lesson has dependent content and cannot be deleted.',
  VALIDATION_ERROR: 'Invalid request data.',
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class LessonError extends Error {
  constructor(
    public readonly code: LessonErrorCode,
    message?: string
  ) {
    super(message ?? LESSON_ERROR_MESSAGES[code])
    this.name = 'LessonError'
  }
}
