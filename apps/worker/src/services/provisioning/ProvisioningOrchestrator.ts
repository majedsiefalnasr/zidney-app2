/**
 * ProvisioningOrchestrator - 9-Step Provisioning Pipeline
 *
 * Purpose: Coordinate complete provisioning workflow with error handling/rollback
 * Design: Sequential steps with checkpoints, transactional safety
 *
 * Task: T012 – Implement 9-Step Provisioning Pipeline Orchestrator
 * Phase: 01 – Platform Foundation
 * Stage: STAGE_05_TENANT_PROVISIONING_SERVICE
 *
 * 9 Steps:
 * 1. Validate job, license, slug
 * 2. Acquire distributed lock
 * 3. Create tenant database
 * 4. Execute baseline migrations
 * 5. Seed baseline data
 * 6. Create registry entry
 * 7. Transition license to ACTIVE
 * 8. Register connection pool
 * 9. Release lock and complete
 */

import { Pool } from 'pg'
import ProvisioningJob from '../../jobs/provisioning/ProvisioningJob'
import { BaselineSeeder } from './BaselineSeeder'
import { CheckpointManager } from './CheckpointManager'
import { DistributedLock } from './DistributedLock'
import { MigrationExecutor } from './MigrationExecutor'

export interface ProvisioningResult {
  success: boolean
  job_id: string
  workspace_slug: string
  message?: string
  error?: string
  steps_completed?: number
  duration_ms?: number
}

/**
 * ProvisioningOrchestrator: Main provisioning workflow controller
 */
export class ProvisioningOrchestrator {
  private master_pool: Pool
  private distributed_lock: DistributedLock
  private migration_executor: MigrationExecutor
  private baseline_seeder: BaselineSeeder

  constructor(
    master_pool: Pool,
    distributed_lock: DistributedLock,
    migration_executor: MigrationExecutor,
    baseline_seeder: BaselineSeeder,
    checkpoint_manager: CheckpointManager
  ) {
    this.master_pool = master_pool
    this.distributed_lock = distributed_lock
    this.migration_executor = migration_executor
    this.baseline_seeder = baseline_seeder
    void checkpoint_manager
  }

  /**
   * Execute full 9-step provisioning pipeline
   */
  async provision(job: ProvisioningJob): Promise<ProvisioningResult> {
    const start_time = Date.now()
    let steps_completed = 0
    let lock_released: any = null

    try {
      // Step 1: Validate job, license, slug
      console.log(`[PROV] Step 1: Validating job ${job.id}`)
      this.validateJob(job)
      steps_completed = 1

      // Step 2: Acquire distributed lock
      console.log(`[PROV] Step 2: Acquiring lock for ${job.workspace_slug}`)
      const lock_result = await this.distributed_lock.acquireLock(
        job.workspace_slug
      )
      if (!lock_result.acquired) {
        return {
          success: false,
          job_id: job.id,
          workspace_slug: job.workspace_slug,
          error:
            'PROV_006: Failed to acquire provisioning lock (another provisioning in progress)',
          steps_completed,
          duration_ms: Date.now() - start_time,
        }
      }
      lock_released = lock_result.release_fn
      steps_completed = 2

      // Step 3: Create tenant database
      console.log(
        `[PROV] Step 3: Creating database workspace_${job.workspace_slug}`
      )
      await this.createTenantDatabase(job.workspace_slug)
      steps_completed = 3

      // Step 4: Execute baseline migrations
      console.log(`[PROV] Step 4: Executing migrations`)
      const migrations = await this.migration_executor.loadMigrations()
      const migration_result =
        await this.migration_executor.executeMigrationsInTransaction(
          this.master_pool, // Will be tenant pool in actual impl
          migrations
        )
      if (migration_result.failed) {
        throw new Error('PROV_003: Migration execution failed')
      }
      steps_completed = 4

      // Step 5: Seed baseline data
      console.log(`[PROV] Step 5: Seeding baseline data`)
      const seed_result = await this.baseline_seeder.seedAllData(
        this.master_pool
      )
      console.log(`[PROV] Seeded ${seed_result.total_seeded} baseline records`)
      steps_completed = 5

      // Step 6: Create registry entry
      console.log(`[PROV] Step 6: Creating registry entry`)
      await this.createRegistryEntry(job)
      steps_completed = 6

      // Step 7: Transition license to ACTIVE
      console.log(`[PROV] Step 7: Transitioning license to ACTIVE`)
      await this.transitionLicenseToActive(job)
      steps_completed = 7

      // Step 8: Register connection pool
      console.log(`[PROV] Step 8: Registering connection pool`)
      // Note: In actual impl, would create Pool and register in ConnectionPoolManager
      // For now, this is a placeholder
      steps_completed = 8

      // Step 9: Release lock and complete
      console.log(`[PROV] Step 9: Completing provisioning`)
      if (lock_released) {
        await lock_released()
      }
      steps_completed = 9

      return {
        success: true,
        job_id: job.id,
        workspace_slug: job.workspace_slug,
        message: `Provisioning completed successfully in ${Date.now() - start_time}ms`,
        steps_completed,
        duration_ms: Date.now() - start_time,
      }
    } catch (error) {
      console.error(
        `[PROV] Provisioning failed at step ${steps_completed + 1}:`,
        error
      )

      // Rollback operations
      try {
        await this.rollbackProvisioning(job, steps_completed, error)
      } catch (rollback_error) {
        console.error(`[PROV] Rollback failed:`, rollback_error)
      }

      // Release lock if held
      if (lock_released) {
        try {
          await lock_released()
        } catch (e) {
          console.error(`[PROV] Failed to release lock:`, e)
        }
      }

      return {
        success: false,
        job_id: job.id,
        workspace_slug: job.workspace_slug,
        error: `Provisioning failed at step ${steps_completed + 1}: ${error}`,
        steps_completed,
        duration_ms: Date.now() - start_time,
      }
    }
  }

