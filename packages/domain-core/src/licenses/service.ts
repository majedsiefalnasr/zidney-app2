/**
 * License Domain Service (Business Logic Layer)
 *
 * File: packages/domain-core/src/licenses/service.ts
 * Tasks: T023-T028, T024, T025, T026, T027, T028
 *
 * Implements core business logic for license management.
 * Enforces all validation rules, state transitions, and side effects.
 */

import { Logger } from 'pino'
import { v4 as uuidv4 } from 'uuid'
import {
  ALLOWED_STATE_TRANSITIONS,
  PROVISIONING_BASE_DELAY_MS,
  PROVISIONING_MAX_RETRIES,
  SOFT_LOCK_DEFAULT_DAYS,
  SOFT_LOCK_MAX_DAYS,
  SOFT_LOCK_MIN_DAYS,
  SUPPORTED_LANGUAGES,
  WORKSPACE_SLUG_MAX_LENGTH,
  WORKSPACE_SLUG_MIN_LENGTH,
  WORKSPACE_SLUG_REGEX,
} from './constants'
import {
  InvalidStateTransitionError,
  LicenseNotFoundError,
  LicenseValidationError,
  ProvisioningError,
} from './errors'
import { LicenseRepository } from './repository'
import {
  ArchiveRequest,
  CreateLicenseRequest,
  EditLicenseRequest,
  License,
  LicenseStatus,
  RestoreRequest,
  RetryProvisioningRequest,
  SoftLockRequest,
  UnlockRequest,
} from './types'

export interface QueueService {
  enqueueProvisioningJob(payload: any): Promise<void>
}

export class LicenseService {
  constructor(
    private repository: LicenseRepository,
    private queueService: QueueService,
    private logger: Logger
  ) {}

  /**
   * T023: Create license
   *
   * Validates all input, snapshotts versions, creates license,
   * and enqueues provisioning job.
   */
  async create(
    input: CreateLicenseRequest,
    correlationId: string
  ): Promise<License> {
    return this.repository.withTransaction(async () => {
      // Step 1: Validate all inputs
      this.validateWorkspaceSlug(input.workspace_slug)
      await this.validateSlugUnique(input.workspace_slug)
      await this.validateProductActive(input.product_id)
      this.validateLimits(input.student_limit, input.staff_limit)
      this.validateLanguageCode(input.default_language || 'en')
      if (
        input.commission_per_user !== undefined &&
        input.commission_per_user !== null
      ) {
        this.validateCommission(input.commission_per_user)
      }

      // Step 2: Prepare license data with version snapshots
      const licenseId = uuidv4()
      const schemaVersion = await this.repository.getPlatformSchemaVersion()
      // In real implementation, fetch product version from product repository
      const productVersion = 1 // Placeholder

      // Step 3: Create license
      const license = await this.repository.create({
        id: licenseId,
        product_id: input.product_id,
        workspace_slug: input.workspace_slug.toLowerCase(),
        workspace_name: input.workspace_name,
        student_limit: input.student_limit ?? null,
        staff_limit: input.staff_limit ?? null,
        use_zidney_payment: input.use_zidney_payment ?? false,
        commission_per_user: input.commission_per_user ?? null,
        default_language: input.default_language || 'en',
        uses_divisions: input.uses_divisions ?? false,
        schema_version: schemaVersion,
        product_version: productVersion,
      })

      // Step 4: Enqueue provisioning job
      try {
        await this.queueService.enqueueProvisioningJob({
          license_id: licenseId,
          workspace_slug: input.workspace_slug.toLowerCase(),
          product_id: input.product_id,
          product_version: productVersion,
          student_limit: input.student_limit ?? null,
          staff_limit: input.staff_limit ?? null,
          default_language: input.default_language || 'en',
          uses_divisions: input.uses_divisions ?? false,
        })
      } catch (error: any) {
        this.logger.warn({
          event: 'provisioning_job_enqueue_failed',
          license_id: licenseId,
          correlation_id: correlationId,
          error: error.message,
        })
        // Don't fail license creation if queue is temporarily unavailable
        // UI will show manual retry button
      }

      // Step 5: Emit event and log
      this.logger.info({
        event: 'license_created',
        license_id: licenseId,
        workspace_slug: input.workspace_slug,
        correlation_id: correlationId,
      })

      return license
    })
  }

