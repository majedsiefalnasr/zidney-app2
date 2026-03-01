/**
 * Translatable Fields & Translation Errors — Unit Tests
 *
 * File: tests/unit/translation/translatable-fields.test.ts
 * Stage: 019_TRANSLATION_SYSTEM
 * Date: 2026-03-01
 *
 * Tests registry constants, helper functions, TranslationError class, and factory functions.
 */

import { describe, expect, it } from 'vitest'

import {
  TRANSLATABLE_FIELDS,
  getTranslatableFields,
  isTranslatableEntityType,
} from '../../../packages/domain-core/src/translation/translatable-fields'

import {
  TRANSLATION_ERROR_CODES,
  TRANSLATION_ERROR_HTTP_STATUS,
  TranslationError,
  batchValidationFailed,
  defaultLanguageWrite,
  entityNotFound,
  invalidFieldName,
  languageRemovalRequiresAsync,
  unknownEntityType,
  unsupportedLanguage,
} from '../../../packages/domain-core/src/translation/translation.errors'

// ---------------------------------------------------------------------------
// TRANSLATABLE_FIELDS registry
// ---------------------------------------------------------------------------

describe('TRANSLATABLE_FIELDS registry', () => {
  it('registers subject with title and description', () => {
    expect(TRANSLATABLE_FIELDS.subject).toContain('title')
    expect(TRANSLATABLE_FIELDS.subject).toContain('description')
  })

  it('registers category with name and description', () => {
    expect(TRANSLATABLE_FIELDS.category).toContain('name')
    expect(TRANSLATABLE_FIELDS.category).toContain('description')
  })

  it('registers question with text and explanation', () => {
    expect(TRANSLATABLE_FIELDS.question).toContain('text')
    expect(TRANSLATABLE_FIELDS.question).toContain('explanation')
  })

  it('registers exam with title, description, and instructions', () => {
    expect(TRANSLATABLE_FIELDS.exam).toContain('title')
    expect(TRANSLATABLE_FIELDS.exam).toContain('description')
    expect(TRANSLATABLE_FIELDS.exam).toContain('instructions')
  })

  it('has exactly 4 registered entity types', () => {
    expect(Object.keys(TRANSLATABLE_FIELDS)).toHaveLength(4)
  })
})

// ---------------------------------------------------------------------------
// isTranslatableEntityType
// ---------------------------------------------------------------------------

