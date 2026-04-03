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
// Departments domain validation
export {
  type AssignStaffDepartmentBody,
  assignStaffDepartmentBodySchema,
  type CreateDepartmentBody,
  createDepartmentBodySchema,
  type DeleteDepartmentParams,
  type DepartmentChildrenParams,
  type DepartmentTreeQuery,
  deleteDepartmentParamsSchema,
  departmentChildrenParamsSchema,
  departmentTreeQuerySchema,
  type GetDepartmentParams,
  getDepartmentParamsSchema,
  type ListDepartmentsQuery,
  listDepartmentsQuerySchema,
  type RemoveStaffDepartmentParams,
  removeStaffDepartmentParamsSchema,
  type StaffDepartmentsParams,
  staffDepartmentsParamsSchema,
  type UpdateDepartmentBody,
  updateDepartmentBodySchema,
} from './backoffice/departments.schemas'
// Divisions domain validation
export {
  type AssignStaffDivisionBody,
  // Re-export with aliases for backward compatibility
  type AssignStaffDivisionBody as AssignStaffDivisionInput,
  assignStaffDivisionBodySchema,
  type CreateDivisionBody,
  // Re-export with aliases for backward compatibility
  type CreateDivisionBody as CreateDivisionInput,
  createDivisionBodySchema,
  type DeleteDivisionParams,
  type DisableDivisionsBody,
  // Re-export with aliases for backward compatibility
  type DisableDivisionsBody as DisableDivisionsInput,
  type DivisionParams,
  deleteDivisionParamsSchema,
  disableDivisionsBodySchema,
  divisionParamsSchema,
  type ListDivisionsQuery,
  listDivisionsQuerySchema,
  type RemoveStaffDivisionParams,
  removeStaffDivisionParamsSchema,
  type StaffDivisionsParams,
  staffDivisionsParamsSchema,
  type UpdateDivisionBody,
  // Re-export with aliases for backward compatibility
  type UpdateDivisionBody as UpdateDivisionInput,
  type UpdateDivisionStatusBody,
  // Re-export with aliases for backward compatibility
  type UpdateDivisionStatusBody as UpdateDivisionStatusInput,
  updateDivisionBodySchema,
  updateDivisionStatusBodySchema,
} from './backoffice/divisions.schemas'
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
// Staff management validation (Stage 041)
export {
  type CreateStaffBody,
  createStaffBodySchema,
  type StaffIdParams,
  type StaffListQuery,
  staffIdParamsSchema,
  staffListQuerySchema,
  type UpdateStaffBody,
  updateStaffBodySchema,
} from './staff.schema'
// Student management validation (Stage 042)
export {
  type BulkImportBody,
  type BulkImportRow,
  bulkImportBodySchema,
  bulkImportRowSchema,
  type CreateStudentBody,
  createStudentBodySchema,
  type StudentIdParams,
  type StudentListQuery,
  studentIdParamsSchema,
  studentListQuerySchema,
  studentStatusSchema,
  subscriptionStatusSchema,
  type UpdateStudentBody,
  type UpdateSubscriptionStatusBody,
  updateStudentBodySchema,
  updateSubscriptionStatusBodySchema,
} from './student.schema'
// Upgrade request validation
export {
  validateRollbackRequest,
  validateUpgradeRequest,
} from './upgrade-request-validator'