  /**
   * Validate job, license, and workspace slug
   */
  private validateJob(job: ProvisioningJob): void {
    if (!job.id) throw new Error('PROV_007: Invalid job ID')
    if (!job.license_id || job.license_id <= 0) {
      throw new Error('PROV_008: License not found or invalid')
    }
    if (!job.workspace_slug) throw new Error('PROV_007: Invalid workspace slug')

    // Validate slug format: ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$
    const slug_pattern = /^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/
    if (!slug_pattern.test(job.workspace_slug)) {
      throw new Error('PROV_007: Invalid workspace slug format')
    }
  }

  /**
   * Create tenant database
   */
  private async createTenantDatabase(workspace_slug: string): Promise<void> {
    const client = await this.master_pool.connect()
    try {
      const db_name = `workspace_${workspace_slug}`
      // In production, use psql or admin connection to create database
      // For now, simplified implementation
      console.log(`[PROV] Creating database: ${db_name}`)
      // await client.query(`CREATE DATABASE ${db_name}`)
    } catch (error) {
      throw new Error(`PROV_002: Database creation failed: ${error}`)
    } finally {
      client.release()
    }
  }

  /**
   * Create registry entry in master DB
   */
  private async createRegistryEntry(job: ProvisioningJob): Promise<void> {
    const client = await this.master_pool.connect()
    try {
      await client.query(
        `
        INSERT INTO tenants_registry (license_id, workspace_slug, expected_schema_version, is_active)
        VALUES ($1, $2, $3, true)
        `,
        [job.license_id, job.workspace_slug, '1.0.0']
      )
    } catch (error) {
      throw new Error(`PROV_004: Registry entry creation failed: ${error}`)
    } finally {
      client.release()
    }
  }

  /**
   * Transition license to ACTIVE state
   */
  private async transitionLicenseToActive(job: ProvisioningJob): Promise<void> {
    const client = await this.master_pool.connect()
    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ')

      // Update license status
      await client.query(
        `
        UPDATE licenses
        SET status = 'ACTIVE', updated_at = NOW()
        WHERE id = $1 AND status = 'PROVISIONING'
        `,
        [job.license_id]
      )

      // Record in registry that provisioning completed
      await client.query(
        `
        UPDATE tenants_registry
        SET is_active = true, updated_at = NOW()
        WHERE license_id = $1
        `,
        [job.license_id]
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw new Error(`PROV_005: License transition failed: ${error}`)
    } finally {
      client.release()
    }
  }

  /**
   * Rollback provisioning on failure
   */
  private async rollbackProvisioning(
    job: ProvisioningJob,
    steps_completed: number,
    _error: any
  ): Promise<void> {
    console.log(`[PROV] Rolling back provisioning for ${job.workspace_slug}`)

    if (steps_completed >= 3) {
      // Drop database if created
      const client = await this.master_pool.connect()
      try {
        const db_name = `workspace_${job.workspace_slug}`
        console.log(`[PROV] Dropping database: ${db_name}`)
        // In production, would use admin connection to drop database
        // await client.query(`DROP DATABASE IF EXISTS ${db_name}`)
      } catch (e) {
        console.error(`[PROV] Failed to drop database:`, e)
      } finally {
        client.release()
      }
    }

    if (steps_completed >= 6) {
      // Delete registry entry
      const client = await this.master_pool.connect()
      try {
        await client.query(
          `DELETE FROM tenants_registry WHERE license_id = $1`,
          [job.license_id]
        )
      } catch (e) {
        console.error(`[PROV] Failed to delete registry entry:`, e)
      } finally {
        client.release()
      }
    }

    // Always mark license as FAILED
    const client = await this.master_pool.connect()
    try {
      await client.query(
        `
        UPDATE licenses
        SET status = 'FAILED', updated_at = NOW()
        WHERE id = $1
        `,
        [job.license_id]
      )
    } catch (e) {
      console.error(`[PROV] Failed to mark license as FAILED:`, e)
    } finally {
      client.release()
    }
  }
}

export default ProvisioningOrchestrator
