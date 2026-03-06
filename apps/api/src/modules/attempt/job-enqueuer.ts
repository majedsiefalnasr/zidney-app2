import { jobQueue } from '@zidney/app/worker/queue/job-queue'
import {
  type AttemptSnapshot,
  createGradeAttemptJob,
  type SubmissionData,
} from '@zidney/app/worker/types/job-schema'
import { createLogger } from '@zidney/logger'

const logger = createLogger('job-enqueuer')

/**
 * T044: Job enqueueing in API layer
 *
 * Coordinates job submission to worker queue:
 * - Create job from submission data
 * - Enqueue to job queue
 * - Wait for completion (with timeout)
 * - Return result or 504 on timeout
 */

export interface EnqueueOptions {
  timeoutMs?: number // Default: 30000ms (30s)
  maxRetries?: number // Default: 5
}

/**
 * Enqueue grading job and wait for result
 */
export async function enqueueGradingJob(
  workspaceId: string,
  workspaceSlug: string,
  userId: string,
  correlationId: string,
  attemptId: string,
  attemptSnapshot: AttemptSnapshot,
  submissionData: SubmissionData,
  options: EnqueueOptions = {}
): Promise<{
  success: boolean
  jobId: string
  result?: unknown
  error?: string
  timedOut?: boolean
}> {
  const timeoutMs = options.timeoutMs || 30000
  const maxRetries = options.maxRetries || 5

  try {
    logger.info(`Enqueueing grading job`, {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      workspace_slug: workspaceSlug,
      user_id: userId,
      attempt_id: attemptId,
      timeout_ms: timeoutMs,
    })

    // Create grading job
    const job = createGradeAttemptJob(
      workspaceId,
      workspaceSlug,
      userId,
      correlationId,
      attemptId,
      attemptSnapshot,
      submissionData
    )

    // Enqueue to worker
    const jobId = await jobQueue.enqueue(
      workspaceId,
      workspaceSlug,
      'grade_attempt',
      userId,
      correlationId,
      job.payload || {},
      maxRetries
    )

    logger.info(`Grading job enqueued`, {
      correlation_id: correlationId,
      job_id: jobId,
      attempt_id: attemptId,
    })

    // Wait for result with timeout
    const result = await jobQueue.waitForResult(jobId, timeoutMs, 100)

    if (!result) {
      logger.warn(`Grading job timeout: no result received`, {
        correlation_id: correlationId,
        job_id: jobId,
        attempt_id: attemptId,
        timeout_ms: timeoutMs,
      })

      return {
        success: false,
        jobId,
        timedOut: true,
        error: 'Job processing timeout - response will be available shortly',
      }
    }

    logger.info(`Grading job completed`, {
      correlation_id: correlationId,
      job_id: jobId,
      attempt_id: attemptId,
      status: result.status,
    })

    if (result.status === 'error') {
      return {
        success: false,
        jobId,
        error: result.error || 'Unknown grading error',
      }
    }

    return {
      success: true,
      jobId,
      result: result.result,
    }
  } catch (error) {
    logger.error(`Grading job enqueue error`, {
      correlation_id: correlationId,
      workspace_id: workspaceId,
      user_id: userId,
      attempt_id: attemptId,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      success: false,
      jobId: 'unknown',
      error: 'Failed to enqueue grading job',
    }
  }
}

/**
 * Enqueue any job type (generic)
 */
export async function enqueueJob(
  workspaceId: string,
  workspaceSlug: string,
  jobType: string,
  userId: string,
  correlationId: string,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {}
): Promise<{
  jobId: string
  error?: string
}> {
  const maxRetries = options.maxRetries || 5

  try {
    logger.debug(`Enqueueing job`, {
      correlation_id: correlationId,
      job_type: jobType,
      workspace_id: workspaceId,
      user_id: userId,
    })

    const jobId = await jobQueue.enqueue(
      workspaceId,
      workspaceSlug,
      jobType,
      userId,
      correlationId,
      payload,
      maxRetries
    )

    return { jobId }
  } catch (error) {
    logger.error(`Job enqueue error`, {
      correlation_id: correlationId,
      job_type: jobType,
      workspace_id: workspaceId,
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      jobId: 'unknown',
      error: 'Failed to enqueue job',
    }
  }
}
