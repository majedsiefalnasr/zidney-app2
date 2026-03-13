/**
 * Worker Task Queue Processor
 *
 * Orchestrates task execution, retry logic, and DLQ escalation.
 * Implements exponential backoff with security-first failure handling.
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 * Task: T027 (queue processor integration)
 */

import { createLogger } from '@zidney/logger'
import type { Pool } from 'pg'
import {
  createDLQMessage,
  type DLQMessage,
  determineTaskAction,
  getRetryDelay,
  shouldAlertOps,
} from '../config/task-configs'
import {
  executeInitTenantSchema,
  type InitTenantSchemaPayload,
  type InitTenantSchemaResult,
} from '../tasks/init-tenant-schema'

export interface QueuedTask {
  id: string
  type: string
  payload: Record<string, unknown>
  attempt: number
  createdAt: string
  nextRetryAt?: string
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'DLQ' | 'FAILED'
  lastError?: string
  correlationId?: string
}

export interface QueueProcessorConfig {
  concurrency: number
  processingTimeout: number // milliseconds
  dlqNotificationWebhook?: string
  enableManualReviewQueue: boolean
}

/**
 * Task Queue Processor
 *
 * Responsibilities:
 * 1. Dequeue tasks from work queue
 * 2. Execute task with dependencies
 * 3. Evaluate result for retry/DLQ decision
 * 4. Schedule retries with exponential backoff
 * 5. Escalate non-retryable failures to DLQ
 * 6. Alert operations on critical failures
 */
export class TaskQueueProcessor {
  private config: QueueProcessorConfig
  private tenantPoolMap: Map<string, Pool> = new Map()
  private logger = createLogger('TaskQueueProcessor')
  private dlqQueue: DLQMessage[] = [] // In-memory DLQ (should be persistent in production)

  constructor(config: Partial<QueueProcessorConfig> = {}) {
    this.config = {
      concurrency: config.concurrency || 5,
      processingTimeout: config.processingTimeout || 60000,
      enableManualReviewQueue: config.enableManualReviewQueue !== false,
      ...config,
    }
  }

  /**
   * Process a single task from the queue
   *
   * @param task - Queued task
   * @returns Updated task with result status
   */
  async processTask(task: QueuedTask): Promise<QueuedTask> {
    const logger = createLogger(`TaskProcessor[${task.id}]`)
    const startTime = Date.now()

    try {
      logger.info('Processing task', {
        type: task.type,
        attempt: task.attempt,
        correlation_id: task.correlationId,
      })

      // Update task status to PROCESSING
      task.status = 'PROCESSING'

      // Execute task based on type
      let result: unknown

      if (task.type === 'INIT_TENANT_SCHEMA') {
        result = await this.processInitTenantSchema(task)
      } else {
        throw new Error(`Unknown task type: ${task.type}`)
      }

      const duration = Date.now() - startTime

      // Determine next action
      const action = determineTaskAction(task.type, result, task.attempt)

      logger.info('Task processed', {
        type: task.type,
        action,
        duration_ms: duration,
        result_status: result.status,
      })

      // Route based on action
      if (action === 'SUCCESS') {
        task.status = 'SUCCESS'
        logger.info('Task completed successfully', {
          duration_ms: duration,
        })
        return task
      }

      if (action === 'DLQ') {
        return this.routeToDLQ(task, result, logger)
      }

      if (action === 'RETRY') {
        return this.scheduleRetry(task, result, logger)
      }
    } catch (error) {
      logger.error('Task processing failed', {
        error: error instanceof Error ? error.message : String(error),
        attempt: task.attempt,
      })

      return this.routeToDLQ(
        task,
        {
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error),
        },
        logger
      )
    }

