/**
 * ProvisioningJob - Job Queue Message Format & Serialization
 *
 * Purpose: Define the contract for provisioning async jobs
 * Used by: Worker queue system (enqueue/dequeue operations)
 *
 * Scope: apps/worker/src/jobs/provisioning/
 * Task: T007 – Design ProvisioningJob class & Job Queue interface
 * Phase: 01 – Platform Foundation
 * Stage: STAGE_05_TENANT_PROVISIONING_SERVICE
 *
 * Design:
 * - Serialize/deserialize between Redis and TypeScript objects
 * - Immutable once created (no state mutations)
 * - Version tracking for future schema migrations of message format
 * - Retry tracking integrated in job object
 */

import { v4 as uuidv4 } from 'uuid'

/**
 * ProvisioningJob: Core job class for provisioning workflow
 *
 * Represents a single tenant provisioning request queued in Redis.
 * Immutable: Properties never modified after creation.
 * Serializable: Can be converted to/from JSON for Redis storage.
 */
export class ProvisioningJob {
  readonly id: string
  readonly license_id: number
  readonly workspace_slug: string
  readonly organization_id: number
  readonly correlation_id: string
  readonly enqueued_at: string // ISO8601 timestamp
  readonly attempt: number // Current retry attempt (1-based)
  readonly max_attempts: number // Maximum retry attempts before DLQ
  readonly version: number = 1 // Message format version

  constructor(
    id: string,
    license_id: number,
    workspace_slug: string,
    organization_id: number,
    correlation_id: string,
    enqueued_at: string,
    attempt: number = 1,
    max_attempts: number = 3,
    version: number = 1
  ) {
    this.id = id
    this.license_id = license_id
    this.workspace_slug = workspace_slug
    this.organization_id = organization_id
    this.correlation_id = correlation_id
    this.enqueued_at = enqueued_at
    this.attempt = attempt
    this.max_attempts = max_attempts
    this.version = version
  }

  /**
   * Create new ProvisioningJob from input parameters
   * Generates new UUID and timestamp if not provided
   */
  static create(
    license_id: number,
    workspace_slug: string,
    organization_id: number,
    correlation_id?: string
  ): ProvisioningJob {
    return new ProvisioningJob(
      uuidv4(),
      license_id,
      workspace_slug,
      organization_id,
      correlation_id || uuidv4(),
      new Date().toISOString(),
      1,
      3,
      1
    )
  }

  /**
   * Serialize job to JSON for Redis storage
   * Returns plain JavaScript object (can be stringified)
   */
  toRedisMessage(): ProvisioningJobMessage {
    return {
      id: this.id,
      license_id: this.license_id,
      workspace_slug: this.workspace_slug,
      organization_id: this.organization_id,
      correlation_id: this.correlation_id,
      enqueued_at: this.enqueued_at,
      attempt: this.attempt,
      max_attempts: this.max_attempts,
      version: this.version,
    }
  }

  /**
   * Deserialize job from Redis message (JSON object)
   * Validates message structure and types
   */
  static fromRedisMessage(message: any): ProvisioningJob {
    // Validate required fields
    if (!message.id || typeof message.id !== 'string') {
      throw new Error('Invalid message: missing or non-string id')
    }
    if (!Number.isInteger(message.license_id) || message.license_id <= 0) {
      throw new Error('Invalid message: license_id must be positive integer')
    }
    if (!message.workspace_slug || typeof message.workspace_slug !== 'string') {
      throw new Error('Invalid message: missing or non-string workspace_slug')
    }
    if (
      !Number.isInteger(message.organization_id) ||
      message.organization_id < 0
    ) {
      throw new Error(
        'Invalid message: organization_id must be non-negative integer'
      )
    }
    if (!message.correlation_id || typeof message.correlation_id !== 'string') {
      throw new Error('Invalid message: missing or non-string correlation_id')
    }
    if (!message.enqueued_at || typeof message.enqueued_at !== 'string') {
      throw new Error('Invalid message: missing or non-string enqueued_at')
    }

    const attempt = message.attempt || 1
    const max_attempts = message.max_attempts || 3
    const version = message.version || 1

    if (!Number.isInteger(attempt) || attempt < 1) {
      throw new Error('Invalid message: attempt must be positive integer')
    }
    if (!Number.isInteger(max_attempts) || max_attempts < 1) {
      throw new Error('Invalid message: max_attempts must be positive integer')
    }

    return new ProvisioningJob(
      message.id,
      message.license_id,
      message.workspace_slug,
      message.organization_id,
      message.correlation_id,
      message.enqueued_at,
      attempt,
      max_attempts,
      version
    )
  }

