/**
 * Groups Domain — Custom Errors
 *
 * File: packages/domain-core/src/groups/groups.errors.ts
 * Stage: STAGE_24_GROUPS
 * Date: 2026-03-19
 *
 * Defines GroupsError class and all error codes for the groups domain.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure domain error definitions
 * ✓ No framework dependencies beyond basic TypeScript
 * ✓ Structured error codes for client-consumable responses
 */

// ---------------------------------------------------------------------------
// Error Code Union Type
// ---------------------------------------------------------------------------

export type GroupsErrorCode =
  | 'GROUP_NOT_FOUND' // 404
  | 'STUDENT_NOT_FOUND' // 404
  | 'STAFF_NOT_FOUND' // 404
  | 'GROUP_STUDENT_ASSIGNMENT_NOT_FOUND' // 404
  | 'GROUP_STAFF_ASSIGNMENT_NOT_FOUND' // 404
  | 'GROUP_NAME_DUPLICATE' // 409
  | 'GROUP_DIVISION_MISMATCH' // 422
  | 'GROUP_HAS_ASSIGNMENTS' // 422
  | 'GROUP_REFERENCED_BY_EXAM' // 422
  | 'GROUP_REFERENCED_BY_ADS' // 422
  | 'GROUP_MAX_MEMBERS_EXCEEDED' // 422
  | 'GROUP_DISABLED' // 422
  | 'VALIDATION_ERROR' // 422

// ---------------------------------------------------------------------------
// HTTP Status Mapping
// ---------------------------------------------------------------------------

/** HTTP status code for each GroupsErrorCode. */
export const GROUPS_ERROR_HTTP_STATUS: Record<GroupsErrorCode, number> = {
  GROUP_NOT_FOUND: 404,
  STUDENT_NOT_FOUND: 404,
  STAFF_NOT_FOUND: 404,
  GROUP_STUDENT_ASSIGNMENT_NOT_FOUND: 404,
  GROUP_STAFF_ASSIGNMENT_NOT_FOUND: 404,
  GROUP_NAME_DUPLICATE: 409,
  GROUP_DIVISION_MISMATCH: 422,
  GROUP_HAS_ASSIGNMENTS: 422,
  GROUP_REFERENCED_BY_EXAM: 422,
  GROUP_REFERENCED_BY_ADS: 422,
  GROUP_MAX_MEMBERS_EXCEEDED: 422,
  GROUP_DISABLED: 422,
  VALIDATION_ERROR: 422,
}

// ---------------------------------------------------------------------------
// Default Messages
// ---------------------------------------------------------------------------

/** Human-readable default message for each GroupsErrorCode. */
export const GROUPS_ERROR_MESSAGES: Record<GroupsErrorCode, string> = {
  GROUP_NOT_FOUND: 'Group not found.',
  STUDENT_NOT_FOUND: 'Student not found.',
  STAFF_NOT_FOUND: 'Staff member not found.',
  GROUP_STUDENT_ASSIGNMENT_NOT_FOUND: 'Student is not assigned to this group.',
  GROUP_STAFF_ASSIGNMENT_NOT_FOUND: 'Staff is not assigned to this group.',
  GROUP_NAME_DUPLICATE: 'A group with this name already exists.',
  GROUP_DIVISION_MISMATCH: 'The group belongs to a different division.',
  GROUP_HAS_ASSIGNMENTS: 'Group has active assignments and cannot be deleted.',
  GROUP_REFERENCED_BY_EXAM: 'Group is referenced by one or more exams and cannot be deleted.',
  GROUP_REFERENCED_BY_ADS: 'Group is referenced by one or more ad campaigns and cannot be deleted.',
  GROUP_MAX_MEMBERS_EXCEEDED: 'Group has reached its maximum member capacity.',
  GROUP_DISABLED: 'Group is disabled and not accepting new assignments.',
  VALIDATION_ERROR: 'Request validation failed.',
}

// ---------------------------------------------------------------------------
// GroupsError Class
// ---------------------------------------------------------------------------

/**
 * Custom error class for all group domain operations.
 * Provides structured error codes, HTTP status codes, and messages.
 */
export class GroupsError extends Error {
  constructor(
    public code: GroupsErrorCode,
    public message: string = GROUPS_ERROR_MESSAGES[code],
    public httpStatus: number = GROUPS_ERROR_HTTP_STATUS[code]
  ) {
    super(message)
    this.name = 'GroupsError'
  }
}
