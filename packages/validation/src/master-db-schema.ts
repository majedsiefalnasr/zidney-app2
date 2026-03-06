/**
 * Master Database Input Validation
 *
 * File: packages/validation/src/master-db-schema.ts
 * Task: T019
 * Phase: 4 - Validation and Utility Functions
 *
 * Provides runtime validation for all master database entity inputs.
 * These functions enforce constraints before database queries.
 */

import {
  type CreateLicenseInput,
  type CreateMMCUserInput,
  type CreateProductInput,
  type CreateTenantRegistryInput,
  LicenseStatus,
  MasterDBErrorCode,
  MMCUserRole,
} from '@zidney/types'

/**
 * Validation error with code for API response mapping
 */
export class ValidationError extends Error {
  constructor(
    public code: MasterDBErrorCode,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

// ========================================================================
// PRODUCT VALIDATION
// ========================================================================

/**
 * Validate CreateProductInput
 *
 * Checks:
 * - name: non-empty string
 * - slug: lowercase alphanumeric with hyphens only
 * - version: semantic format (X.Y.Z)
 * - enabled_modules: JSON object
 */
export function validateCreateProductInput(input: unknown): CreateProductInput {
  if (typeof input !== 'object' || input === null) {
    throw new ValidationError(
      MasterDBErrorCode.INVALID_REQUEST_BODY,
      'Product input must be an object'
    )
  }

  const data = input as Record<string, unknown>

  // Validate name
  if (typeof data.name !== 'string' || data.name.trim().length === 0) {
    throw new ValidationError(
      MasterDBErrorCode.MISSING_REQUIRED_FIELD,
      'Product name is required and must be non-empty string'
    )
  }

  // Validate slug
  if (typeof data.slug !== 'string' || data.slug.trim().length === 0) {
    throw new ValidationError(MasterDBErrorCode.MISSING_REQUIRED_FIELD, 'Product slug is required')
  }

  if (!/^[a-z0-9-]+$/.test(data.slug)) {
    throw new ValidationError(
      MasterDBErrorCode.INVALID_REQUEST_BODY,
      'Product slug must be lowercase alphanumeric with hyphens only'
    )
  }

  // Validate version if provided
  if (data.version !== undefined) {
    if (typeof data.version !== 'string') {
      throw new ValidationError(
        MasterDBErrorCode.INVALID_VERSION_FORMAT,
        'Version must be a string'
      )
    }

    if (!/^\d+\.\d+\.\d+$/.test(data.version)) {
      throw new ValidationError(
        MasterDBErrorCode.INVALID_VERSION_FORMAT,
        'Version must be semantic format (X.Y.Z)'
      )
    }
  }

  // Validate enabled_modules if provided
  if (
    data.enabled_modules !== undefined &&
    (typeof data.enabled_modules !== 'object' ||
      data.enabled_modules === null ||
      Array.isArray(data.enabled_modules))
  ) {
    throw new ValidationError(
      MasterDBErrorCode.INVALID_REQUEST_BODY,
      'enabled_modules must be a JSON object'
    )
  }

  return {
    name: data.name as string,
    slug: data.slug as string,
    description: typeof data.description === 'string' ? data.description : undefined,
    version: typeof data.version === 'string' ? data.version : undefined,
    enabled_modules:
      data.enabled_modules && typeof data.enabled_modules === 'object'
        ? (data.enabled_modules as Record<string, boolean>)
        : undefined,
  }
}

// ========================================================================
// LICENSE VALIDATION
// ========================================================================

/**
 * Validate CreateLicenseInput
 *
 * Checks:
 * - product_id: UUID format
 * - workspace_slug: lowercase alphanumeric with hyphens
 * - status: one of ACTIVE, SOFT_LOCKED, ARCHIVED
 * - limits: positive integers or null
 */
export function validateCreateLicenseInput(input: unknown): CreateLicenseInput {
  if (typeof input !== 'object' || input === null) {
    throw new ValidationError(
      MasterDBErrorCode.INVALID_REQUEST_BODY,
      'License input must be an object'
    )
  }

  const data = input as Record<string, unknown>

  // Validate product_id
  if (typeof data.product_id !== 'string' || data.product_id.trim().length === 0) {
    throw new ValidationError(
      MasterDBErrorCode.MISSING_REQUIRED_FIELD,
      'product_id is required and must be a UUID string'
    )
  }

  // Validate workspace_slug
  if (typeof data.workspace_slug !== 'string' || data.workspace_slug.trim().length === 0) {
    throw new ValidationError(
      MasterDBErrorCode.INVALID_WORKSPACE_SLUG_FORMAT,
      'workspace_slug is required'
    )
  }

  if (!/^[a-z0-9-]+$/.test(data.workspace_slug)) {
    throw new ValidationError(
      MasterDBErrorCode.INVALID_WORKSPACE_SLUG_FORMAT,
      'workspace_slug must be lowercase alphanumeric with hyphens only'
    )
  }

  // Validate status if provided
  if (
    data.status !== undefined &&
    !Object.values(LicenseStatus).includes(data.status as LicenseStatus)
  ) {
    throw new ValidationError(
      MasterDBErrorCode.INVALID_REQUEST_BODY,
      `status must be one of: ${Object.values(LicenseStatus).join(', ')}`
    )
  }

  // Validate limits
  if (data.student_limit !== undefined && data.student_limit !== null) {
    if (!Number.isInteger(data.student_limit) || (data.student_limit as number) <= 0) {
      throw new ValidationError(
        MasterDBErrorCode.INVALID_REQUEST_BODY,
        'student_limit must be positive integer or null'
      )
    }
  }

  if (data.staff_limit !== undefined && data.staff_limit !== null) {
    if (!Number.isInteger(data.staff_limit) || (data.staff_limit as number) <= 0) {
      throw new ValidationError(
        MasterDBErrorCode.INVALID_REQUEST_BODY,
        'staff_limit must be positive integer or null'
      )
    }
  }

  return {
    product_id: data.product_id as string,
    workspace_slug: data.workspace_slug as string,
    status: data.status as LicenseStatus | undefined,
    student_limit: data.student_limit as number | undefined,
    staff_limit: data.staff_limit as number | undefined,
  }
}

// ========================================================================
// TENANT REGISTRY VALIDATION
// ========================================================================

/**
 * Validate CreateTenantRegistryInput
 *
 * Checks:
 * - license_id: UUID format
 * - workspace_slug: format matches
 * - db_host: non-empty hostname
 * - db_port: valid port number
 * - db_name: valid database name
 * - db_user: non-empty
 * - password: non-empty
 */
export function validateCreateTenantRegistryInput(input: unknown): CreateTenantRegistryInput {
  if (typeof input !== 'object' || input === null) {
    throw new ValidationError(
      MasterDBErrorCode.INVALID_REQUEST_BODY,
      'Tenant registry input must be an object'
    )
  }

  const data = input as Record<string, unknown>

  // Validate license_id
  if (typeof data.license_id !== 'string' || data.license_id.trim().length === 0) {
    throw new ValidationError(MasterDBErrorCode.MISSING_REQUIRED_FIELD, 'license_id is required')
  }

  // Validate workspace_slug
  if (typeof data.workspace_slug !== 'string' || data.workspace_slug.trim().length === 0) {
    throw new ValidationError(
      MasterDBErrorCode.INVALID_WORKSPACE_SLUG_FORMAT,
      'workspace_slug is required'
    )
  }

  if (!/^[a-z0-9-]+$/.test(data.workspace_slug)) {
    throw new ValidationError(
      MasterDBErrorCode.INVALID_WORKSPACE_SLUG_FORMAT,
      'workspace_slug format invalid'
    )
  }

  // Validate db_host
  if (typeof data.db_host !== 'string' || data.db_host.trim().length === 0) {
    throw new ValidationError(MasterDBErrorCode.INVALID_DATABASE_HOST, 'db_host is required')
  }

  // Validate db_port
  if (data.db_port !== undefined) {
    const port = data.db_port as number
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new ValidationError(
        MasterDBErrorCode.INVALID_DATABASE_PORT,
        'db_port must be between 1 and 65535'
      )
    }
  }

  // Validate db_name
  if (typeof data.db_name !== 'string' || data.db_name.trim().length === 0) {
    throw new ValidationError(MasterDBErrorCode.MISSING_REQUIRED_FIELD, 'db_name is required')
  }

  // Validate db_user
  if (typeof data.db_user !== 'string' || data.db_user.trim().length === 0) {
    throw new ValidationError(MasterDBErrorCode.MISSING_REQUIRED_FIELD, 'db_user is required')
  }

  // Validate password
  if (
    typeof data.db_password_encrypted !== 'string' ||
    data.db_password_encrypted.trim().length === 0
  ) {
    throw new ValidationError(
      MasterDBErrorCode.MISSING_REQUIRED_FIELD,
      'db_password_encrypted is required'
    )
  }

  return {
    license_id: data.license_id as string,
    workspace_slug: data.workspace_slug as string,
    db_host: data.db_host as string,
    db_port: data.db_port as number | undefined,
    db_name: data.db_name as string,
    db_user: data.db_user as string,
    db_password_encrypted: data.db_password_encrypted as string,
  }
}

// ========================================================================
// MMC USER VALIDATION
// ========================================================================

/**
 * Validate CreateMMCUserInput
 *
 * Checks:
 * - email: valid email format
 * - password: non-empty
 * - role: one of admin, operator, read_only
 */
export function validateCreateMMCUserInput(input: unknown): CreateMMCUserInput {
  if (typeof input !== 'object' || input === null) {
    throw new ValidationError(
      MasterDBErrorCode.INVALID_REQUEST_BODY,
      'MMC user input must be an object'
    )
  }

  const data = input as Record<string, unknown>

  // Validate email
  if (typeof data.email !== 'string' || data.email.trim().length === 0) {
    throw new ValidationError(MasterDBErrorCode.INVALID_EMAIL_FORMAT, 'email is required')
  }

  // Basic email format check
  if (!data.email.includes('@')) {
    throw new ValidationError(MasterDBErrorCode.INVALID_EMAIL_FORMAT, 'Invalid email format')
  }

  // Validate password
  if (typeof data.password !== 'string' || data.password.length === 0) {
    throw new ValidationError(MasterDBErrorCode.MISSING_REQUIRED_FIELD, 'password is required')
  }

  if (data.password.length < 8) {
    throw new ValidationError(
      MasterDBErrorCode.INVALID_REQUEST_BODY,
      'password must be at least 8 characters'
    )
  }

  // Validate role if provided
  if (data.role !== undefined && !Object.values(MMCUserRole).includes(data.role as MMCUserRole)) {
    throw new ValidationError(
      MasterDBErrorCode.INVALID_REQUEST_BODY,
      `role must be one of: ${Object.values(MMCUserRole).join(', ')}`
    )
  }

  return {
    email: data.email as string,
    password: data.password as string,
    role: data.role as MMCUserRole | undefined,
  }
}

export default {
  ValidationError,
  validateCreateProductInput,
  validateCreateLicenseInput,
  validateCreateTenantRegistryInput,
  validateCreateMMCUserInput,
}
