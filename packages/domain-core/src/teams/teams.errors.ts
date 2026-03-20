/**
 * Teams Domain — Error Codes, HTTP Status Mapping, and Error Class
 *
 * File: packages/domain-core/src/teams/teams.errors.ts
 * Stage: STAGE_26_TEAMS
 * Date: 2026-03-19
 *
 * Constitutional Compliance:
 * ✓ No HTTP framework imports — HTTP status codes are plain numbers
 * ✓ No framework dependencies
 * ✓ Structured error class with typed error codes
 */

// ---------------------------------------------------------------------------
// Error codes
// ---------------------------------------------------------------------------

export type TeamsErrorCode =
  | 'TEAM_TYPE_NOT_FOUND' // 404 — team type does not exist or is soft-deleted
  | 'TEAM_NOT_FOUND' // 404 — team does not exist or is soft-deleted
  | 'TEAM_STAFF_ASSIGNMENT_NOT_FOUND' // 404 — staff is not a member of this team
  | 'STAFF_NOT_FOUND' // 404 — staff_id does not exist in this workspace
  | 'TEAM_TYPE_NAME_DUPLICATE' // 409 — active team type with same name already exists (case-insensitive)
  | 'TEAM_NAME_DUPLICATE' // 409 — active team with same name already exists (case-insensitive)
  | 'TEAM_TYPE_DISABLED' // 422 — referenced team type has status = DISABLED
  | 'TEAM_TYPE_HAS_TEAMS' // 422 — cannot delete a team type that still has active teams
  | 'TEAM_DISABLED' // 422 — cannot assign staff to a disabled team
  | 'TEAM_HAS_ASSIGNMENTS' // 422 — cannot delete a team that still has staff assignments
  | 'TEAM_REFERENCED_BY_REPORTING' // 422 — team is referenced by reporting entities
  | 'TEAM_MAX_MEMBERS_EXCEEDED' // 422 — team is at capacity
  | 'TEAM_LOCK_CONTENTION' // 422 — concurrent FOR UPDATE NOWAIT failed (PG 55P03)
  | 'VALIDATION_ERROR' // 422 — input validation failure

// ---------------------------------------------------------------------------
// HTTP status mapping
// ---------------------------------------------------------------------------

export const TEAMS_ERROR_HTTP_STATUS: Record<TeamsErrorCode, number> = {
  TEAM_TYPE_NOT_FOUND: 404,
  TEAM_NOT_FOUND: 404,
  TEAM_STAFF_ASSIGNMENT_NOT_FOUND: 404,
  STAFF_NOT_FOUND: 404,
  TEAM_TYPE_NAME_DUPLICATE: 409,
  TEAM_NAME_DUPLICATE: 409,
  TEAM_TYPE_DISABLED: 422,
  TEAM_TYPE_HAS_TEAMS: 422,
  TEAM_DISABLED: 422,
  TEAM_HAS_ASSIGNMENTS: 422,
  TEAM_REFERENCED_BY_REPORTING: 422,
  TEAM_MAX_MEMBERS_EXCEEDED: 422,
  TEAM_LOCK_CONTENTION: 422,
  VALIDATION_ERROR: 422,
}

// ---------------------------------------------------------------------------
// Default human-readable messages
// ---------------------------------------------------------------------------

export const TEAMS_ERROR_MESSAGES: Record<TeamsErrorCode, string> = {
  TEAM_TYPE_NOT_FOUND: 'Team type not found.',
  TEAM_NOT_FOUND: 'Team not found.',
  TEAM_STAFF_ASSIGNMENT_NOT_FOUND: 'Staff member is not assigned to this team.',
  STAFF_NOT_FOUND: 'Staff member not found in this workspace.',
  TEAM_TYPE_NAME_DUPLICATE: 'A team type with this name already exists.',
  TEAM_NAME_DUPLICATE: 'A team with this name already exists.',
  TEAM_TYPE_DISABLED: 'Cannot use a disabled team type.',
  TEAM_TYPE_HAS_TEAMS: 'Cannot delete a team type that still has active teams.',
  TEAM_DISABLED: 'Cannot assign staff to a disabled team.',
  TEAM_HAS_ASSIGNMENTS: 'Cannot delete a team that still has staff assignments.',
  TEAM_REFERENCED_BY_REPORTING: 'Cannot delete a team that is referenced by reporting entities.',
  TEAM_MAX_MEMBERS_EXCEEDED: 'This team has reached its maximum member capacity.',
  TEAM_LOCK_CONTENTION: 'Another operation is modifying this team. Please retry in a moment.',
  VALIDATION_ERROR: 'Validation failed.',
}

// ---------------------------------------------------------------------------
// Error class
// ---------------------------------------------------------------------------

export class TeamsError extends Error {
  public readonly code: TeamsErrorCode
  public readonly httpStatus: number

  constructor(
    code: TeamsErrorCode,
    message: string = TEAMS_ERROR_MESSAGES[code],
    httpStatus: number = TEAMS_ERROR_HTTP_STATUS[code]
  ) {
    super(message)
    this.name = 'TeamsError'
    this.code = code
    this.httpStatus = httpStatus
  }
}
