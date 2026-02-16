import { createHash } from 'crypto'
import { readFileSync } from 'fs'

/**
 * T055: Migration Enqueue Utility
 * Enqueues migrations to worker for async execution (T054)
 */

export interface MigrationTask {
  workspace_id: string
  task_id: string
  from_version: string
  to_version: string
  migration_file_checksum: string
  migration_file_path: string
  enqueued_at: string
}

/**
 * Read and calculate migration file checksum
 */
function calculateMigrationChecksum(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8')
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Enqueue migration task to worker queue
 * @param options - Enqueue options with Redis publisher
 * @returns Task ID
 */
export async function enqueueMigration(options: {
  workspaceId: string
  fromVersion: string
  toVersion: string
  filePath: string
  redisClient?: any // Redis client for task publishing
  taskQueue?: string // Custom queue name (default: schema-migration)
}): Promise<string> {
  const {
    workspaceId,
    fromVersion,
    toVersion,
    filePath,
    redisClient,
    taskQueue = 'schema-migration',
  } = options

  // Generate task ID
  const taskId = `mig-${workspaceId}-${Date.now()}-${Math.random().toString(36).substring(7)}`

  // Calculate checksum
  const checksum = calculateMigrationChecksum(filePath)

  // Create task payload
  const migrationTask: MigrationTask = {
    workspace_id: workspaceId,
    task_id: taskId,
    from_version: fromVersion,
    to_version: toVersion,
    migration_file_checksum: checksum,
    migration_file_path: filePath,
    enqueued_at: new Date().toISOString(),
  }

  // Publish to queue (if Redis available)
  if (redisClient) {
    try {
      await redisClient.lpush(taskQueue, JSON.stringify(migrationTask))
      console.log(
        `[MIGRATION] Task enqueued: ${taskId} (${fromVersion} → ${toVersion})`
      )
    } catch (err: any) {
      console.error(`[MIGRATION] Failed to enqueue: ${err.message}`)
      throw new Error(`Failed to enqueue migration: ${err.message}`)
    }
  } else {
    console.warn(
      `[MIGRATION] No Redis client provided. Task would be: ${JSON.stringify(migrationTask)}`
    )
  }

  return taskId
}

/**
 * Track migration progress in Redis
 */
export async function trackMigrationProgress(options: {
  taskId: string
  workspaceId: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED'
  redisClient?: any
}): Promise<void> {
  const { taskId, workspaceId, status, redisClient } = options

  if (redisClient) {
    const key = `migration:${workspaceId}:${taskId}`
    await redisClient.setex(key, 86400, status) // 24h TTL
  }
}

/**
 * Retrieve migration task status
 */
export async function getMigrationStatus(options: {
  taskId: string
  workspaceId: string
  redisClient?: any
}): Promise<string | null> {
  const { taskId, workspaceId, redisClient } = options

  if (redisClient) {
    const key = `migration:${workspaceId}:${taskId}`
    return await redisClient.get(key)
  }

  return null
}

/**
 * Check if migration is already in progress
 */
export async function isMigrationInProgress(options: {
  workspaceId: string
  redisClient?: any
}): Promise<boolean> {
  const { workspaceId, redisClient } = options

  if (redisClient) {
    const key = `migration-in-progress:${workspaceId}`
    const inProgress = await redisClient.get(key)
    return !!inProgress
  }

  return false
}

/**
 * Mark migration as in progress
 */
export async function setMigrationInProgress(options: {
  workspaceId: string
  taskId: string
  redisClient?: any
  ttl?: number // Default 24h
}): Promise<void> {
  const { workspaceId, taskId, redisClient, ttl = 86400 } = options

  if (redisClient) {
    const key = `migration-in-progress:${workspaceId}`
    await redisClient.setex(key, ttl, taskId)
  }
}

/**
 * Clear migration in progress flag
 */
export async function clearMigrationInProgress(options: {
  workspaceId: string
  redisClient?: any
}): Promise<void> {
  const { workspaceId, redisClient } = options

  if (redisClient) {
    const key = `migration-in-progress:${workspaceId}`
    await redisClient.del(key)
  }
}
