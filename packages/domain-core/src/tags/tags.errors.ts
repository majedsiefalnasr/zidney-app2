/**
 * Tags — Error Definitions
 *
 * File: packages/domain-core/src/tags/tags.errors.ts
 * Stage: STAGE_32_TAGS
 *
 * Domain-specific error class, HTTP status mapping, and error messages.
 * No imports from apps/* — pure domain errors only.
 */

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

export type TagErrorCode =
  | 'FORBIDDEN'
  | 'TAG_NOT_FOUND'
  | 'TAG_DUPLICATE'
  | 'TAG_HAS_RELATIONS'
  | 'TAG_DISABLED'
  | 'TAG_RELATION_NOT_FOUND'
  | 'TAG_RELATION_DUPLICATE'
  | 'TAG_RELATION_INVALID_ENTITY_TYPE'
  | 'TAG_RELATION_ENTITY_NOT_FOUND'
  | 'VALIDATION_ERROR'

// ---------------------------------------------------------------------------
// HTTP Status Map
// ---------------------------------------------------------------------------

export const TAG_ERROR_HTTP_STATUS: Record<TagErrorCode, number> = {
  FORBIDDEN: 403,
  TAG_NOT_FOUND: 404,
  TAG_RELATION_NOT_FOUND: 404,
  TAG_DUPLICATE: 409,
  TAG_RELATION_DUPLICATE: 409,
  TAG_HAS_RELATIONS: 422,
  TAG_DISABLED: 422,
  TAG_RELATION_INVALID_ENTITY_TYPE: 422,
  TAG_RELATION_ENTITY_NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
}

// ---------------------------------------------------------------------------
// Error Messages
// ---------------------------------------------------------------------------

export const TAG_ERROR_MESSAGES: Record<TagErrorCode, string> = {
  FORBIDDEN: 'You do not have permission to perform this action.',
  TAG_NOT_FOUND: 'Tag not found.',
  TAG_DUPLICATE: 'A tag with this name already exists.',
  TAG_HAS_RELATIONS: 'Tag cannot be deleted because it is assigned to one or more entities.',
  TAG_DISABLED: 'Tag is disabled and cannot be assigned to entities.',
  TAG_RELATION_NOT_FOUND: 'Tag relation not found.',
  TAG_RELATION_DUPLICATE: 'This tag is already assigned to the specified entity.',
  TAG_RELATION_INVALID_ENTITY_TYPE:
    'Invalid entity type. Allowed values: MCQ_QUESTION, TRADITIONAL_QUESTION, LIBRARY_FILE.',
  TAG_RELATION_ENTITY_NOT_FOUND: 'The specified entity does not exist.',
  VALIDATION_ERROR: 'Request validation failed.',
}

// ---------------------------------------------------------------------------
// Error Class
// ---------------------------------------------------------------------------

export class TagError extends Error {
  readonly code: TagErrorCode

  constructor(code: TagErrorCode, message?: string) {
    super(message ?? TAG_ERROR_MESSAGES[code])
    this.name = 'TagError'
    this.code = code
  }
}
