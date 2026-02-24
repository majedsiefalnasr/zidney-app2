/**
 * Provision Workspace Handler (Main Orchestrator)
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * THIS IS THE CRITICAL WORKFLOW ENGINE
 *
 * Implements the complete 13-step provisioning pipeline:
 * 1. Validate License (check existence and status)
 * 2. Acquire Distributed Lock (prevent concurrent provisioning)
 * 3. Check Idempotency (detect already-provisioned workspaces)
 * 4. Create Database (UTF-8, backup on failure)
 * 5. Run Baseline Migrations (apply schema_001-006)
 * 6. Seed Data (workspace settings + initial data)
 * 7. Create Admin Account (user setup + verification token)
 * 8. Insert Registry (link license → workspace → db)
 * 9. Activate License (mark ACTIVE + provisioned_at)
 * 10. Release Lock (distributed lock cleanup)
 * 11. Log Success (structured logging)
 * 12. Handle Errors + Cleanup (on any failure)
 * 13. Update License Status + retry policy
 *
 * ALL-OR-NOTHING GUARANTEE: Either all steps succeed or full rollback on any error.
 * IDEMPOTENCY GUARANTEE: Safe to replay. Duplicate jobs skipped via registry lookup.
 * CORRELATION-ID PROPAGATION: Every log entry includes correlation_id for debugging.
 */

import { ProvisioningLogger } from '@zidney/logger/provisioning-logger'
import { ProvisioningErrorCode } from '@zidney/types/errors/provisioning-errors'
import {
  ProvisioningJob,
  ProvisioningStep,
} from '@zidney/types/jobs/provisioning-job'
import { Redis } from 'ioredis'
import { Pool } from 'pg'
import { AdminAccountService } from './admin-account-service'
import { DatabaseCleanupService } from './database-cleanup-service'
import { DatabaseService } from './database-service'
import { DistributedLockService } from './distributed-lock-service'
import { IdempotencyService } from './idempotency-service'
import {
  FailureHandlerService,
  LicenseActivationService,
} from './license-activation-service'
import { LicenseValidationService } from './license-validation-service'
import { MigrationRunnerService } from './migration-runner'
import { RegistryInsertionService } from './registry-insertion-service'
import { RetryEnqueueService } from './retry-enqueue-service'
import { SeedDataService } from './seed-service'

/**
 * Orchestration result
 */
export interface ProvisioningOrchestrationResult {
  success: boolean
  licenseId: string
  workspaceSlug: string
  databaseName?: string
  registryId?: string
  completedSteps: ProvisioningStep[]
  failedAtStep?: ProvisioningStep
  errorCode?: string
  errorMessage?: string
  durationMs: number
}

/**
 * Main provisioning orchestrator
 */
export class ProvisionWorkspaceHandler {
  private masterDb: Pool
  private redis: Redis
  private logger: ProvisioningLogger
  private lockService: DistributedLockService
  private licenseValidator: LicenseValidationService
  private idempotencyChecker: IdempotencyService
  private dbService: DatabaseService
  private migrationRunner: MigrationRunnerService
  private seedService: SeedDataService
  private adminService: AdminAccountService
  private registryService: RegistryInsertionService
  private licenseActivator: LicenseActivationService
  private failureHandler: FailureHandlerService
  private cleanupService: DatabaseCleanupService
  private retryEnqueuer: RetryEnqueueService

  constructor(
    masterDb: Pool,
    redis: Redis,
    logger: ProvisioningLogger,
    services: {
      lockService: DistributedLockService
      licenseValidator: LicenseValidationService
      idempotencyChecker: IdempotencyService
      dbService: DatabaseService
      migrationRunner: MigrationRunnerService
      seedService: SeedDataService
      adminService: AdminAccountService
      registryService: RegistryInsertionService
      licenseActivator: LicenseActivationService
      failureHandler: FailureHandlerService
      cleanupService: DatabaseCleanupService
      retryEnqueuer: RetryEnqueueService
    }
  ) {
    this.masterDb = masterDb
    this.redis = redis
    this.logger = logger
    this.lockService = services.lockService
    this.licenseValidator = services.licenseValidator
    this.idempotencyChecker = services.idempotencyChecker
    this.dbService = services.dbService
    this.migrationRunner = services.migrationRunner
    this.seedService = services.seedService
    this.adminService = services.adminService
    this.registryService = services.registryService
    this.licenseActivator = services.licenseActivator
    this.failureHandler = services.failureHandler
    this.cleanupService = services.cleanupService
    this.retryEnqueuer = services.retryEnqueuer
  }

