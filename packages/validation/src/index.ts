/**
 * @zidney/validation - Input validation package
 *
 * Provides runtime validation for all platform inputs.
 * Pure functions, no side effects.
 */

// Upgrade request validation
export {
  validateRollbackRequest,
  validateUpgradeRequest,
} from './upgrade-request-validator'

// Schema version validation (SemVer)
export {
  compareVersions,
  isCompatible,
  isMajorBump,
  isMinorBump,
  isPatchBump,
  parseVersion,
  semVerToString,
  validateUpgrade,
} from './schema-version-validator'

// Migration file validation
export {
  calculateChecksum,
  detectDestructiveOperations,
  detectMigrationGap,
  extractMigrationHeader,
  validateChecksum,
  validateMigrationFile,
  type MigrationHeader,
  type MigrationValidationResult,
} from './migration-file-validator'

// Master database input validation
export {
  validateCreateLicenseInput,
  validateCreateMMCUserInput,
  validateCreateProductInput,
  validateCreateTenantRegistryInput,
  ValidationError,
} from './master-db-schema'

// Attempt schemas
export {
  createAttemptRequestSchema,
  questionResponseSchema,
  SubmissionReason,
  submitAttemptRequestSchema,
  updateProgressRequestSchema,
  validateCreateAttemptRequest,
  validateSubmissionBusiness,
  validateSubmitAttemptRequest,
  validateUpdateProgressRequest,
  type CreateAttemptRequest,
  type QuestionResponse,
  type SubmissionBusinessValidation,
  type SubmitAttemptRequest,
  type UpdateProgressRequest,
} from './attempt-schemas'

// Logging schema
export * from './schemas/logging-schema'
