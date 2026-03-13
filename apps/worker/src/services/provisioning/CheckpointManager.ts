/**
 * CheckpointManager - Manage provisioning checkpoint for crash recovery
 *
 * Purpose: Write/read checkpoints for safe recovery from worker crashes
 * Design: After each step, write checkpoint; on retry, resume from last checkpoint
 *
 * Task: T013 – Implement Checkpoint Read/Write (Crash Recovery)
 * Phase: 01 – Platform Foundation
 * Stage: STAGE_05_TENANT_PROVISIONING_SERVICE
 */

import { logger } from '@zidney/logger'
import type { PoolClient } from 'pg'

export enum ProvisioningStep {
  DB_CREATED = 'DB_CREATED',
  MIGRATIONS_STARTED = 'MIGRATIONS_STARTED',
  MIGRATION_001_APPLIED = 'MIGRATION_001_APPLIED',
  MIGRATION_002_APPLIED = 'MIGRATION_002_APPLIED',
  MIGRATION_003_APPLIED = 'MIGRATION_003_APPLIED',
  MIGRATION_004_APPLIED = 'MIGRATION_004_APPLIED',
  SEED_DATA_APPLIED = 'SEED_DATA_APPLIED',
  REGISTRY_ENTRY_CREATED = 'REGISTRY_ENTRY_CREATED',
  LICENSE_TRANSITIONED = 'LICENSE_TRANSITIONED',
}

export interface Checkpoint {
  id: string
  step: string
  step_ordinal: number
  completed_at: string
  payload?: unknown
  correlation_id: string
}

/**
 * CheckpointManager: Manages provisioning checkpoints for recovery
 */
export class CheckpointManager {
  private step_ordinals: Map<string, number> = new Map([
    [ProvisioningStep.DB_CREATED, 1],
    [ProvisioningStep.MIGRATIONS_STARTED, 2],
    [ProvisioningStep.MIGRATION_001_APPLIED, 3],
    [ProvisioningStep.MIGRATION_002_APPLIED, 4],
    [ProvisioningStep.MIGRATION_003_APPLIED, 5],
    [ProvisioningStep.MIGRATION_004_APPLIED, 6],
    [ProvisioningStep.SEED_DATA_APPLIED, 7],
    [ProvisioningStep.REGISTRY_ENTRY_CREATED, 8],
    [ProvisioningStep.LICENSE_TRANSITIONED, 9],
  ])

  /**
   * Write checkpoint after step completes
   * Stored in tenant database for persistence across worker crashes
   */
  async writeCheckpoint(
    client: PoolClient,
    step: string,
    ordinal: number,
    payload: unknown,
    correlation_id: string
  ): Promise<void> {
    try {
      await client.query(
        `
        INSERT INTO provisioning_checkpoints (step, step_ordinal, payload, correlation_id, completed_at)
        VALUES ($1, $2, $3, $4, NOW())
        `,
        [step, ordinal, payload ? JSON.stringify(payload) : null, correlation_id]
      )
    } catch (error) {
      logger.error('checkpoint_write_failed', { step, error: String(error) })
      throw error
    }
  }

  /**
   * Read latest checkpoint by correlation_id
   * Used to determine recovery point after worker crash
   */
  async readLatestCheckpoint(
    client: PoolClient,
    correlation_id: string
  ): Promise<Checkpoint | null> {
    try {
      const result = await client.query(
        `
        SELECT id, step, step_ordinal, completed_at, payload, correlation_id
        FROM provisioning_checkpoints
        WHERE correlation_id = $1
        ORDER BY step_ordinal DESC
        LIMIT 1
        `,
        [correlation_id]
      )

      if (result.rows.length === 0) {
        return null
      }

      const row = result.rows[0]
      return {
        id: row.id,
        step: row.step,
        step_ordinal: row.step_ordinal,
        completed_at: row.completed_at,
        payload: row.payload ? JSON.parse(row.payload) : null,
        correlation_id: row.correlation_id,
      }
    } catch (error) {
      logger.error('checkpoint_read_failed', { correlation_id, error: String(error) })
      throw error
    }
  }

  /**
   * Get next step to resume from
   * Returns the step after the latest completed checkpoint
   */
  async getNextStep(client: PoolClient, correlation_id: string): Promise<string | null> {
    const latest = await this.readLatestCheckpoint(client, correlation_id)

    if (!latest) {
      // No checkpoints yet, start from beginning
      return ProvisioningStep.DB_CREATED
    }

    // Map from current step ordinal to next step
    const step_order = [
      ProvisioningStep.DB_CREATED,
      ProvisioningStep.MIGRATIONS_STARTED,
      ProvisioningStep.SEED_DATA_APPLIED,
      ProvisioningStep.REGISTRY_ENTRY_CREATED,
      ProvisioningStep.LICENSE_TRANSITIONED,
    ]

    const current_index = step_order.findIndex(
      (s) => this.step_ordinals.get(s) === latest.step_ordinal
    )

    if (current_index === -1 || current_index === step_order.length - 1) {
      // Provisioning complete
      return null
    }

    return step_order[current_index + 1] ?? null
  }

  /**
   * Get all checkpoints for a provisioning job (debugging)
   */
  async getCheckpoints(client: PoolClient, correlation_id: string): Promise<Checkpoint[]> {
    try {
      const result = await client.query(
        `
        SELECT id, step, step_ordinal, completed_at, payload, correlation_id
        FROM provisioning_checkpoints
        WHERE correlation_id = $1
        ORDER BY step_ordinal ASC
        `,
        [correlation_id]
      )

      return result.rows.map((row) => ({
        id: row.id,
        step: row.step,
        step_ordinal: row.step_ordinal,
        completed_at: row.completed_at,
        payload: row.payload ? JSON.parse(row.payload) : null,
        correlation_id: row.correlation_id,
      }))
    } catch (error) {
      logger.error('checkpoint_list_failed', { correlation_id, error: String(error) })
      return []
    }
  }

  /**
   * Check if provisioning already completed (idempotency check)
   */
  async isProvisioningComplete(client: PoolClient, correlation_id: string): Promise<boolean> {
    const latest = await this.readLatestCheckpoint(client, correlation_id)
    return latest !== null && latest.step_ordinal === 9 // Final step
  }

  /**
   * Get ordinal for step (for checkpoint writing)
   */
  getStepOrdinal(step: string): number {
    return this.step_ordinals.get(step) || 0
  }

  /**
   * Get all steps in order
   */
  getAllSteps(): ProvisioningStep[] {
    const ordered = Array.from(this.step_ordinals.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([step]) => step as ProvisioningStep)
    return ordered
  }
}

export default CheckpointManager
