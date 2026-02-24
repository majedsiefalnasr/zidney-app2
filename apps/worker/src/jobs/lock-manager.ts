/**
 * Workspace write lock acquisition (Task 24)
 * Serializes concurrent upgrades per workspace
 */

import { Pool } from 'pg'

export interface LockHandle {
  workspace_id: string
  acquiredAt: Date
  timeoutMs: number
}

/**
 * Acquire exclusive write lock for workspace
 * Uses SELECT...FOR UPDATE pattern with timeout
 * @throws Error if timeout or workspace not found
 */
export async function acquireWorkspaceLock(
  workspace_id: string,
  masterDb: Pool,
  timeoutMs: number = 60000
): Promise<LockHandle> {
  try {
    // Set statement timeout
    await masterDb.query(`SET statement_timeout = $1`, [timeoutMs])

    // Acquire row-level write lock
    const result = await masterDb.query(
      `SELECT id FROM tenants_registry WHERE id = $1 FOR UPDATE NOWAIT`,
      [workspace_id]
    )

    if (result.rows.length === 0) {
      throw new Error(`Workspace ${workspace_id} not found`)
    }

    const acquiredAt = new Date()

    console.log(
      JSON.stringify({
        level: 'DEBUG',
        service: 'lock-manager',
        event: 'lock_acquired',
        workspace_id,
        acquired_at: acquiredAt.toISOString(),
        timeout_ms: timeoutMs,
        timestamp: new Date().toISOString(),
      })
    )

    return {
      workspace_id,
      acquiredAt,
      timeoutMs,
    }
  } catch (err: any) {
    if (err.code === '55P03' || err.message.includes('timeout')) {
      const error = new Error(
        `Failed to acquire lock for workspace ${workspace_id} (timeout after ${timeoutMs}ms)`
      )
      ;(error as any).errorCode = 'MIGRATION_LOCK_TIMEOUT'
      throw error
    }

    throw new Error(`Failed to acquire lock: ${err.message}`)
  }
}

/**
 * Release workspace lock (automatic on transaction end)
 * Explicit call not needed - PostgreSQL releases on COMMIT/ROLLBACK
 */
export async function releaseWorkspaceLock(
  lockHandle: LockHandle,
  _masterDb: Pool
): Promise<void> {
  console.log(
    JSON.stringify({
      level: 'DEBUG',
      service: 'lock-manager',
      event: 'lock_released',
      workspace_id: lockHandle.workspace_id,
      held_for_ms: Date.now() - lockHandle.acquiredAt.getTime(),
      timestamp: new Date().toISOString(),
    })
  )
  // No action needed - lock released automatically on transaction end
}
