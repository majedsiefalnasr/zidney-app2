/**
 * License Domain Types
 *
 * File: packages/domain-core/src/licenses/types.ts
 * Task: T002
 *
 * Exports all TypeScript interfaces for the license management domain:
 * - License (core license entity)
 * - LicenseStatus (enum of valid states)
 * - CreateLicenseRequest, EditLicenseRequest (request DTOs)
 * - ProvisioningJobPayload (worker input)
 */

/**
 * Valid license statuses (database enum)
 *
 * Lifecycle state machine:
 * - PENDING_PROVISION: License created, awaiting DB provisioning
 * - ACTIVE: Fully operational, workspace accessible
 * - SOFT_LOCKED: Payment/suspension, access blocked, data preserved
 * - PROVISION_FAILED: Provisioning job failed, manual retry available
 * - ARCHIVED: Snapshot taken, workspace read-only, recoverable
 * - DELETED: Terminal state, database dropped, unrecoverable
 */
export enum LicenseStatus {
  PENDING_PROVISION = 'PENDING_PROVISION',
  ACTIVE = 'ACTIVE',
  SOFT_LOCKED = 'SOFT_LOCKED',
  PROVISION_FAILED = 'PROVISION_FAILED',
  ARCHIVED = 'ARCHIVED',
  DELETED = 'DELETED',
}

/**
 * Full License entity (master database) - 21 fields
 *
 * Single source of truth for workspace license lifecycle state.
 *
 * Immutable fields: id, product_id, workspace_slug, schema_version, product_version,
 *                   created_at
 * Mutable fields: All others
 * Auto-updated: updated_at (trigger-driven on every UPDATE)
 */
export interface License {
  // Identifiers
  id: string // UUID (PK)
  product_id: string // UUID (FK to products, immutable)
  workspace_slug: string // VARCHAR(64), globally unique, immutable, lowercase

  // Workspace metadata
  workspace_name: string // VARCHAR(255), mutable
  student_limit: number | null // INTEGER, >= 0 or null (unlimited)
  staff_limit: number | null // INTEGER, >= 0 or null (unlimited)

  // Commercial settings
  use_zidney_payment: boolean // BOOLEAN, default false
  commission_per_user: number | null // NUMERIC(10, 2), nullable

  // Institutional settings
  default_language: string // VARCHAR(5), default 'en'
  uses_divisions: boolean // BOOLEAN, default false

  // Lifecycle state
  status: LicenseStatus // status_enum, default PENDING_PROVISION
  soft_lock_until: Date | null // TIMESTAMP WITH TIME ZONE, nullable
  archived_at: Date | null // TIMESTAMP WITH TIME ZONE, nullable
  deleted_at: Date | null // TIMESTAMP WITH TIME ZONE, nullable

  // Version snapshots (immutable after creation)
  schema_version: number // INTEGER, platform schema version at creation
  product_version: number // INTEGER, product version at creation

  // Provisioning tracking
  provisioning_error: string | null // TEXT, nullable, sanitized error message
  provisioning_retries: number // INTEGER, default 0
  provisioning_last_attempt_at: Date | null // TIMESTAMP WITH TIME ZONE, nullable

  // Audit fields
  created_at: Date // TIMESTAMP WITH TIME ZONE (server-set, UTC)
  updated_at: Date // TIMESTAMP WITH TIME ZONE (auto-updated on every PATCH)
}

/**
 * Create License Request DTO
 *
 * User input for license creation endpoint.
 * Validates workspace uniqueness and product existence.
 */
export interface CreateLicenseRequest {
  // Required
  product_id: string // UUID, must exist and status = ACTIVE
  workspace_slug: string // 3-64 chars, ^[a-z0-9\-]+$, globally unique
  workspace_name: string // 1-255 chars

  // Optional with defaults
  student_limit?: number | null // >= 0 or null, default null (unlimited)
  staff_limit?: number | null // >= 0 or null, default null (unlimited)
  use_zidney_payment?: boolean // default false
  commission_per_user?: number | null // >= 0 or null, default null
  default_language?: string // ISO 639-1 code, default 'en'
  uses_divisions?: boolean // default false
}

/**
 * Edit License Request DTO
 *
 * User input for license edit endpoint.
 * Only allows mutable fields; rejects product_id, workspace_slug, versions.
 */
export interface EditLicenseRequest {
  student_limit?: number | null
  staff_limit?: number | null
  commission_per_user?: number | null
  use_zidney_payment?: boolean
  default_language?: string
  uses_divisions?: boolean
}

/**
 * Provisioning Job Payload
 *
 * Enqueued to Redis queue for async worker processing.
 * Contains all parameters needed to provision tenant database.
 */
export interface ProvisioningJobPayload {
  license_id: string // UUID
  workspace_slug: string // For database naming: tenant_{workspace_slug}
  product_id: string // UUID
  product_version: number // Snapshotted at license creation
  student_limit: number | null
  staff_limit: number | null
  default_language: string
  uses_divisions: boolean
}

/**
 * Soft Lock Request DTO
 */
export interface SoftLockRequest {
  grace_period_days?: number // default 90, min 1, max 365
  reason?: string // optional audit reason
}

/**
 * Unlock Request DTO
 */
export interface UnlockRequest {
  reason?: string // optional audit reason
}

/**
 * Archive Request DTO
 */
export interface ArchiveRequest {
  reason?: string // optional audit reason
}

/**
 * Restore Request DTO
 */
export interface RestoreRequest {
  reason?: string // optional audit reason
}

/**
 * Delete Request DTO
 */
export interface DeleteRequest {
  reason?: string // optional audit reason
}

/**
 * Retry Provisioning Request DTO
 */
export interface RetryProvisioningRequest {
  reason?: string // optional audit reason
}

/**
 * Audit Log Entry
 *
 * Records all license lifecycle events for traceability.
 */
export interface AuditLogEntry {
  id: string // UUID
  license_id: string // UUID (FK)
  action: 'SOFT_LOCK' | 'UNLOCK' | 'ARCHIVE' | 'RESTORE' | 'DELETE' | 'EDIT' // VARCHAR(50)
  old_status: LicenseStatus | null // status_enum, nullable
  new_status: LicenseStatus | null // status_enum, nullable
  reason: string | null // TEXT, nullable
  correlation_id: string // VARCHAR(100)
  created_at: Date // TIMESTAMP WITH TIME ZONE
}
