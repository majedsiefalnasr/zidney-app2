/**
 * Translation System — Error Classes and Constants
 *
 * File: packages/domain-core/src/translation/translation.errors.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * TranslationError class and typed error code constants.
 * All errors produce the platform-standard response shape:
 *   { success: false, data: null, error: { code, message } }
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure error definitions
 * ✓ No DB imports
 * ✓ No framework dependencies
 */

// ---------------------------------------------------------------------------
// Error Code Constants
// ---------------------------------------------------------------------------

/** Error codes keyed by logical name */
export const TRANSLATION_ERROR_CODES = {
  UNSUPPORTED_LANGUAGE: 'UNSUPPORTED_LANGUAGE',
  DEFAULT_LANGUAGE_WRITE: 'DEFAULT_LANGUAGE_WRITE',
  ENTITY_NOT_FOUND: 'ENTITY_NOT_FOUND',
  INVALID_FIELD_NAME: 'INVALID_FIELD_NAME',
  UNKNOWN_ENTITY_TYPE: 'UNKNOWN_ENTITY_TYPE',
  BATCH_VALIDATION_FAILED: 'BATCH_VALIDATION_FAILED',
  LANGUAGE_REMOVAL_REQUIRES_ASYNC: 'LANGUAGE_REMOVAL_REQUIRES_ASYNC',
} as const

/** Union of all valid translation error code strings */
export type TranslationErrorCode =
  (typeof TRANSLATION_ERROR_CODES)[keyof typeof TRANSLATION_ERROR_CODES]

/** HTTP status code mapping per error code */
export const TRANSLATION_ERROR_HTTP_STATUS: Record<TranslationErrorCode, number> = {
  UNSUPPORTED_LANGUAGE: 422,
  DEFAULT_LANGUAGE_WRITE: 422,
  ENTITY_NOT_FOUND: 404,
  INVALID_FIELD_NAME: 422,
  UNKNOWN_ENTITY_TYPE: 422,
  BATCH_VALIDATION_FAILED: 422,
  LANGUAGE_REMOVAL_REQUIRES_ASYNC: 409,
}

// ---------------------------------------------------------------------------
// TranslationError Class
// ---------------------------------------------------------------------------

/**
 * Domain error class for all translation operation failures.
 *
 * Usage:
 *   throw new TranslationError('UNSUPPORTED_LANGUAGE', "Language 'es' is not in the workspace supported languages.")
 *
 * Route handlers catch this and return the appropriate HTTP status + error body.
 */
export class TranslationError extends Error {
  /** Machine-readable error code */
  readonly code: TranslationErrorCode
  /** HTTP status code associated with this error */
  readonly httpStatus: number

  constructor(code: TranslationErrorCode, message: string) {
    super(message)
    this.name = 'TranslationError'
    this.code = code
    this.httpStatus = TRANSLATION_ERROR_HTTP_STATUS[code]
    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, TranslationError.prototype)
  }

  /**
   * Returns the platform-standard error response shape.
   */
  toResponseBody(): {
    success: false
    data: null
    error: { code: string; message: string }
  } {
    return {
      success: false,
      data: null,
      error: {
        code: this.code,
        message: this.message,
      },
    }
  }
}

// ---------------------------------------------------------------------------
// Convenience Factory Functions
// ---------------------------------------------------------------------------

/** Language not in workspace supported_languages or status='removing' (422) */
export function unsupportedLanguage(languageCode: string): TranslationError {
  return new TranslationError(
    'UNSUPPORTED_LANGUAGE',
    `Language '${languageCode}' is not in the workspace supported languages.`
  )
}

/** Attempt to write translation for the workspace default language (422) */
export function defaultLanguageWrite(languageCode: string): TranslationError {
  return new TranslationError(
    'DEFAULT_LANGUAGE_WRITE',
    `Cannot store translations for the workspace default language '${languageCode}'. Default language content lives in base entity tables.`
  )
}

/** Entity not found in tenant DB (404) */
export function entityNotFound(entityType: string, entityId: string): TranslationError {
  return new TranslationError(
    'ENTITY_NOT_FOUND',
    `Entity of type '${entityType}' with id '${entityId}' was not found.`
  )
}

/** Field name not valid for entity type (422) */
export function invalidFieldName(fieldName: string, entityType: string): TranslationError {
  return new TranslationError(
    'INVALID_FIELD_NAME',
    `Field '${fieldName}' is not a translatable field for entity type '${entityType}'.`
  )
}

/** Entity type not registered in TRANSLATABLE_FIELDS (422) */
export function unknownEntityType(entityType: string): TranslationError {
  return new TranslationError(
    'UNKNOWN_ENTITY_TYPE',
    `Entity type '${entityType}' is not a registered translatable entity type.`
  )
}

/** Batch item failed Zod validation (422) */
export function batchValidationFailed(detail: string): TranslationError {
  return new TranslationError('BATCH_VALIDATION_FAILED', `Batch validation failed: ${detail}`)
}

/** Row count exceeds 10,000 sync threshold — async drain required (409) */
export function languageRemovalRequiresAsync(languageCode: string): TranslationError {
  return new TranslationError(
    'LANGUAGE_REMOVAL_REQUIRES_ASYNC',
    `Language '${languageCode}' has more than 10,000 translation rows and must be removed asynchronously. A drain job has been enqueued.`
  )
}
