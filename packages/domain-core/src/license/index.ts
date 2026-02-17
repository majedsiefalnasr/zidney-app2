/**
 * License Domain Module Index
 *
 * File: packages/domain-core/src/license/index.ts
 *
 * Exports:
 * - All types (License, LicenseStatus, etc.)
 * - All classes (Resolver, Validator, StateTransition, Counter)
 * - Factory functions for construction
 *
 * Usage in API:
 * import { LicenseResolver, LicenseStatus, VersionValidator } from '@zidney/domain-core/license'
 */

// Export types
export {
  ArchiveSnapshot,
  CreateLicenseRequest,
  License,
  LicenseStatus,
  LicenseTransition,
  LimitConstraint,
  TransitionLicenseRequest,
  ValidationResult,
} from './types'

// Export classes
export { StudentStaffCounter } from './limit-enforcer'
export { LicenseResolver } from './resolver'
export { StateTransition } from './state-machine'
export { VersionValidator } from './validator'

// Export service functions
export {
  createLicense,
  getLicenseById,
  getLicenseByWorkspaceId,
  transitionLicenseState,
  type CreateLicenseOptions,
  type TransitionOptions,
  type TransitionResult,
} from './service'
