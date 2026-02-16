/**
 * Master Database Entity Types
 *
 * File: packages/types/src/master-db.ts
 * Task: T014 - T015
 * Phase: 3 - TypeScript Type Definitions
 *
 * Exports:
 * - entities: Product, License, TenantRegistry, MMCUser, PlatformSchemaVersion
 * - enums: LicenseStatus, MMCUserRole
 * - operations: CreateProductInput, UpdateProductInput, etc.
 */

// ========================================================================
// ENUM TYPES
// ========================================================================

export enum LicenseStatus {
  ACTIVE = 'ACTIVE',
  SOFT_LOCKED = 'SOFT_LOCKED',
  ARCHIVED = 'ARCHIVED',
}

export enum MMCUserRole {
  ADMIN = 'admin',
  OPERATOR = 'operator',
  READ_ONLY = 'read_only',
}

// ========================================================================
// ENTITY TYPES
// ========================================================================

/**
 * Product: Application product definition
 *
 * Example: { id: 'uuid', slug: 'pro', name: 'Zidney Pro', version: '1.0.0' }
 */
export interface Product {
  id: string // UUID
  name: string
  slug: string // Globally unique
  description?: string
  version: string // Semantic version: X.Y.Z
  enabled_modules: Record<string, boolean> // Feature flags
  created_at: Date
}

/**
 * License: License registry with workspace allocation
 *
 * Single source of truth for license lifecycle state
 * One license per workspace (unique workspace_slug)
 * Lifecycle: ACTIVE → SOFT_LOCKED → ARCHIVED
 */
export interface License {
  id: string // UUID
  product_id: string // UUID, FK→products
  workspace_slug: string // Globally unique
  status: LicenseStatus
  student_limit?: number // NULL = unlimited
  staff_limit?: number // NULL = unlimited
  soft_lock_until?: Date // Non-null if status === SOFT_LOCKED
  archived_at?: Date // Non-null if status === ARCHIVED
  created_at: Date
  updated_at: Date
}

/**
 * TenantRegistry: Tenant database connection metadata
 *
 * Infrastructure metadata only (never duplicates lifecycle state from licenses)
 * Password stored encrypted (decryption at application layer)
 * One registry per license (one-to-one via license_id)
 */
export interface TenantRegistry {
  id: string // UUID
  license_id: string // UUID, FK→licenses
  workspace_slug: string // Unique, matches licenses.workspace_slug
  db_host: string
  db_port: number
  db_name: string
  db_user: string
  db_password_encrypted: string // Encrypted at rest
  created_at: Date
  updated_at: Date
}

/**
 * MMCUser: Platform admin/operator user account
 *
 * Role-based access control for Master Management Console
 * Email is globally unique login identifier
 * Password stored as bcrypt hash (never plaintext)
 */
export interface MMCUser {
  id: number // Serial ID
  email: string // Globally unique
  password_hash: string // Bcrypt hash
  role: MMCUserRole
  last_login_at?: Date
  created_at: Date
  updated_at: Date
}

/**
 * PlatformSchemaVersion: Schema version tracking
 *
 * Single-row table (id = 1 enforced)
 * current_version = deployed schema version
 * minimum_supported_version = oldest schema version API can work with
 */
export interface PlatformSchemaVersion {
  id: 1 // Always 1 (enforced)
  current_version: string // Semantic version: X.Y.Z
  minimum_supported_version: string // Semantic version: X.Y.Z
  updated_at: Date
}

// ========================================================================
// INPUT/OUTPUT TYPES
// ========================================================================

/**
 * CreateProductInput: API input for creating a product
 */
export interface CreateProductInput {
  name: string
  slug: string
  description?: string
  version?: string // Default: 1.0.0
  enabled_modules?: Record<string, boolean>
}

/**
 * UpdateProductInput: API input for updating a product
 *
 * All fields optional (partial update)
 */
export interface UpdateProductInput {
  name?: string
  description?: string
  version?: string
  enabled_modules?: Record<string, boolean>
}

/**
 * CreateLicenseInput: API input for creating a license
 */
export interface CreateLicenseInput {
  product_id: string
  workspace_slug: string
  status?: LicenseStatus // Default: ACTIVE
  student_limit?: number
  staff_limit?: number
}

/**
 * UpdateLicenseInput: API input for updating a license
 *
 * Allows state transitions and limit updates
 */
export interface UpdateLicenseInput {
  status?: LicenseStatus
  student_limit?: number
  staff_limit?: number
  soft_lock_until?: Date
  archived_at?: Date
}

/**
 * CreateTenantRegistryInput: API input for creating a tenant registry
 */
export interface CreateTenantRegistryInput {
  license_id: string
  workspace_slug: string
  db_host: string
  db_port?: number // Default: 5432
  db_name: string
  db_user: string
  db_password_encrypted: string
}

/**
 * UpdateTenantRegistryInput: API input for updating a tenant registry
 */
export interface UpdateTenantRegistryInput {
  db_host?: string
  db_port?: number
  db_name?: string
  db_user?: string
  db_password_encrypted?: string
}

/**
 * CreateMMCUserInput: API input for creating an MMC user
 */
export interface CreateMMCUserInput {
  email: string
  password: string // Plaintext (hashed at application layer)
  role?: MMCUserRole // Default: read_only
}

/**
 * UpdateMMCUserInput: API input for updating an MMC user
 */
export interface UpdateMMCUserInput {
  email?: string
  password?: string // If provided, will be hashed
  role?: MMCUserRole
}

export default {
  // Entities
  Product,
  License,
  TenantRegistry,
  MMCUser,
  PlatformSchemaVersion,
  // Enums
  LicenseStatus,
  MMCUserRole,
  // Inputs
  CreateProductInput,
  UpdateProductInput,
  CreateLicenseInput,
  UpdateLicenseInput,
  CreateTenantRegistryInput,
  UpdateTenantRegistryInput,
  CreateMMCUserInput,
  UpdateMMCUserInput,
}
