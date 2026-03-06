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

// Export classes
export { StudentStaffCounter } from './limit-enforcer'
export { LicenseResolver } from './resolver'
// Export service functions
export {
  type CreateLicenseOptions,
  createLicense,
  deleteLicense,
  getLicenseById,
  getLicenseByWorkspaceId,
  restoreFromArchive,
  type TransitionOptions,
  type TransitionResult,
  transitionLicenseState,
  transitionToActive,
  transitionToArchived,
  transitionToDeleted,
  transitionToSoftLock,
} from './service'
export { StateTransition } from './state-machine'
export type {
  ArchiveSnapshot,
  CreateLicenseRequest,
  License,
  LicenseTransition,
  LimitConstraint,
  TransitionLicenseRequest,
  ValidationResult,
} from './types'
// Export types (using export type for interfaces when isolatedModules is enabled)
export { LicenseStatus } from './types'
export { VersionValidator } from './validator'
