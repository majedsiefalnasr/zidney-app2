/**
 * Provisioning Job Types
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Centralized type definitions for provisioning jobs queued to Redis.
 * Every job follows this schema for serialization/deserialization.
 *
 * Workers consume jobs using these types, ensuring type safety
 * across API → Queue → Worker pipeline.
 */

import { ProvisioningErrorCode } from '../errors/provisioning-errors'

/**
 * Job Status enum
 * Tracks job lifecycle from enqueue to completion or dead letter.
 */
export enum ProvisioningJobStatus {
  QUEUED = 'QUEUED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
  DEAD_LETTERED = 'DEAD_LETTERED',
}

/**
 * Retry Policy Configuration
 * Defines retry behavior for failed jobs.
 */
export interface RetryPolicy {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitterFactor: number
}

/**
 * Provisioning Job Payload
 *
 * This is the complete job specification sent to the Worker.
 * All fields are immutable after job creation.
 *
 * Payload includes all state needed to provision a workspace
 * without querying external services (idempotency guarantee).
 */
export interface ProvisioningJob {
  // Core identification
  jobId: string
  id?: string // Alias for jobId (for compatibility)
  licenseId: string
  correlationId: string

  // Workspace configuration (snapshot at creation time)
  workspaceSlug: string
  organizationName: string
  adminEmail: string
  productId: string

  // Capacity limits
  studentLimit: number
  staffLimit: number

  // Feature flags
  usesDivisions: boolean
  defaultLanguage: string
  language?: string // Optional alias for defaultLanguage
  timezone?: string // Workspace timezone for scheduling

  // Versioning (frozen at license creation)
  schemaVersion: string
  productVersion: string

  // Retry policy embedded in job
  retryPolicy: RetryPolicy

  // Execution metadata
  createdAt: string // ISO 8601 timestamp
  enqueuedAt: string
  processedAt?: string
  completedAt?: string

  // Tracking
  attemptNumber: number
  retryCount?: number // Separate retry counter for handlers
  currentStep?: ProvisioningStep // Current step in provisioning pipeline
  status: ProvisioningJobStatus
  lastError?: {
    code: ProvisioningErrorCode
    message: string
    timestamp: string
  }

  // Worker metadata
  workerId?: string
  lockKey?: string // Redis lock identifier
  lockAcquiredAt?: string

  // Idempotency tracking
  idempotencyKey: string
}

/**
 * Intermediate Job Status
 * Tracks progress through provisioning pipeline.
 */
export enum ProvisioningStep {
  INITIALIZED = 'INITIALIZED',
  VALIDATE_LICENSE = 'VALIDATE_LICENSE',
  LICENSE_VALIDATED = 'LICENSE_VALIDATED',
  ACQUIRE_LOCK = 'ACQUIRE_LOCK',
  LOCK_ACQUIRED = 'LOCK_ACQUIRED',
  CHECK_IDEMPOTENCY = 'CHECK_IDEMPOTENCY',
  IDEMPOTENCY_CHECKED = 'IDEMPOTENCY_CHECKED',
  CREATE_DATABASE = 'CREATE_DATABASE',
  DATABASE_CREATED = 'DATABASE_CREATED',
  RUN_MIGRATIONS = 'RUN_MIGRATIONS',
  MIGRATIONS_APPLIED = 'MIGRATIONS_APPLIED',
  SEED_DATA = 'SEED_DATA',
  SEED_DATA_INSERTED = 'SEED_DATA_INSERTED',
  CREATE_ADMIN_ACCOUNT = 'CREATE_ADMIN_ACCOUNT',
  ADMIN_ACCOUNT_CREATED = 'ADMIN_ACCOUNT_CREATED',
  INSERT_REGISTRY = 'INSERT_REGISTRY',
  REGISTRY_INSERTED = 'REGISTRY_INSERTED',
  ACTIVATE_LICENSE = 'ACTIVATE_LICENSE',
  LICENSE_ACTIVATED = 'LICENSE_ACTIVATED',
  RELEASE_LOCK = 'RELEASE_LOCK',
  LOCK_RELEASED = 'LOCK_RELEASED',
  LOG_SUCCESS = 'LOG_SUCCESS',
  COMPLETED = 'COMPLETED',
}

/**
 * Job Processing Result
 * Returned after job execution to determine next action.
 */
export interface ProvisioningJobResult {
  jobId: string
  status: ProvisioningJobStatus
  step: ProvisioningStep
  success: boolean
  error?: {
    code: ProvisioningErrorCode
    message: string
    details?: Record<string, unknown>
  }
  duration: number // milliseconds
  metadata?: {
    dbName?: string
    registryId?: string
    databaseSize?: number
    migrationsApplied?: number
  }
}

/**
 * Dead Letter Queue Entry
 * Jobs that exhaust retries are moved to DLQ for operator review.
 */
export interface ProvisioningJobDLQEntry {
  originalJob: ProvisioningJob
  failedAt: string // ISO 8601 timestamp
  finalError: {
    code: ProvisioningErrorCode
    message: string
  }
  totalAttempts: number
  logs: Array<{
    timestamp: string
    level: 'INFO' | 'WARN' | 'ERROR'
    message: string
    correlationId: string
  }>
  operatorAction?: string
}

/**
 * Job Queue Configuration
 * Defines queue behavior and consumer settings.
 */
export interface JobQueueConfig {
  queueName: string
  consumerGroup: string
  consumerName: string
  maxConcurrentJobs: number
  visibilityTimeout: number // seconds
  lockTTL: number // seconds
  metricsInterval: number // seconds
  maxDeadLetterRetention: number // hours
}

/**
 * Default Retry Policy
 * Used if job doesn't specify custom policy.
 */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 60000, // 1 minute
  backoffMultiplier: 2,
  jitterFactor: 0.1, // ±10% random jitter
}

/**
 * Default Job Queue Configuration
 */
export const DEFAULT_QUEUE_CONFIG: JobQueueConfig = {
  queueName: 'provisioning:jobs',
  consumerGroup: 'provisioning-worker',
  consumerName: 'provisioning-consumer',
  maxConcurrentJobs: 10,
  visibilityTimeout: 300, // 5 minutes
  lockTTL: 30, // 30 seconds distributed lock
  metricsInterval: 60, // 1 minute
  maxDeadLetterRetention: 504, // 3 weeks
}

/**
 * Job Creation Factory
 * Constructs provisioning job with all required fields.
 */
export function createProvisioningJob(
  input: Omit<
    ProvisioningJob,
    | 'jobId'
    | 'correlationId'
    | 'createdAt'
    | 'enqueuedAt'
    | 'attemptNumber'
    | 'status'
    | 'idempotencyKey'
  > & {
    correlationId: string
    idempotencyKey?: string
  }
): ProvisioningJob {
  const jobId = crypto.randomUUID()
  const now = new Date().toISOString()

  return {
    ...input,
    jobId,
    correlationId: input.correlationId,
    createdAt: now,
    enqueuedAt: now,
    attemptNumber: 1,
    status: ProvisioningJobStatus.QUEUED,
    idempotencyKey: input.idempotencyKey || jobId,
    retryPolicy: input.retryPolicy || DEFAULT_RETRY_POLICY,
  }
}