describe('isTranslatableEntityType', () => {
  it('returns true for registered entity types', () => {
    expect(isTranslatableEntityType('subject')).toBe(true)
    expect(isTranslatableEntityType('category')).toBe(true)
    expect(isTranslatableEntityType('question')).toBe(true)
    expect(isTranslatableEntityType('exam')).toBe(true)
  })

  it('returns false for unregistered entity types', () => {
    expect(isTranslatableEntityType('unknown_type')).toBe(false)
    expect(isTranslatableEntityType('')).toBe(false)
    expect(isTranslatableEntityType('QUESTION')).toBe(false) // Case-sensitive
    expect(isTranslatableEntityType('student')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getTranslatableFields
// ---------------------------------------------------------------------------

describe('getTranslatableFields', () => {
  it('returns fields array for known entity types', () => {
    const fields = getTranslatableFields('question')
    expect(fields).toContain('text')
    expect(fields).toContain('explanation')
    expect(fields.length).toBeGreaterThan(0)
  })

  it('returns empty array for unknown entity types (safe call)', () => {
    const fields = getTranslatableFields('unknown_entity')
    expect(fields).toEqual([])
  })

  it('returns empty array for empty string', () => {
    const fields = getTranslatableFields('')
    expect(fields).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// TRANSLATION_ERROR_CODES
// ---------------------------------------------------------------------------

describe('TRANSLATION_ERROR_CODES', () => {
  it('defines all required error codes', () => {
    expect(TRANSLATION_ERROR_CODES.UNSUPPORTED_LANGUAGE).toBe(
      'UNSUPPORTED_LANGUAGE'
    )
    expect(TRANSLATION_ERROR_CODES.DEFAULT_LANGUAGE_WRITE).toBe(
      'DEFAULT_LANGUAGE_WRITE'
    )
    expect(TRANSLATION_ERROR_CODES.ENTITY_NOT_FOUND).toBe('ENTITY_NOT_FOUND')
    expect(TRANSLATION_ERROR_CODES.INVALID_FIELD_NAME).toBe(
      'INVALID_FIELD_NAME'
    )
    expect(TRANSLATION_ERROR_CODES.UNKNOWN_ENTITY_TYPE).toBe(
      'UNKNOWN_ENTITY_TYPE'
    )
    expect(TRANSLATION_ERROR_CODES.BATCH_VALIDATION_FAILED).toBe(
      'BATCH_VALIDATION_FAILED'
    )
    expect(TRANSLATION_ERROR_CODES.LANGUAGE_REMOVAL_REQUIRES_ASYNC).toBe(
      'LANGUAGE_REMOVAL_REQUIRES_ASYNC'
    )
  })
})

// ---------------------------------------------------------------------------
// TRANSLATION_ERROR_HTTP_STATUS
// ---------------------------------------------------------------------------

describe('TRANSLATION_ERROR_HTTP_STATUS', () => {
  it('maps to correct HTTP status codes', () => {
    expect(TRANSLATION_ERROR_HTTP_STATUS.UNSUPPORTED_LANGUAGE).toBe(422)
    expect(TRANSLATION_ERROR_HTTP_STATUS.DEFAULT_LANGUAGE_WRITE).toBe(422)
    expect(TRANSLATION_ERROR_HTTP_STATUS.ENTITY_NOT_FOUND).toBe(404)
    expect(TRANSLATION_ERROR_HTTP_STATUS.INVALID_FIELD_NAME).toBe(422)
    expect(TRANSLATION_ERROR_HTTP_STATUS.UNKNOWN_ENTITY_TYPE).toBe(422)
    expect(TRANSLATION_ERROR_HTTP_STATUS.BATCH_VALIDATION_FAILED).toBe(422)
    expect(TRANSLATION_ERROR_HTTP_STATUS.LANGUAGE_REMOVAL_REQUIRES_ASYNC).toBe(
      409
    )
  })
})

// ---------------------------------------------------------------------------
// TranslationError class
// ---------------------------------------------------------------------------

describe('TranslationError', () => {
  it('is instanceof Error', () => {
    const err = new TranslationError('ENTITY_NOT_FOUND', 'Not found')
    expect(err instanceof Error).toBe(true)
  })

  it('is instanceof TranslationError', () => {
    const err = new TranslationError('ENTITY_NOT_FOUND', 'Not found')
    expect(err instanceof TranslationError).toBe(true)
  })

  it('sets name to TranslationError', () => {
    const err = new TranslationError('ENTITY_NOT_FOUND', 'Not found')
    expect(err.name).toBe('TranslationError')
  })

  it('stores correct code and message', () => {
    const err = new TranslationError(
      'UNSUPPORTED_LANGUAGE',
      "Language 'es' not supported"
    )
    expect(err.code).toBe('UNSUPPORTED_LANGUAGE')
    expect(err.message).toBe("Language 'es' not supported")
  })

  it('stores correct httpStatus from mapping', () => {
    const err = new TranslationError('ENTITY_NOT_FOUND', 'msg')
    expect(err.httpStatus).toBe(404)
  })

  it('toResponseBody returns platform-standard shape', () => {
    const err = new TranslationError('INVALID_FIELD_NAME', 'Bad field')
    const body = err.toResponseBody()

    expect(body.success).toBe(false)
    expect(body.data).toBeNull()
    expect(body.error.code).toBe('INVALID_FIELD_NAME')
    expect(body.error.message).toBe('Bad field')
  })
})

// ---------------------------------------------------------------------------
// Factory functions
// ---------------------------------------------------------------------------

describe('unsupportedLanguage', () => {
  it('creates error with UNSUPPORTED_LANGUAGE code and HTTP 422', () => {
    const err = unsupportedLanguage('de')
    expect(err.code).toBe('UNSUPPORTED_LANGUAGE')
    expect(err.httpStatus).toBe(422)
    expect(err.message).toContain('de')
  })
})

describe('defaultLanguageWrite', () => {
  it('creates error with DEFAULT_LANGUAGE_WRITE code and HTTP 422', () => {
    const err = defaultLanguageWrite('en')
    expect(err.code).toBe('DEFAULT_LANGUAGE_WRITE')
    expect(err.httpStatus).toBe(422)
    expect(err.message).toContain('en')
  })
})

describe('entityNotFound', () => {
  it('creates error with ENTITY_NOT_FOUND code, HTTP 404, and includes type+id in message', () => {
    const err = entityNotFound('question', 'q-001')
    expect(err.code).toBe('ENTITY_NOT_FOUND')
    expect(err.httpStatus).toBe(404)
    expect(err.message).toContain('question')
    expect(err.message).toContain('q-001')
  })
})

describe('invalidFieldName', () => {
  it('creates error with INVALID_FIELD_NAME code, HTTP 422, and includes field+type in message', () => {
    const err = invalidFieldName('score', 'question')
    expect(err.code).toBe('INVALID_FIELD_NAME')
    expect(err.httpStatus).toBe(422)
    expect(err.message).toContain('score')
    expect(err.message).toContain('question')
  })
})

describe('unknownEntityType', () => {
  it('creates error with UNKNOWN_ENTITY_TYPE code, HTTP 422', () => {
    const err = unknownEntityType('foo_type')
    expect(err.code).toBe('UNKNOWN_ENTITY_TYPE')
    expect(err.httpStatus).toBe(422)
    expect(err.message).toContain('foo_type')
  })
})

describe('batchValidationFailed', () => {
  it('creates error with BATCH_VALIDATION_FAILED code, HTTP 422', () => {
    const err = batchValidationFailed('item[2].language_code is invalid')
    expect(err.code).toBe('BATCH_VALIDATION_FAILED')
    expect(err.httpStatus).toBe(422)
    expect(err.message).toContain('item[2].language_code is invalid')
  })
})

describe('languageRemovalRequiresAsync', () => {
  it('creates error with LANGUAGE_REMOVAL_REQUIRES_ASYNC code, HTTP 409', () => {
    const err = languageRemovalRequiresAsync('ar')
    expect(err.code).toBe('LANGUAGE_REMOVAL_REQUIRES_ASYNC')
    expect(err.httpStatus).toBe(409)
    expect(err.message).toContain('ar')
    expect(err.message).toContain('10,000')
  })
})