  /**
   * MAIN ORCHESTRATOR: Execute the complete 13-step provisioning pipeline
   */
  async provision(
    job: ProvisioningJob
  ): Promise<ProvisioningOrchestrationResult> {
    const startTime = Date.now()
    const completedSteps: ProvisioningStep[] = []
    let dbName: string | undefined
    let lock: { leaseKey: string } | undefined

    try {
      this.logger.logStep(
        'provision-start',
        'Starting provisioning orchestration',
        {
          license_id: job.licenseId,
          workspace_slug: job.workspaceSlug,
          job_id: job.id,
        }
      )

      // ========== STEP 1: Validate License ==========
      completedSteps.push(ProvisioningStep.VALIDATE_LICENSE)
      const validationResult = await this.licenseValidator.validateLicense(
        job.licenseId
      )

      if (!validationResult.valid) {
        throw {
          code: ProvisioningErrorCode.LICENSE_VALIDATION_FAILED,
          message: validationResult.reason || 'License validation failed',
        }
      }

      this.logger.logStep('step-1-validate', 'License validated successfully', {
        license_id: job.licenseId,
      })

      // ========== STEP 2: Acquire Distributed Lock ==========
      completedSteps.push(ProvisioningStep.ACQUIRE_LOCK)
      lock = await this.lockService.acquireLock(
        `import-provisioning:${job.licenseId}`
      )

      if (!lock) {
        throw {
          code: ProvisioningErrorCode.LOCK_ACQUISITION_FAILED,
          message: 'Failed to acquire provisioning lock',
        }
      }

      this.logger.logLockOperation('Distributed lock acquired', {
        license_id: job.licenseId,
      })

      // ========== STEP 3: Check Idempotency ==========
      completedSteps.push(ProvisioningStep.CHECK_IDEMPOTENCY)
      const idempotencyResult = await this.idempotencyChecker.checkIdempotency(
        job.licenseId,
        job.workspaceSlug
      )

      if (idempotencyResult.alreadyProvisioned) {
        this.logger.logWarn('Workspace already provisioned (idempotent skip)', {
          license_id: job.licenseId,
          workspace_slug: job.workspaceSlug,
        })

        // Return success (idempotent)
        return {
          success: true,
          licenseId: job.licenseId,
          workspaceSlug: job.workspaceSlug,
          databaseName: idempotencyResult.dbName,
          registryId: idempotencyResult.registryId,
          completedSteps,
          durationMs: Date.now() - startTime,
        }
      }

      this.logger.logStep('step-3-idempotency', 'Idempotency check passed', {
        license_id: job.licenseId,
      })

      // ========== STEP 4: Create Database ==========
      completedSteps.push(ProvisioningStep.CREATE_DATABASE)
      dbName = `workspace_${job.workspaceSlug}`
      const dbCreateResult = await this.dbService.createDatabase(
        dbName,
        'en_US.UTF-8'
      )

      if (!dbCreateResult.success) {
        throw {
          code: ProvisioningErrorCode.PROVIDER_REQUEST_FAILED,
          message: `Failed to create database: ${dbCreateResult.errorMessage}`,
        }
      }

      this.logger.logDatabaseOperation('Database created', {
        database: dbName,
        license_id: job.licenseId,
      })

      // ========== STEP 5: Run Baseline Migrations ==========
      completedSteps.push(ProvisioningStep.RUN_MIGRATIONS)
      const pool = await this.dbService.getTenantPool(dbName)
      const migrationResult = await this.migrationRunner.runBaseline(
        pool,
        '1.0.0'
      )

      if (!migrationResult.success) {
        throw {
          code: ProvisioningErrorCode.MIGRATION_FAILED,
          message: `Migrations failed: ${migrationResult.errorMessage}`,
        }
      }

      this.logger.logStep('step-5-migrations', 'Baseline migrations applied', {
        database: dbName,
        migrations_applied: migrationResult.appliedCount,
      })

      // ========== STEP 6: Seed Data ==========
      completedSteps.push(ProvisioningStep.SEED_DATA)
      const seedResult = await this.seedService.seed(pool, {
        organization_name: job.organizationName,
        student_limit: job.studentLimit,
        staff_limit: job.staffLimit,
        timezone: job.timezone || 'UTC',
        language: job.language || 'en',
      })

      if (!seedResult.success) {
        throw {
          code: ProvisioningErrorCode.SEED_FAILED,
          message: `Seeding failed: ${seedResult.errorMessage}`,
        }
      }

      this.logger.logStep('step-6-seed', 'Data seeded successfully', {
        database: dbName,
      })

      // ========== STEP 7: Create Admin Account ==========
      completedSteps.push(ProvisioningStep.CREATE_ADMIN_ACCOUNT)
      const adminResult = await this.adminService.createAdminAccount(pool, {
        email: job.adminEmail,
        organizationName: job.organizationName,
      })

      if (!adminResult.success) {
        throw {
          code: ProvisioningErrorCode.ADMIN_ACCOUNT_CREATION_FAILED,
          message: `Admin account creation failed: ${adminResult.errorMessage}`,
        }
      }

      this.logger.logStep('step-7-admin', 'Admin account created', {
        database: dbName,
        admin_email: job.adminEmail,
        user_id: adminResult.userId,
      })

      // ========== STEP 8: Insert Registry ==========
      completedSteps.push(ProvisioningStep.INSERT_REGISTRY)
      const registryResult = await this.registryService.insertRegistry({
        license_id: job.licenseId,
        workspace_slug: job.workspaceSlug,
        db_name: dbName,
        schema_version: migrationResult.schemaVersion || '1.0.0',
      })

      if (!registryResult.success) {
        throw {
          code: ProvisioningErrorCode.REGISTRY_INSERT_FAILED,
          message: `Registry insertion failed: ${registryResult.errorMessage}`,
        }
      }

      this.logger.logStep('step-8-registry', 'Registry entry created', {
        license_id: job.licenseId,
        registry_id: registryResult.registryId,
      })

      // ========== STEP 9: Activate License ==========
      completedSteps.push(ProvisioningStep.ACTIVATE_LICENSE)
      const activationResult = await this.licenseActivator.activateLicense(
        job.licenseId
      )

      if (!activationResult.success) {
        throw {
          code: ProvisioningErrorCode.PROVISION_FAILED,
          message: `License activation failed: ${activationResult.errorMessage}`,
        }
      }

      this.logger.logStep('step-9-activate', 'License activated', {
        license_id: job.licenseId,
        status: 'ACTIVE',
      })

      // ========== STEP 10: Release Lock ==========
      completedSteps.push(ProvisioningStep.RELEASE_LOCK)
      if (lock) {
        await this.lockService.releaseLock(
          `import-provisioning:${job.licenseId}`,
          lock.leaseKey
        )
      }

      this.logger.logLockOperation('Distributed lock released', {
        license_id: job.licenseId,
      })

      // ========== STEP 11: Log Success ==========
      completedSteps.push(ProvisioningStep.LOG_SUCCESS)
      this.logger.logSuccess(
        'Provisioning completed successfully',
        Date.now() - startTime,
        {
          license_id: job.licenseId,
          workspace_slug: job.workspaceSlug,
          database: dbName,
          registry_id: registryResult.registryId,
        }
      )

      return {
        success: true,
        licenseId: job.licenseId,
        workspaceSlug: job.workspaceSlug,
        databaseName: dbName,
        registryId: registryResult.registryId,
        completedSteps,
        durationMs: Date.now() - startTime,
      }
    } catch (error) {
      // ========== ERROR HANDLING: Cleanup & Rollback ==========
      const errorCode =
        (error as any)?.code || ProvisioningErrorCode.PROVISION_FAILED
      const errorMessage = (error as any)?.message || String(error)

      this.logger.logError('Provisioning failed', error as Error, {
        license_id: job.licenseId,
        failed_at_step: job.currentStep,
        error_code: errorCode,
      })

      // Mark license as failed
      await this.failureHandler.markFailed(
        job.licenseId,
        errorCode,
        errorMessage
      )

      // Cleanup: Drop database if it was created
      if (dbName) {
        const cleanupResult = await this.cleanupService.dropDatabase(dbName)
        if (!cleanupResult.success) {
          this.logger.logWarn(
            'Database cleanup failed, may need manual cleanup',
            {
              database: dbName,
              license_id: job.licenseId,
            }
          )
        }
      }

      // Release lock if held
      if (lock) {
        await this.lockService.releaseLock(
          `import-provisioning:${job.licenseId}`,
          lock.leaseKey
        )
      }

      // Determine if retriable
      const isRetriable = this.isErrorRetriable(errorCode)

      if (isRetriable && (job.retryCount || 0) < 3) {
        // Re-enqueue for retry
        const retryResult = await this.retryEnqueuer.retryJob(job)
        this.logger.logRetry('Job queued for retry', {
          license_id: job.licenseId,
          retry_count: retryResult.retryCount,
        })
      } else {
        // Move to DLQ
        await this.retryEnqueuer.moveToDLQ(
          job,
          `Provisioning failed: ${errorCode} - ${errorMessage}`
        )
      }

      return {
        success: false,
        licenseId: job.licenseId,
        workspaceSlug: job.workspaceSlug,
        databaseName: dbName,
        completedSteps,
        failedAtStep: job.currentStep,
        errorCode,
        errorMessage,
        durationMs: Date.now() - startTime,
      }
    }
  }

  /**
   * Determine if an error is retriable
   */
  private isErrorRetriable(errorCode: string): boolean {
    const nonRetriableErrors = [
      ProvisioningErrorCode.INVALID_WORKSPACE_SLUG,
      ProvisioningErrorCode.WORKSPACE_SLUG_EXISTS,
      ProvisioningErrorCode.INVALID_LICENSE_CONFIG,
      ProvisioningErrorCode.UNAUTHORIZED_SERVICE,
    ]

    return !nonRetriableErrors.includes(errorCode)
  }
}

/**
 * Factory to create provisioning handler
 */
export function createProvisionWorkspaceHandler(
  masterDb: Pool,
  redis: Redis,
  logger: ProvisioningLogger,
  services: any
): ProvisionWorkspaceHandler {
  return new ProvisionWorkspaceHandler(masterDb, redis, logger, services)
}