  /**
   * Check if job is retryable (not exceeded max attempts)
   */
  isRetryable(): boolean {
    return this.attempt < this.max_attempts
  }

  /**
   * Create new instance with incremented attempt count
   * Returns new object (original unmodified)
   */
  markAttempt(): ProvisioningJob {
    return new ProvisioningJob(
      this.id,
      this.license_id,
      this.workspace_slug,
      this.organization_id,
      this.correlation_id,
      this.enqueued_at,
      this.attempt + 1,
      this.max_attempts,
      this.version
    )
  }

  /**
   * Get formatted log context for structured logging
   */
  toLogContext(): Record<string, any> {
    return {
      job_id: this.id,
      license_id: this.license_id,
      workspace_slug: this.workspace_slug,
      organization_id: this.organization_id,
      correlation_id: this.correlation_id,
      attempt: this.attempt,
      max_attempts: this.max_attempts,
      is_retryable: this.isRetryable(),
    }
  }
}

/**
 * ProvisioningJobMessage: Redis message format (plain object)
 * Used for serialization/deserialization
 */
export interface ProvisioningJobMessage {
  id: string
  license_id: number
  workspace_slug: string
  organization_id: number
  correlation_id: string
  enqueued_at: string
  attempt: number
  max_attempts: number
  version: number
}

/**
 * JobQueue: Interface for job queue operations
 * Defines the contract for (de)queueing provisioning jobs
 */
export interface IJobQueue {
  /**
   * Enqueue job to provisioning queue
   * @param job - ProvisioningJob to enqueue
   */
  enqueue(job: ProvisioningJob): Promise<void>

  /**
   * Dequeue next job from provisioning queue
   * @param timeout_seconds - Wait timeout in seconds (0 = non-blocking)
   * @returns Next job or null if queue empty or timeout
   */
  dequeue(timeout_seconds?: number): Promise<ProvisioningJob | null>

  /**
   * Acknowledge job (remove from processing set)
   * @param job_id - Job ID to acknowledge
   */
  ack(job_id: string): Promise<void>

  /**
   * Negative acknowledge job (return to queue with backoff)
   * @param job_id - Job ID to nack
   * @param retried_job - Job with incremented attempt count
   */
  nack(job_id: string, retried_job: ProvisioningJob): Promise<void>

  /**
   * Peek at pending jobs without removing them
   * @param limit - Maximum jobs to peek (default 10)
   * @returns Array of pending jobs
   */
  peek(limit?: number): Promise<ProvisioningJob[]>

  /**
   * Get DLQ jobs that exceeded max attempts
   * @param limit - Maximum DLQ jobs to retrieve (default 10)
   */
  peekDLQ(limit?: number): Promise<ProvisioningJob[]>

  /**
   * Move job to DLQ after final failed attempt
   * @param job_id - Job ID to move to DLQ
   * @param failed_job - Failed job object with error context
   */
  moveToDLQ(job_id: string, failed_job: ProvisioningJob): Promise<void>

  /**
   * Get queue statistics
   */
  getStats(): Promise<{
    pending_count: number
    processing_count: number
    dlq_count: number
  }>
}

/**
 * JobQueueConfig: Configuration for job queue behavior
 */
export interface JobQueueConfig {
  queue_name: string
  processing_set_name: string
  dlq_name: string
  dequeue_timeout_seconds: number
  dequeue_batch_size: number
  retry_backoff_multiplier: number
  retry_backoff_base_seconds: number
  max_retry_backoff_seconds: number
}

/**
 * Default job queue configuration
 */
export const DEFAULT_JOB_QUEUE_CONFIG: JobQueueConfig = {
  queue_name: 'provisioning_jobs',
  processing_set_name: 'provisioning_jobs:processing',
  dlq_name: 'provisioning_jobs:dlq',
  dequeue_timeout_seconds: 5,
  dequeue_batch_size: 5,
  retry_backoff_multiplier: 2,
  retry_backoff_base_seconds: 5,
  max_retry_backoff_seconds: 60,
}

export default ProvisioningJob