    return task
  }

  /**
   * Process INIT_TENANT_SCHEMA task
   */
  private async processInitTenantSchema(task: QueuedTask): Promise<InitTenantSchemaResult> {
    const payload = task.payload as InitTenantSchemaPayload
    const { workspace_id } = payload

    // Get or create tenant pool
    const pool = this.tenantPoolMap.get(workspace_id)
    if (!pool) {
      // In production: retrieve pool from resolver
      // For now: create new pool (should be injected from resolver)
      throw new Error(
        `Pool not found for workspace: ${workspace_id}. Initialize via tenant resolver first.`
      )
    }

    // Execute task with full transaction context
    const result = await executeInitTenantSchema(
      payload,
      pool,
      undefined // Redis client optional
    )

    return result
  }

  /**
   * Route task to DLQ (Dead Letter Queue)
   */
  private async routeToDLQ(
    task: QueuedTask,
    result: unknown,
    logger: ReturnType<typeof createLogger>
  ): Promise<QueuedTask> {
    const resultObj = (result ?? {}) as Record<string, unknown>
    const dlqMessage = createDLQMessage(
      task.type,
      task.id,
      (resultObj.workspace_id as string) || 'unknown',
      task.payload,
      resultObj,
      task.attempt
    )

    logger.critical('Task escalated to DLQ', {
      alert_level: dlqMessage.alertLevel,
      requires_manual_review: dlqMessage.requiresManualReview,
    })

    // Store in DLQ
    this.dlqQueue.push(dlqMessage)

    // Send alert notification if configured
    if (this.config.dlqNotificationWebhook) {
      await this.notifyOps(dlqMessage)
    }

    task.status = 'DLQ'
    task.lastError = dlqMessage.lastError

    return task
  }

  /**
   * Schedule task for retry with exponential backoff
   */
  private async scheduleRetry(
    task: QueuedTask,
    result: unknown,
    logger: ReturnType<typeof createLogger>
  ): Promise<QueuedTask> {
    const backoffMs = getRetryDelay(task.type, task.attempt)
    const nextAttempt = task.attempt + 1
    const nextRetryAt = new Date(Date.now() + backoffMs).toISOString()

    logger.warn('Task scheduled for retry', {
      attempt: task.attempt,
      next_attempt: nextAttempt,
      backoff_ms: backoffMs,
      next_retry_at: nextRetryAt,
    })

    // Check if ops should be alerted (e.g., after 2 failures)
    if (shouldAlertOps(task.type, result, task.attempt)) {
      const reason = (result as Record<string, unknown>).error
      logger.warn('Ops alert triggered for retry', {
        attempt: task.attempt,
        reason,
      })
    }

    // Update task for requeue
    task.status = 'PENDING'
    task.attempt = nextAttempt
    task.nextRetryAt = nextRetryAt
    task.lastError = result.error

    // In production: Push back to queue with delay scheduling
    // Example: rabbitMQ with x-dead-letter-exchange + x-message-ttl
    // Or: Bull with job.delay(backoffMs).retry()

    return task
  }

  /**
   * Send alert notification to operations
   */
  private async notifyOps(dlqMessage: DLQMessage): Promise<void> {
    if (!this.config.dlqNotificationWebhook) return

    try {
      const response = await fetch(this.config.dlqNotificationWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dlqMessage),
      })

      if (!response.ok) {
        this.logger.error('Failed to send DLQ notification', {
          status: response.status,
          webhook_url: this.config.dlqNotificationWebhook,
        })
      }
    } catch (error) {
      this.logger.error('DLQ notification webhook error', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Get current DLQ (for inspection/manual review)
   */
  getDLQ(): DLQMessage[] {
    return [...this.dlqQueue]
  }

  /**
   * Manually review and retry DLQ item
   */
  async retryFromDLQ(dlqMessageId: string): Promise<boolean> {
    const index = this.dlqQueue.findIndex((msg) => msg.taskId === dlqMessageId)
    if (index === -1) {
      this.logger.warn('DLQ message not found', {
        dlq_message_id: dlqMessageId,
      })
      return false
    }

    const dlqMessage = this.dlqQueue[index]

    this.logger.info('Manually retrying DLQ message', {
      task_type: dlqMessage.taskType,
      workspace_id: dlqMessage.workspaceId,
    })

    // Remove from DLQ
    this.dlqQueue.splice(index, 1)

    // Requeue (in production: add to worker queue)
    // For now: just mark as prepared

    return true
  }

  /**
   * Register tenant pool for task execution
   */
  registerTenantPool(workspaceId: string, pool: Pool): void {
    this.tenantPoolMap.set(workspaceId, pool)
    this.logger.debug('Tenant pool registered', { workspace_id: workspaceId })
  }

  /**
   * Unregister tenant pool
   */
  unregisterTenantPool(workspaceId: string): void {
    this.tenantPoolMap.delete(workspaceId)
    this.logger.debug('Tenant pool unregistered', { workspace_id: workspaceId })
  }
}

export default {
  TaskQueueProcessor,
}
