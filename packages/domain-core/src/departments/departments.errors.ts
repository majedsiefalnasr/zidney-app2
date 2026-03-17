/**
 * Departments Domain — Custom Errors
 *
 * File: packages/domain-core/src/departments/departments.errors.ts
 * Stage: STAGE_23_DEPARTMENTS
 * Date: 2026-03-17
 *
 * Defines DepartmentsError class and all error codes for the departments domain.
 *
 * Constitutional Compliance:
 * ✓ No HTTP logic — pure domain error definitions
 * ✓ No framework dependencies beyond basic TypeScript
 * ✓ Structured error codes for client-consumable responses
 */

// ---------------------------------------------------------------------------
// Error Code Union Type
// ---------------------------------------------------------------------------

export type DepartmentsErrorCode =
  | 'DEPARTMENT_NOT_FOUND' // 404
  | 'DEPT_STAFF_ASSIGNMENT_NOT_FOUND' // 404
  | 'DEPARTMENT_NAME_DUPLICATE' // 409
  | 'DEPARTMENT_CIRCULAR_REFERENCE' // 422
  | 'DEPARTMENT_DIVISION_MISMATCH' // 422
  | 'DEPARTMENT_HAS_CHILDREN' // 422
  | 'DEPARTMENT_HAS_ASSIGNMENTS' // 422
  | 'DEPARTMENT_MAX_USERS_EXCEEDED' // 422
  | 'DEPARTMENT_DISABLED' // 422
  | 'VALIDATION_ERROR' // 422

// ---------------------------------------------------------------------------
// HTTP Status Mapping
// ---------------------------------------------------------------------------

/** HTTP status code for each DepartmentsErrorCode. */
export const DEPARTMENTS_ERROR_HTTP_STATUS: Record<DepartmentsErrorCode, number> = {
  DEPARTMENT_NOT_FOUND: 404,
  DEPT_STAFF_ASSIGNMENT_NOT_FOUND: 404,
  DEPARTMENT_NAME_DUPLICATE: 409,
  DEPARTMENT_CIRCULAR_REFERENCE: 422,
  DEPARTMENT_DIVISION_MISMATCH: 422,
  DEPARTMENT_HAS_CHILDREN: 422,
  DEPARTMENT_HAS_ASSIGNMENTS: 422,
  DEPARTMENT_MAX_USERS_EXCEEDED: 422,
  DEPARTMENT_DISABLED: 422,
  VALIDATION_ERROR: 422,
}

// ---------------------------------------------------------------------------
// Default Messages
// ---------------------------------------------------------------------------

/** Human-readable default message for each DepartmentsErrorCode. */
export const DEPARTMENTS_ERROR_MESSAGES: Record<DepartmentsErrorCode, string> = {
  DEPARTMENT_NOT_FOUND: 'Department not found.',
  DEPT_STAFF_ASSIGNMENT_NOT_FOUND: 'Staff department assignment not found.',
  DEPARTMENT_NAME_DUPLICATE: 'A department with this name already exists in this location.',
  DEPARTMENT_CIRCULAR_REFERENCE: 'Cannot create a circular department hierarchy.',
  DEPARTMENT_DIVISION_MISMATCH: 'Department division assignment is inconsistent.',
  DEPARTMENT_HAS_CHILDREN: 'Department has children and cannot be deleted.',
  DEPARTMENT_HAS_ASSIGNMENTS: 'Department has active assignments and cannot be deleted.',
  DEPARTMENT_MAX_USERS_EXCEEDED: 'Department has reached its maximum capacity.',
  DEPARTMENT_DISABLED: 'Department is disabled and not accepting new assignments.',
  VALIDATION_ERROR: 'Request validation failed.',
}

// ---------------------------------------------------------------------------
// DepartmentsError Class
// ---------------------------------------------------------------------------

/**
 * Custom error class for all department domain operations.
 * Provides structured error codes, HTTP status codes, and messages.
 */
export class DepartmentsError extends Error {
  constructor(
    public code: DepartmentsErrorCode,
    public message: string = DEPARTMENTS_ERROR_MESSAGES[code],
    public httpStatus: number = DEPARTMENTS_ERROR_HTTP_STATUS[code]
  ) {
    super(message)
    this.name = 'DepartmentsError'
  }
}