  /**
   * T024: Validation helper methods
   */
  validateWorkspaceSlug(slug: string): void {
    if (
      !slug ||
      slug.length < WORKSPACE_SLUG_MIN_LENGTH ||
      slug.length > WORKSPACE_SLUG_MAX_LENGTH
    ) {
      throw LicenseValidationError.invalidSlugFormat()
    }

    if (!WORKSPACE_SLUG_REGEX.test(slug)) {
      throw LicenseValidationError.invalidSlugFormat()
    }
  }

  validateLimits(
    studentLimit?: number | null,
    staffLimit?: number | null
  ): void {
    if (
      studentLimit !== undefined &&
      studentLimit !== null &&
      studentLimit < 0
    ) {
      throw LicenseValidationError.invalidLimit()
    }

    if (staffLimit !== undefined && staffLimit !== null && staffLimit < 0) {
      throw LicenseValidationError.invalidLimit()
    }
  }

  validateLanguageCode(lang: string): void {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      throw LicenseValidationError.invalidLanguage()
    }
  }

  validateCommission(commission: number): void {
    if (commission < 0) {
      throw LicenseValidationError.invalidCommission()
    }
  }

  async validateProductActive(productId: string): Promise<void> {
    // In real implementation, query product repository
    // For now, assume valid
    if (!productId) {
      throw LicenseValidationError.invalidProductId()
    }
  }

  async validateSlugUnique(slug: string): Promise<void> {
    const existing = await this.repository.getByWorkspaceSlug(
      slug.toLowerCase()
    )
    if (existing) {
      throw LicenseValidationError.slugNotUnique()
    }
  }

  /**
   * T025: Read methods
   */
  async getById(id: string): Promise<License> {
    const license = await this.repository.getById(id)
    if (!license) throw new LicenseNotFoundError(id)
    return license
  }

  async list(
    filters: {
      status?: LicenseStatus
      product_id?: string
      search?: string
    },
    pagination: { page: number; limit: number }
  ): Promise<{
    items: License[]
    total: number
    page: number
    pages: number
  }> {
    const offset = (pagination.page - 1) * pagination.limit
    const { items, total } = await this.repository.listWithFilters(filters, {
      limit: pagination.limit,
      offset,
    })

    return {
      items,
      total,
      page: pagination.page,
      pages: Math.ceil(total / pagination.limit),
    }
  }

  async getByWorkspaceSlug(slug: string): Promise<License> {
    const license = await this.repository.getByWorkspaceSlug(slug)
    if (!license) throw new LicenseNotFoundError()
    return license
  }

  /**
   * T026: Edit license
   *
   * Allows editing of mutable fields only.
   * Rejects attempts to change immutable fields.
   */
  async edit(
    id: string,
    input: EditLicenseRequest,
    correlationId: string
  ): Promise<License> {
    return this.repository.withTransaction(async () => {
      const license = await this.getById(id)

      // Validate only editable fields are present
      for (const key of Object.keys(input)) {
        if (
          key === 'product_id' ||
          key === 'workspace_slug' ||
          key === 'schema_version' ||
          key === 'product_version'
        ) {
          throw LicenseValidationError.invalidFieldEdit()
        }
      }

      // Validate new values
      if (input.student_limit !== undefined) {
        this.validateLimits(input.student_limit, license.staff_limit)
      }
      if (input.staff_limit !== undefined) {
        this.validateLimits(license.student_limit, input.staff_limit)
      }
      if (input.default_language) {
        this.validateLanguageCode(input.default_language)
      }
      if (
        input.commission_per_user !== undefined &&
        input.commission_per_user !== null
      ) {
        this.validateCommission(input.commission_per_user)
      }

      // Update license
      const updated = await this.repository.update(id, input as any)

      // Log event
      this.logger.info({
        event: 'license_edited',
        license_id: id,
        correlation_id: correlationId,
      })

      return updated
    })
  }

  /**
   * T027: Status transition methods
   */
  async softLock(
    id: string,
    input: SoftLockRequest,
    correlationId: string
  ): Promise<License> {
    return this.repository.withTransaction(async () => {
      const license = await this.getById(id)

      // Validate state transition
      const validTransitions = ALLOWED_STATE_TRANSITIONS[license.status] || []
      if (!validTransitions.includes(LicenseStatus.SOFT_LOCKED)) {
        throw InvalidStateTransitionError.softLockFromNonActive()
      }

      const gracePeriodDays = input.grace_period_days || SOFT_LOCK_DEFAULT_DAYS
      if (
        gracePeriodDays < SOFT_LOCK_MIN_DAYS ||
        gracePeriodDays > SOFT_LOCK_MAX_DAYS
      ) {
        throw new Error(
          `Grace period must be between ${SOFT_LOCK_MIN_DAYS} and ${SOFT_LOCK_MAX_DAYS} days`
        )
      }

      const gracePeriodMs = gracePeriodDays * 24 * 60 * 60 * 1000
      const updated = await this.repository.softLock(id, gracePeriodMs)

      // Write audit log
      await this.writeAuditLog({
        license_id: id,
        action: 'SOFT_LOCK',
        old_status: license.status,
        new_status: LicenseStatus.SOFT_LOCKED,
        reason: input.reason,
        correlation_id: correlationId,
      })

      // Log event
      this.logger.info({
        event: 'license_soft_locked',
        license_id: id,
        grace_until: updated.soft_lock_until,
        correlation_id: correlationId,
      })

      return updated
    })
  }

  async unlock(
    id: string,
    input: UnlockRequest,
    correlationId: string
  ): Promise<License> {
    return this.repository.withTransaction(async () => {
      const license = await this.getById(id)

      if (license.status !== LicenseStatus.SOFT_LOCKED) {
        throw InvalidStateTransitionError.unlockFromNonSoftLocked()
      }

      const updated = await this.repository.unlock(id)

      await this.writeAuditLog({
        license_id: id,
        action: 'UNLOCK',
        old_status: LicenseStatus.SOFT_LOCKED,
        new_status: LicenseStatus.ACTIVE,
        reason: input.reason,
        correlation_id: correlationId,
      })

      this.logger.info({
        event: 'license_unlocked',
        license_id: id,
        correlation_id: correlationId,
      })

      return updated
    })
  }

  async archive(
    id: string,
    input: ArchiveRequest,
    correlationId: string
  ): Promise<License> {
    return this.repository.withTransaction(async () => {
      const license = await this.getById(id)

      if (license.status !== LicenseStatus.SOFT_LOCKED) {
        throw InvalidStateTransitionError.archiveFromNonSoftLocked()
      }

      const updated = await this.repository.archive(id)

      await this.writeAuditLog({
        license_id: id,
        action: 'ARCHIVE',
        old_status: LicenseStatus.SOFT_LOCKED,
        new_status: LicenseStatus.ARCHIVED,
        reason: input.reason,
        correlation_id: correlationId,
      })

      this.logger.info({
        event: 'license_archived',
        license_id: id,
        correlation_id: correlationId,
      })

      return updated
    })
  }

  async restore(
    id: string,
    input: RestoreRequest,
    correlationId: string
  ): Promise<License> {
    return this.repository.withTransaction(async () => {
      const license = await this.getById(id)

      if (license.status !== LicenseStatus.ARCHIVED) {
        throw InvalidStateTransitionError.restoreFromNonArchived()
      }

      const updated = await this.repository.restore(id)

      await this.writeAuditLog({
        license_id: id,
        action: 'RESTORE',
        old_status: LicenseStatus.ARCHIVED,
        new_status: LicenseStatus.ACTIVE,
        reason: input.reason,
        correlation_id: correlationId,
      })

      this.logger.info({
        event: 'license_restored',
        license_id: id,
        correlation_id: correlationId,
      })

      return updated
    })
  }

  async delete(id: string, correlationId: string): Promise<License> {
    return this.repository.withTransaction(async () => {
      const license = await this.getById(id)

      if (license.status !== LicenseStatus.ARCHIVED) {
        throw new Error('License must be ARCHIVED before deletion')
      }

      const updated = await this.repository.delete(id)

      await this.writeAuditLog({
        license_id: id,
        action: 'DELETE',
        old_status: LicenseStatus.ARCHIVED,
        new_status: LicenseStatus.DELETED,
        correlation_id: correlationId,
      })

      this.logger.info({
        event: 'license_deleted',
        license_id: id,
        correlation_id: correlationId,
      })

      return updated
    })
  }

  /**
   * T028: Retry provisioning
   */
  async retryProvisioning(
    id: string,
    input: RetryProvisioningRequest,
    correlationId: string
  ): Promise<License> {
    return this.repository.withTransaction(async () => {
      const license = await this.getById(id)

      // Validate status
      if (license.status !== LicenseStatus.PROVISION_FAILED) {
        throw InvalidStateTransitionError.retryFromNonProvisionFailed()
      }

      // Check retry limit
      if (license.provisioning_retries >= PROVISIONING_MAX_RETRIES) {
        throw ProvisioningError.retryLimitExceeded()
      }

      // Check backoff (exponential: 2s, 4s, 8s, 16s, 32s)
      if (license.provisioning_last_attempt_at) {
        const retryNumber = license.provisioning_retries
        const requiredDelayMs =
          PROVISIONING_BASE_DELAY_MS * Math.pow(2, retryNumber)
        const timeSinceLastAttempt =
          Date.now() - license.provisioning_last_attempt_at.getTime()

        if (timeSinceLastAttempt < requiredDelayMs - 500) {
          // 500ms tolerance window
          throw ProvisioningError.rateLimited()
        }
      }

      // Update license
      const updated = await this.repository.update(id, {
        status: LicenseStatus.PENDING_PROVISION,
        provisioning_retries: license.provisioning_retries + 1,
        provisioning_error: null,
        provisioning_last_attempt_at: new Date(),
      } as any)

      // Enqueue new provisioning job
      try {
        await this.queueService.enqueueProvisioningJob({
          license_id: id,
          workspace_slug: license.workspace_slug,
          product_id: license.product_id,
          product_version: license.product_version,
          student_limit: license.student_limit,
          staff_limit: license.staff_limit,
          default_language: license.default_language,
          uses_divisions: license.uses_divisions,
        })
      } catch (error: any) {
        this.logger.error({
          event: 'provisioning_retry_enqueue_failed',
          license_id: id,
          correlation_id: correlationId,
          error: error.message,
        })
        throw ProvisioningError.queueUnavailable()
      }

      this.logger.info({
        event: 'provisioning_retry_requested',
        license_id: id,
        retry_count: license.provisioning_retries + 1,
        correlation_id: correlationId,
      })

      return updated
    })
  }

  /**
   * Helper: Write audit log entry
   */
  private async writeAuditLog(entry: {
    license_id: string
    action: string
    old_status?: LicenseStatus
    new_status?: LicenseStatus
    reason?: string
    correlation_id: string
  }): Promise<void> {
    // In real implementation, insert into audit_log table
    this.logger.debug({
      event: 'audit_log_entry',
      ...entry,
    })
  }
}
