/**
 * @zidney/validation - Input validation package
 *
 * Provides runtime validation for all platform inputs.
 * Pure functions, no side effects.
 */

// Attempt schemas
export {
  type CreateAttemptRequest,
  createAttemptRequestSchema,
  type QuestionResponse,
  questionResponseSchema,
  type SubmissionBusinessValidation,
  SubmissionReason,
  type SubmitAttemptRequest,
  submitAttemptRequestSchema,
  type UpdateProgressRequest,
  updateProgressRequestSchema,
  validateCreateAttemptRequest,
  validateSubmissionBusiness,
  validateSubmitAttemptRequest,
  validateUpdateProgressRequest,
} from './attempt-schemas'
// Divisions domain validation
export {
  assignStaffDivisionBodySchema,
  type CreateDivisionInput,
  createDivisionBodySchema,
  type DisableDivisionsInput,
  disableDivisionsBodySchema,
  divisionParamsSchema,
  removeStaffDivisionParamsSchema,
  staffDivisionsParamsSchema,
  type UpdateDivisionInput,
  type UpdateDivisionStatusInput,
  updateDivisionBodySchema,
  updateDivisionStatusBodySchema,
} from './divisions-validation'
// Master database input validation
export {
  ValidationError,
  validateCreateLicenseInput,
  validateCreateMMCUserInput,
  validateCreateProductInput,
  validateCreateTenantRegistryInput,
} from './master-db-schema'
// Migration file validation
export {
  calculateChecksum,
  detectDestructiveOperations,
  detectMigrationGap,
  extractMigrationHeader,
  type MigrationHeader,
  type MigrationValidationResult,
  validateChecksum,
  validateMigrationFile,
} from './migration-file-validator'
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
// Logging schema
export * from './schemas/logging-schema'
// Upgrade request validation
export {
  validateRollbackRequest,
  validateUpgradeRequest,
} from './upgrade-request-validator'
