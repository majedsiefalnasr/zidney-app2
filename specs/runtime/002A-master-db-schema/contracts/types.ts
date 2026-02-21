// TypeScript Interface Contract: Master Database Types
//
// Feature: 002A-master-db-schema
// Format: TypeScript interfaces
// Created: 2026-02-16
//
// This file defines the runtime type contracts for master database entities.
// All API operations must use these types for consistency.

/**
 * Product: Represents a sellable product type with versioning.
 *
 * Authority: Master Database, products table
 * Mutability: Rarely changes (created by admin)
 * Relationship: One-to-Many with licenses
 */
export interface Product {
  id: string // UUID
  name: string // Product display name
  slug: string // URL-safe identifier (unique)
  description?: string | null // Optional product description
  version: string // Semantic version (e.g., "1.0.0")
  enabled_modules: Record<string, boolean> // Feature flags
  created_at: Date // Server time (UTC)
  updated_at: Date // Server time (UTC)
}

/**
 * License: Represents a purchased product instance bound to a workspace.
 *
 * Authority: Master Database, licenses table
 * Lifecycle State: status field is SINGLE SOURCE OF TRUTH
 * Constraint: workspace_slug is UNIQUE
 *
 * Status Values:
 *   ACTIVE: Workspace can operate normally
 *   SOFT_LOCKED: Temporarily blocked (e.g., payment overdue), expires after soft_lock_until
 *   ARCHIVED: Permanently disabled
 */
export type LicenseStatus = 'ACTIVE' | 'SOFT_LOCKED' | 'ARCHIVED'

export interface License {
  id: string // UUID
  product_id: string // FK → products
  workspace_slug: string // Unique workspace identifier
  student_limit: number | null // null = unlimited
  staff_limit: number | null // null = unlimited
  status: LicenseStatus // Lifecycle state
  starts_at: Date // License validity start (server time, UTC)
  expires_at: Date // License validity end (server time, UTC)
  product_version: string // Frozen version at purchase
  schema_version: string // Frozen version at purchase
  soft_lock_until: Date | null // Temporary lock deadline (UTC)
  archived_at: Date | null // Archival timestamp (UTC)
  deleted_at: Date | null // Soft deletion timestamp (UTC)
  created_at: Date // Server time (UTC)
  updated_at: Date // Server time (UTC)
}

/**
 * LicenseValidationResult: Result of license validation.
 *
 * Used by middleware to determine if workspace is allowed to proceed.
 */
export interface LicenseValidationResult {
  valid: boolean
  license: License | null
  reason?: string // If not valid, why (e.g., "SOFT_LOCKED", "ARCHIVED", "NOT_FOUND")
  error_code?: number // HTTP error code (423, 403, 404, 426)
}

/**
 * TenantRegistry: Infrastructure metadata for tenant database connectivity.
 *
 * Authority: Master Database, tenants_registry table
 * Architectural Rule: Does NOT store lifecycle state (reads from licenses table)
 * Constraint: workspace_slug is UNIQUE
 *
 * Usage: Tenant resolver uses this to get database connection details.
 */
export interface TenantRegistry {
  id: string // UUID
  license_id: string // FK → licenses
  workspace_slug: string // Must match licenses.workspace_slug
  db_name: string // Database name
  db_host: string // Hostname or IP
  db_port: number // Port (typically 5432)
  db_user: string // Database user
  db_password_encrypted: string // AES-256 encrypted
  schema_version: string // Tenant's schema version
  product_version: string // Tenant's product version
  created_at: Date // Server time (UTC)
  updated_at: Date // Server time (UTC)
}

/**
 * TenantResolverContext: Result of tenant resolution.
 *
 * Created by the tenant resolver middleware.
 * Contains everything needed to connect to a specific tenant database.
 */
export interface TenantResolverContext {
  workspace_slug: string // Requested workspace
  license: License // License for this workspace
  tenant_registry: TenantRegistry // Connection metadata
  db_connection_url: string // Computed connection string (e.g., postgresql://user:pass@host:port/db)
}

/**
 * MMCUser: Platform-internal user for Master Management Console.
 *
 * Authority: Master Database, mmc_users table
 * Purpose: Control access to product/license management
 */
export type MMCUserRole = 'admin' | 'operator' | 'read_only'

export interface MMCUser {
  id: number // Auto-incrementing integer
  email: string // Unique login credential
  password_hash: string // Bcrypt hash (never plain text)
  role: MMCUserRole // RBAC role
  is_active: boolean // Soft deletion flag
  created_at: Date // Server time (UTC)
}

/**
 * PlatformSchemaVersion: Single-row table controlling version compatibility.
 *
 * Authority: Master Database, platform_schema_version table
 * Constraint: id must always equal 1
 *
 * Usage:
 *   - Runtime startup: Check compatibility
 *   - Tenant provisioning: Use current_version as schema_version
 *   - License validation: Enforce minimum_supported_version
 */
