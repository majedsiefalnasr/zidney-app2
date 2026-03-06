/**
 * Job Processor - Handles job dequeue, verification, and lifecycle logging.
 *
 * Responsibilities:
 * - Dequeue jobs from Redis
 * - Verify payload hash consistency (detect mutations)
 * - Extract and propagate dual IDs (request_id + job_id)
 * - Log job lifecycle events (received, processing, completed, failed)
 * - Manage retry logic with incremented retry_count
 * - Route jobs to appropriate handlers
 *
 * Per clarification Q3: Dual ID tracking enables end-to-end request correlation.
 * Per clarification Q5: Payload hash verification detects configuration mutations (non-blocking).
 */

import { getHashMismatchDetails, verifyPayloadHashConsistency } from '@zidney/domain-core/job-hash'
import { logger as baseLogger, type Logger } from '@zidney/logger'
import type { JobEnvelope } from '@zidney/types/job-envelope'
import { dequeueJob, moveToDeadLetter, retryJob } from './queue'

/**
 * Job handler type definition.
 * Each job type has a specific handler that processes its payload.
 */
export type JobHandler<T = any> = (
  job: JobEnvelope<T>,
  logger: any
) => Promise<{ success: boolean; error?: Error }>

/** Registry of job handlers by job type */
const jobHandlers: Map<string, JobHandler> = new Map()

function createJobLogger(job: JobEnvelope): Logger {
  const context: Record<string, unknown> = {
    job_id: job.job_id,
    request_id: job.request_id,
    workspace_id: job.workspace_id,
    job_name: job.job_name,
  }

  if (job.user_id) {
    context.user_id = job.user_id
  }
  if (job.attempt_id) {
    context.attempt_id = job.attempt_id
  }

  return baseLogger.child(context)
}

/**
 * Register a job handler for a specific job type.
 *
 * @param job_type - Job type name (e.g., 'finalize_attempt')
 * @param handler - Handler function
 */
export function registerJobHandler(job_type: string, handler: JobHandler): void {
  jobHandlers.set(job_type, handler)
  baseLogger.info('handler_registered', { job_type })
}

/**
 * Process a dequeued job with full lifecycle logging and error handling.
 *
 * Flow:
 * 1. Dequeue job from Redis
 * 2. Verify payload hash (detect mutations)
 * 3. Create job-scoped child logger (dual ID injection)
 * 4. Execute appropriate job handler
 * 5. Log completion/failure
 * 6. Handle retries or dead-letter
 *
 * @param job_type - Queue type to process
 * @param timeout_seconds - Dequeue timeout
 * @throws Error if dequeue or processing fails
 */
export async function processJob(job_type: string, timeout_seconds: number = 0): Promise<void> {
  // Step 1: Dequeue job
  const job = await dequeueJob(job_type, timeout_seconds)

  if (!job) {
    baseLogger.debug('queue_empty', { queue: job_type })
    return
  }

  // Step 2: Verify payload hash consistency
  const hashMatch = verifyPayloadHashConsistency(job.payload, job.payload_hash)
  if (!hashMatch) {
    const mismatchDetails = getHashMismatchDetails(job.payload, job.payload_hash)
    baseLogger.warn('config_mutation_detected', {
      job_id: job.job_id,
      request_id: job.request_id,
      ...mismatchDetails,
    })
    // Note: Hash mismatch is non-blocking per clarification Q5
  }

  // Step 3: Create job-scoped child logger with dual IDs
  const jobLogger = createJobLogger(job)

  jobLogger.info({
    event: 'job_received',
    job_type: job.job_name,
    queue_wait_ms: Date.now() - new Date(job.created_at).getTime(),
    retry_count: job.retry_count,
    payload_hash_valid: hashMatch,
  })

  // Step 4: Find and execute handler
  const handler = jobHandlers.get(job.job_name)

  if (!handler) {
    jobLogger.error({
      event: 'job_handler_not_found',
      job_type: job.job_name,
      available_handlers: Array.from(jobHandlers.keys()),
    })

    // Move to DLQ (no handler available)
    await moveToDeadLetter(job, `No handler registered for job type: ${job.job_name}`)
    return
  }

  let processingError: Error | null = null
  const startTime = Date.now()

  try {
    jobLogger.debug({
      event: 'job_processing_started',
      handler_type: job.job_name,
    })

    // Update job status
    job.processing_started_at = new Date().toISOString()
    job.status = 'SUCCESS'

    // Execute handler
    const result = await handler(job, jobLogger)

    if (!result.success && result.error) {
      processingError = result.error
      job.status = 'FAILED'
      throw result.error
    }

    job.completed_at = new Date().toISOString()

    // Step 5a: Log successful completion
    jobLogger.info({
      event: 'job_completed',
      job_type: job.job_name,
      duration_ms: Date.now() - startTime,
      payload_hash_valid: hashMatch,
    })
  } catch (error) {
    processingError = error instanceof Error ? error : new Error(String(error))
    const duration = Date.now() - startTime

    jobLogger.error({
      event: 'job_failed',
      job_type: job.job_name,
      error_code: processingError.name,
      error_message: processingError.message,
      duration_ms: duration,
      retry_count: job.retry_count,
      max_retries: job.max_retries,
      payload_hash_valid: hashMatch,
    })

    // Step 6: Handle retries or dead-letter
    const shouldRetry = await retryJob(job)

    if (!shouldRetry) {
      jobLogger.error({
        event: 'job_dead_lettered',
        job_type: job.job_name,
        final_retry_count: job.retry_count,
        max_retries: job.max_retries,
        error_message: processingError.message,
      })
    } else {
      jobLogger.warn({
        event: 'job_retry_scheduled',
        job_type: job.job_name,
        next_retry_count: job.retry_count + 1,
        max_retries: job.max_retries,
      })
    }
  }
}

/**
 * Process jobs from all registered types continuously.
 *
 * Runs indefinitely, polling queues in round-robin fashion.
 * Suitable for worker service main loop.
 *
 * @param dequeue_timeout - Blocking dequeue timeout (seconds)
 * @param poll_interval - Minimum interval between job attempts (ms)
 */
export async function startJobProcessor(
  dequeue_timeout: number = 0,
  poll_interval: number = 100
): Promise<void> {
  baseLogger.info('processor_started', {
    registered_job_types: Array.from(jobHandlers.keys()),
  })

  const jobTypes = Array.from(jobHandlers.keys())

  if (jobTypes.length === 0) {
    throw new Error('No job handlers registered')
  }

  let typeIndex = 0

  // Infinite loop: round-robin through job queues

  while (true) {
    try {
      const currentType = jobTypes[typeIndex % jobTypes.length]!

      // Process one job from current queue
      await processJob(currentType, dequeue_timeout)

      typeIndex++

      // Small delay to prevent CPU spinning on empty queues
      if (poll_interval > 0) {
        await new Promise((resolve) => setTimeout(resolve, poll_interval))
      }
    } catch (error) {
      baseLogger.error('processor_error', {
        error_message: error instanceof Error ? error.message : String(error),
      })

      // Continue processing despite errors (resilient loop)
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}
