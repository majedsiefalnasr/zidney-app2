/**
 * Authentication Domain Package
 *
 * File: packages/domain-core/src/auth/index.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Central export point for all authentication domain modules.
 * Provides unified interface for auth layer to middleware and routes.
 */

// Types
export * from './types'

// Password hashing
export {
  generateDummyHash,
  hashPassword,
  validatePasswordComplexity,
  verifyPassword,
} from './password'

// JWT operations
export {
  extractTokenFromHeader,
  signBackofficeToken,
  signFrontofficeToken,
  signMmcToken,
  validateJwtClaims,
  verifyAndDecodeToken,
} from './jwt-handler'

// RBAC
export {
  buildRbacContext,
  evaluatePermission,
  evaluatePermissions,
  evaluateResourcePermission,
  getDefaultPermissionsForRole,
  getPermissionDescription,
  getRoleDescription,
  isValidPermissionCode,
} from './rbac'

// Audit logging
export {
  logAccountLocked,
  logAuthEvent,
  logLicenseBlocked,
  logLoginFailure,
  logLoginSuccess,
  logPermissionDenied,
  logSchemaMismatch,
  logTokenInvalidation,
  logTokenVersionMismatch,
  logWorkspaceMismatch,
} from './audit'