export interface PlatformSchemaVersion {
  id: 1 // Always 1
  current_version: string // Current platform version (e.g., "1.0.0")
  minimum_supported_version: string // Minimum version for compatibility
  updated_at: Date // Last update (server time, UTC)
}

/**
 * Migration Record: Tracks executed migrations.
 *
 * Authority: Master Database, _schema_migrations table (internal)
 * Purpose: Prevent re-execution of migrations
 */
export interface MigrationRecord {
  version: string // Migration version (e.g., "001")
  description: string // Human-readable description
  applied_at: Date // When migration was applied (server time, UTC)
  execution_time_ms: number // How long migration took
}

/**
 * Error Codes for Master DB Operations
 *
 * These are used by middleware and API layers.
 */
export enum MasterDBErrorCode {
  // License validation errors
  LICENSE_NOT_FOUND = 404,
  LICENSE_ARCHIVED = 4031,
  LICENSE_SOFT_LOCKED = 423,
  LICENSE_EXPIRED = 4032,

  // Version errors
  VERSION_MISMATCH = 4261,
  SCHEMA_INCOMPATIBLE = 4262,

  // Database errors
  DB_CONNECTION_ERROR = 5001,
  DB_TRANSACTION_FAILED = 5002,
  DB_CONSTRAINT_VIOLATION = 409,

  // Validation errors
  INVALID_WORKSPACE_SLUG = 4001,
  INVALID_VERSION_FORMAT = 4002,
  INVALID_STATUS = 4003,
}

/**
 * API Response Envelope
 *
 * All API responses follow this structure.
 */
export interface APIResponse<T> {
  success: boolean
  data: T | null
  error: {
    code: string
    message: string
  } | null
}

/**
 * Utility Types
 */

// Create request payloads (omit auto-generated fields)
export type CreateProductInput = Omit<
  Product,
  'id' | 'created_at' | 'updated_at'
>

export type CreateLicenseInput = Omit<
  License,
  'id' | 'created_at' | 'updated_at'
>

export type CreateTenantRegistryInput = Omit<
  TenantRegistry,
  'id' | 'created_at' | 'updated_at'
>

export type CreateMMCUserInput = Omit<MMCUser, 'id' | 'created_at'>

// Update request payloads (all fields optional)
export type UpdateProductInput = Partial<CreateProductInput>

export type UpdateLicenseInput = Partial<CreateLicenseInput>

export type UpdateTenantRegistryInput = Partial<CreateTenantRegistryInput>

export type UpdateMMCUserInput = Partial<CreateMMCUserInput>

/**
 * Validation Rules
 *
 * Used by API layer for input validation.
 */
export const ValidationRules = {
  product: {
    name: { min: 1, max: 255 },
    slug: { pattern: /^[a-z0-9-]+$/, min: 1, max: 100 },
    version: { pattern: /^\d+\.\d+\.\d+$/ }, // Semantic versioning
  },
  license: {
    workspace_slug: { pattern: /^[a-z0-9-]+$/, min: 1, max: 100 },
    status: { enum: ['ACTIVE', 'SOFT_LOCKED', 'ARCHIVED'] },
    student_limit: { min: 1, max: 1000000 },
    staff_limit: { min: 1, max: 100000 },
  },
  mmc_user: {
    email: { pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
    role: { enum: ['admin', 'operator', 'read_only'] },
  },
}

/**
 * Authorization Levels for MMC Roles
 *
 * Determined by role in mmc_users table.
 */
export const RolePermissions = {
  admin: {
    create_product: true,
    update_product: true,
    delete_product: true,
    create_license: true,
    update_license: true,
    delete_license: true,
    view_analytics: true,
    manage_users: true,
  },
  operator: {
    create_product: false,
    update_product: false,
    delete_product: false,
    create_license: true,
    update_license: true,
    delete_license: false,
    view_analytics: true,
    manage_users: false,
  },
  read_only: {
    create_product: false,
    update_product: false,
    delete_product: false,
    create_license: false,
    update_license: false,
    delete_license: false,
    view_analytics: true,
    manage_users: false,
  },
}

/**
 * Semantic Versioning Utilities
 *
 * Used for version comparison and compatibility checks.
 */
export function parseVersion(versionString: string): {
  major: number
  minor: number
  patch: number
} {
  const [major, minor, patch] = versionString.split('.').map(Number)
  return { major, minor, patch }
}

export function isVersionCompatible(
  requested: string,
  minimum: string
): boolean {
  const r = parseVersion(requested)
  const m = parseVersion(minimum)

  // requested >= minimum
  if (r.major > m.major) return true
  if (r.major < m.major) return false
  if (r.minor > m.minor) return true
  if (r.minor < m.minor) return false
  return r.patch >= m.patch
}

export function isLicenseActive(
  license: License,
  now: Date = new Date()
): boolean {
  if (license.deleted_at !== null && license.deleted_at < now) return false
  if (license.status === 'ARCHIVED') return false
  if (license.status === 'ACTIVE') return true
  if (license.status === 'SOFT_LOCKED' && license.soft_lock_until) {
    return license.soft_lock_until > now // Still locked? Return false
  }
  return false
}
