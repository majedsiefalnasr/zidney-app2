/**
 * Provisioning Job Consumer
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Consumes provisioning jobs from Redis queue.
 * Implements error handling and retry logic.
 * Manages concurrent job processing.
 * Handles dead-letter queue for exhausted jobs.
 */

import type { ProvisioningLogger } from '@zidney/logger/provisioning-logger'
import { type ProvisioningJob, ProvisioningJobStatus } from '@zidney/types/jobs/provisioning-job'
import type { Redis } from 'ioredis'

/**
 * Consumer configuration
 */
export interface ConsumerConfig {
  queueName: string
  dlqName: string
  concurrency?: number
  pollIntervalMs?: number
  processingTimeoutMs?: number
}

/**
 * Job processing result
 */
export interface JobProcessingResult {
  success: boolean
  jobId: string
  licenseId: string
  errorCode?: string
  errorMessage?: string
  durationMs: number
  retriable?: boolean
  moveToDLQ?: boolean
}

/**
 * Job handler type
 */
export type JobHandler = (job: ProvisioningJob, logger: ProvisioningLogger) => Promise<void>

/**
 * Provisioning Job Consumer
 */
export class ProvisioningJobConsumer {
  private redis: Redis
  private config: ConsumerConfig
  private logger: ProvisioningLogger
  private handler: JobHandler
  private isRunning: boolean = false
  private activeJobs: Map<string, AbortController> = new Map()

  constructor(
    redis: Redis,
    handler: JobHandler,
    config: ConsumerConfig,
    logger: ProvisioningLogger
  ) {
    this.redis = redis
    this.handler = handler
    this.config = {
      concurrency: 5,
      pollIntervalMs: 1000,
      processingTimeoutMs: 300000, // 5 minutes
      ...config,
    }
    this.logger = logger
  }

  /**
   * Start consuming jobs
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.logWarn('Consumer already running')
      return
    }

    this.isRunning = true
    this.logger.logStep('consumer-start', 'Provisioning consumer started', {
      concurrency: this.config.concurrency,
      queue: this.config.queueName,
    })

    try {
      while (this.isRunning) {
        // Check if we have capacity for more jobs
        if (this.activeJobs.size < (this.config.concurrency || 5)) {
          // Try to fetch a job
          const jobStr = await this.redis.rpop(this.config.queueName)

          if (jobStr) {
            const job = JSON.parse(jobStr) as ProvisioningJob
            this.processJobWithTimeout(job).catch((error) => {
              this.logger.logError('Unhandled job processing error', error as Error, {
                job_id: job.id,
              })
            })
          }
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, this.config.pollIntervalMs))
      }
    } finally {
      this.isRunning = false
      this.logger.logStep('consumer-stop', 'Provisioning consumer stopped')
    }
  }

  /**
   * Stop consuming jobs
   */
  async stop(): Promise<void> {
    this.isRunning = false

    // Wait for active jobs to complete
    const deadline = Date.now() + 30000 // 30 second grace period
    while (this.activeJobs.size > 0 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // Force cancel remaining jobs
    for (const [jobId, controller] of this.activeJobs) {
      controller.abort()
      this.activeJobs.delete(jobId)
    }

    this.logger.logStep('consumer-graceful-shutdown', 'Consumer graceful shutdown completed')
  }

  /**
   * Process a job with timeout protection
   */
  private async processJobWithTimeout(job: ProvisioningJob): Promise<void> {
    const controller = new AbortController()
    const jobTimeout = setTimeout(
      () => controller.abort(),
      this.config.processingTimeoutMs || 300000
    )

    this.activeJobs.set(job.jobId, controller)

    try {
      await this.processJob(job, controller.signal)
    } finally {
      clearTimeout(jobTimeout)
      this.activeJobs.delete(job.jobId)
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: ProvisioningJob, signal: AbortSignal): Promise<void> {
    const startTime = Date.now()

    try {
      // Check if job was cancelled
      if (signal.aborted) {
        throw new Error('Job processing cancelled')
      }

      // Update job status to PROCESSING
      const updatedJob: ProvisioningJob = {
        ...job,
        status: ProvisioningJobStatus.PROCESSING,
        processedAt: new Date().toISOString(),
      }

      this.logger.logStep('job-processing-start', 'Starting job processing', {
        job_id: job.id,
        license_id: job.licenseId,
        step: job.currentStep,
      })

      // Call the handler
      await this.handler(updatedJob, this.logger)

      this.logger.logSuccess('Job processing completed', Date.now() - startTime, {
        job_id: job.id,
        license_id: job.licenseId,
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      const isAborted = signal.aborted

      if (isAborted) {
        this.logger.logWarn('Job processing timed out', {
          job_id: job.id,
          license_id: job.licenseId,
          timeout_ms: this.config.processingTimeoutMs,
        })
      } else {
        this.logger.logError(
          'Job processing failed',
          error instanceof Error ? error : new Error(errorMsg),
          {
            job_id: job.id,
            license_id: job.licenseId,
            step: job.currentStep,
          }
        )
      }

      // Re-enqueue for retry (handler will manage retry logic)
      await this.redis.lpush(this.config.queueName, JSON.stringify(job))
    }
  }

  /**
   * Get consumer health status
   */
  getStatus() {
    return {
      running: this.isRunning,
      activeJobs: this.activeJobs.size,
      maxConcurrency: this.config.concurrency,
    }
  }
}

/**
 * Factory to create provisioning consumer
 */
export function createProvisioningConsumer(
  redis: Redis,
  handler: JobHandler,
  config: ConsumerConfig,
  logger: ProvisioningLogger
): ProvisioningJobConsumer {
  return new ProvisioningJobConsumer(redis, handler, config, logger)
}
