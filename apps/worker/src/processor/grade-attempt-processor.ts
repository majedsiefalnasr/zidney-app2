import { logger } from '../../infrastructure/logger'
import { dlqManager } from '../dlq/dlq-manager'
import { gradeAttempt } from '../grading/grader'
import { jobQueue, JobQueueEntry } from '../queue/job-queue'
import { retryHandler } from '../retry/retry-handler'
import {
  GradeAttemptJob,
  isGradeAttemptJob,
  JobResult,
  validateJob,
} from '../types/job-schema'

/**
 * T046: Job processor entry point
 *
 * Main loop for worker:
 * - Dequeue jobs from Redis queue
 * - Validate job schema
 * - Route to appropriate handler
 * - Handle errors and retries
 * - Move to DLQ on max retries
 * - Emit structured logs with correlation_id
 */

export class GradeAttemptProcessor {
  private isRunning = false
  private processingBatch = false

  /**
   * Main processor loop
   */
  async start(
    workspaceId: string,
    batchSize = 1,
    pollIntervalMs = 1000
  ): Promise<void> {
    if (this.isRunning) {
      logger.warn(`Job processor already running for workspace ${workspaceId}`)
      return
    }

    this.isRunning = true
    logger.info(`Job processor started`, {
      workspace_id: workspaceId,
      batch_size: batchSize,
      poll_interval_ms: pollIntervalMs,
    })

    try {
      while (this.isRunning) {
        try {
          await this.processBatch(workspaceId, batchSize)
        } catch (error) {
          logger.error(`Batch processing error`, {
            workspace_id: workspaceId,
            error: error instanceof Error ? error.message : String(error),
          })
        }

        // Poll interval before next batch
        await sleep(pollIntervalMs)
      }
    } finally {
      this.isRunning = false
      logger.info(`Job processor stopped`, {
        workspace_id: workspaceId,
      })
    }
  }

  /**
   * Stop the processor
   */
  stop(): void {
    logger.info(`Stopping job processor`)
    this.isRunning = false
  }

  /**
   * Process a batch of jobs
   */
  private async processBatch(
    workspaceId: string,
    batchSize: number
  ): Promise<void> {
    if (this.processingBatch) {
      return // Prevent concurrent batches
    }

    this.processingBatch = true

    try {
      for (let i = 0; i < batchSize; i++) {
        const job = await jobQueue.dequeue(workspaceId)

        if (!job) {
          break // No more jobs in queue
        }

        await this.processJob(job)
      }
    } finally {
      this.processingBatch = false
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: JobQueueEntry): Promise<void> {
    const startTime = Date.now()
    const correlationId = job.correlation_id || 'unknown'

    try {
      logger.info(`Job processing started`, {
        job_id: job.job_id,
        job_type: job.type,
        workspace_id: job.workspace_id,
        correlation_id: correlationId,
        retry_count: job.retry_count,
      })

      // Parse job payload
      let parsedJob: GradeAttemptJob

      try {
        parsedJob = JSON.parse(JSON.stringify(job)) as GradeAttemptJob
      } catch (e) {
        throw new Error(`Invalid job format: ${(e as Error).message}`)
      }

      // Validate job schema
      if (!validateJob(parsedJob)) {
        throw new Error('Job validation failed: missing required fields')
      }

      // Route to appropriate handler
      if (isGradeAttemptJob(parsedJob)) {
        await this.handleGradeAttempt(parsedJob)
      } else {
        throw new Error(`Unknown job type: ${job.type}`)
      }

      logger.info(`Job processing completed`, {
        job_id: job.job_id,
        job_type: job.type,
        workspace_id: job.workspace_id,
        correlation_id: correlationId,
        duration_ms: Date.now() - startTime,
      })
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)

      logger.error(`Job processing error`, {
        job_id: job.job_id,
        job_type: job.type,
        workspace_id: job.workspace_id,
        correlation_id: correlationId,
        retry_count: job.retry_count,
        max_retries: job.max_retries,
        error: errorMessage,
        duration_ms: Date.now() - startTime,
      })

      // Handle retry or DLQ
      await this.handleJobError(job, error as Error)
    }
  }

  /**
   * Handle grade attempt job
   */
  private async handleGradeAttempt(job: GradeAttemptJob): Promise<void> {
    const result = await gradeAttempt(
      job.attempt_id,
      job.workspace_id,
      job.user_id,
      job.attempt_snapshot,
      job.submission_data,
      job.correlation_id
    )

    // Store result in Redis
    const jobResult: JobResult = {
      job_id: job.job_id,
      status: 'completed',
      result,
      completed_at: new Date().toISOString(),
    }

    await jobQueue.storeResult(jobResult)
  }

  /**
   * Handle job error - retry or DLQ
   */
  private async handleJobError(
    job: JobQueueEntry,
    error: Error
  ): Promise<void> {
    if (job.retry_count < job.max_retries) {
      // Retry with exponential backoff
      const backoffMs = await retryHandler.calculateBackoff(job.retry_count)

      await jobQueue.reenqueue(job, backoffMs)

      logger.info(`Job requeued for retry`, {
        job_id: job.job_id,
        retry_count: job.retry_count + 1,
        backoff_ms: backoffMs,
      })
    } else {
      // Move to DLQ
      await dlqManager.moveToDLQ(job, error.message, error.stack || '')

      logger.warn(`Job moved to DLQ`, {
        job_id: job.job_id,
        final_error: error.message,
        retry_count: job.retry_count,
      })
    }
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const gradeAttemptProcessor = new GradeAttemptProcessor()
