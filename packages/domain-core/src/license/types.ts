/**
 * License Domain Types
 *
 * File: packages/domain-core/src/license/types.ts
 * Task: T002
 *
 * Exports all TypeScript interfaces for the license domain:
 * - License (core license entity)
 * - LicenseStatus (enum of valid states)
 * - ArchiveSnapshot (snapshot record)
 * - ValidationResult (validation outcome)
 */

/**
 * Valid license statuses
 *
 * Lifecycle:
 * ACTIVE → SOFT_LOCKED (payment failure)
 * SOFT_LOCKED → ACTIVE (renewal)
 * SOFT_LOCKED → ARCHIVED (auto-expiry or manual)
 * ARCHIVED → DELETED (manual confirmation)
 */
export enum LicenseStatus {
  ACTIVE = 'ACTIVE',
  SOFT_LOCKED = 'SOFT_LOCKED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

/**
 * License entity (master database)
 *
 * Single source of truth for workspace license lifecycle state.
 *
 * Immutable fields: workspace_slug, expected_schema_version, expected_product_version
 * Mutable fields: status, soft_lock_until, archived_at, deleted_at
 * Updated fields: updated_at
 */
export interface License {
  id: string // UUID
  product_id: string // UUID (FK to products)
  workspace_id: string // UUID (FK to workspaces)
  workspace_slug: string // String (globally unique, immutable)
  student_limit: number | null // NULL = unlimited
  staff_limit: number | null // NULL = unlimited
  status: LicenseStatus
  soft_lock_until: Date | null // Grace period expiration (SOFT_LOCKED only)
  archived_at: Date | null // Archive timestamp (ARCHIVED only)
  deleted_at: Date | null // Deletion timestamp (DELETED only)
  expected_schema_version: string // SemVer (e.g., "1.0.0", frozen at creation)
  expected_product_version: string // SemVer (e.g., "1.0.0", frozen at creation)
  created_at: Date
  updated_at: Date
}

/**
 * Archive snapshot record (master database)
 *
 * Immutable record of archived workspace snapshot.
 * Created when license transitions from SOFT_LOCKED → ARCHIVED.
 * One per license (UNIQUE constraint).
 */
export interface ArchiveSnapshot {
  id: string // UUID
  license_id: string // UUID (FK to licenses)
  snapshot_location: string // S3 path (e.g., s3://archive-snapshots/license-id/2026-02-17T10:30:00Z.sql)
  snapshot_timestamp: Date // Exact time snapshot was taken (for deduplication)
  created_at: Date
}

/**
 * License validation result
 *
 * Outcome of license status + version validation.
 * Used by middleware to determine access permission.
 */
export interface ValidationResult {
  valid: boolean
  status: LicenseStatus
  error_code?: string // LICENSE_SOFT_LOCKED, LICENSE_ARCHIVED, LICENSE_NOT_FOUND, etc.
  error_message?: string // User-friendly error message
  http_status?: number // HTTP status code (423, 403, 404, 426, etc.)
}

/**
 * License limit constraint
 *
 * Used in limit enforcement (user creation with student/staff limits).
 * Null = unlimited (no enforcement).
 */
export interface LimitConstraint {
  student_limit: number | null
  staff_limit: number | null
  current_student_count?: number
  current_staff_count?: number
}

/**
 * License transition details
 *
 * Used by state machine to track transitions.
 */
export interface LicenseTransition {
  license_id: string // UUID
  from_status: LicenseStatus
  to_status: LicenseStatus
  reason?: string // Why transition occurred (e.g., "payment_failure", "manual_archive")
  idempotency_key: string // {license_id}_{to_status}
  triggered_at: Date // Server time
}

/**
 * License creation parameters
 */
export interface CreateLicenseRequest {
  product_id: string // UUID
  workspace_id: string // UUID
  workspace_slug: string // String (globally unique)
  student_limit?: number | null
  staff_limit?: number | null
  expected_schema_version?: string // defaults to 1.0.0
  expected_product_version?: string // defaults to 1.0.0
}

/**
 * License state transition request
 */
export interface TransitionLicenseRequest {
  license_id: string // UUID
  target_state: LicenseStatus
  reason?: string
  idempotency_key?: string
}
