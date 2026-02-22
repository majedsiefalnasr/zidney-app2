/**
 * Product Type Definitions
 *
 * Type-safe interfaces for product management in Zidney.
 * Products define commercial offerings, module bundles, and licensing templates.
 *
 * Stage: STAGE_09_PRODUCTS
 * Trust Chain: Product → License → Workspace
 */

import { Module } from '../enums/Module'

/**
 * Localized name object
 */
export interface LocalizedName {
  en: string
  ar?: string
}

/**
 * Product status enum
 */
export enum ProductStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

/**
 * Core Product entity
 * Represents a commercial product offering with configurable modules
 */
export interface Product {
  id: string // UUID
  name: LocalizedName
  slug: string // Unique, immutable identifier
  description?: string
  enabled_modules: Module[]
  status: ProductStatus
  current_version: number
  created_at: Date
  updated_at: Date
}

/**
 * Product creation input (request body)
 */
export interface CreateProductInput {
  name: LocalizedName
  slug: string
  description?: string
  enabled_modules: Module[]
}

/**
 * Product update input (request body)
 * Supports partial updates, but slug is immutable
 */
export interface UpdateProductInput {
  name?: LocalizedName
  description?: string
  enabled_modules?: Module[]
}

/**
 * Product status change input
 */
export interface ChangeProductStatusInput {
  status: ProductStatus
}

/**
 * Product version record
 * Immutable snapshot of product configuration at a specific version
 */
export interface ProductVersion {
  id: string // UUID
  product_id: string // FK to Product
  version_number: number
  change_summary?: string
  created_at: Date
}

/**
 * Audit log action types
 */
export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  STATUS_CHANGE = 'STATUS_CHANGE',
}

/**
 * Field diff in audit log
 * Tracks what changed between versions
 */
export interface FieldDiff {
  [fieldName: string]: {
    old: unknown
    new: unknown
  }
}

/**
 * Product audit log entry
 * Immutable record of all changes to a product
 */
export interface ProductAuditLogEntry {
  id: string // UUID
  product_id: string // FK to Product
  action: AuditAction
  previous_version?: number // NULL for CREATE
  new_version?: number // NULL for STATUS_CHANGE
  changed_fields: FieldDiff
  performed_by: string // UUID of admin/user
  timestamp: Date
}

/**
 * User details for audit log
 */
export interface UserDetails {
  id: string
  email: string
  name?: string
}

/**
 * Audit log entry with user details
 */
export interface ProductAuditLogWithUser extends ProductAuditLogEntry {
  performed_by_user?: UserDetails
}

/**
 * Product query filters
 */
export interface ProductQueryFilters {
  status?: ProductStatus | 'all'
  search?: string // Searches name (en/ar) and slug
  limit?: number // default 20, max 100
  offset?: number // default 0
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

/**
 * API Response for single product
 */
export interface ProductResponse extends Product {
  // Standard Product fields
}

/**
 * Audit log query filters
 */
export interface AuditLogQueryFilters {
  action?: AuditAction
  from_date?: Date
  to_date?: Date
  limit?: number // default 20, max 100
  offset?: number // default 0
}
