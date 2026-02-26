import { jobQueue } from '@zidney/app/worker/queue/job-queue'
import { createLogger } from '@zidney/logger'

const logger = createLogger('job-result-retriever')

/**
 * T045: Job result retrieval from queue
 *
 * Implements polling mechanism to retrieve job results:
 * - Query Redis for result by job_id
 * - Poll with exponential backoff (100ms, 200ms, 500ms)
 * - Return result or null on timeout
 * - Clean up Redis key after retrieval (async)
 */

export interface PollOptions {
  timeoutMs?: number // Default: 30000ms (30s)
  initialDelayMs?: number // Default: 100ms
  maxDelayMs?: number // Default: 1000ms
  backoffMultiplier?: number // Default: 1.5
}

/**
 * Retrieve job result with basic polling
 */
export async function getJobResult(
  jobId: string,
  _timeoutMs = 30000
): Promise<unknown | null> {
  try {
    const result = await jobQueue.getResult(jobId)

    if (result) {
      logger.debug(`Job result retrieved`, {
        job_id: jobId,
        status: result.status,
      })

      // Clean up result from Redis asynchronously
      jobQueue.clearResults([jobId]).catch((e: unknown) => {
        logger.warn(`Failed to clean up job result`, {
          job_id: jobId,
          error: e instanceof Error ? e.message : String(e),
        })
      })

      return result.result
    }

    return null
  } catch (error) {
    logger.error(`Job result retrieval error`, {
      job_id: jobId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

/**
 * Poll for job result with exponential backoff
 */
export async function pollJobResult(
  jobId: string,
  options: PollOptions = {}
): Promise<unknown | null> {
  const timeoutMs = options.timeoutMs || 30000
  const initialDelayMs = options.initialDelayMs || 100
  const maxDelayMs = options.maxDelayMs || 1000
  const backoffMultiplier = options.backoffMultiplier || 1.5

  const startTime = Date.now()
  let delayMs = initialDelayMs

  while (Date.now() - startTime < timeoutMs) {
    try {
      const result = await jobQueue.getResult(jobId)

      if (result) {
        logger.info(`Job result retrieved via polling`, {
          job_id: jobId,
          status: result.status,
          total_wait_ms: Date.now() - startTime,
        })

        // Clean up result asynchronously
        jobQueue.clearResults([jobId]).catch((e: unknown) => {
          logger.warn(`Failed to clean up job result`, {
            job_id: jobId,
            error: e instanceof Error ? e.message : String(e),
          })
        })

        return result.result
      }

      // Wait before next poll
      await sleep(delayMs)

      // Increase delay for next poll (exponential backoff)
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs)
    } catch (error) {
      logger.error(`Job result poll error`, {
        job_id: jobId,
        total_wait_ms: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      })

      // Continue polling on error
      await sleep(delayMs)
    }
  }

  logger.warn(`Job result poll timeout`, {
    job_id: jobId,
    timeout_ms: timeoutMs,
  })

  return null
}

/**
 * Poll for multiple job results in parallel
 */
export async function pollJobResults(
  jobIds: string[],
  options: PollOptions = {}
): Promise<Map<string, unknown>> {
  const results = new Map<string, unknown>()

  const promises = jobIds.map(async (jobId) => {
    const result = await pollJobResult(jobId, options)
    if (result !== null) {
      results.set(jobId, result)
    }
  })

  await Promise.all(promises)

  return results
}

/**
 * Check if result is ready without blocking
 */
export async function isJobResultReady(jobId: string): Promise<boolean> {
  try {
    const result = await jobQueue.getResult(jobId)
    return result !== null
  } catch (error) {
    logger.error(`Job result readiness check error`, {
      job_id: jobId,
      error: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

/**
 * Wait for multiple jobs with shared timeout
 */
export async function waitForAllResults(
  jobIds: string[],
  timeoutMs = 30000
): Promise<{
  completed: Map<string, unknown>
  timedOut: string[]
}> {
  const completed = new Map<string, unknown>()
  const timedOut: string[] = []
  const startTime = Date.now()

  for (const jobId of jobIds) {
    const remainingTime = Math.max(0, timeoutMs - (Date.now() - startTime))

    if (remainingTime <= 0) {
      timedOut.push(jobId)
      continue
    }

    const result = await pollJobResult(jobId, { timeoutMs: remainingTime })

    if (result !== null) {
      completed.set(jobId, result)
    } else {
      timedOut.push(jobId)
    }
  }

  return { completed, timedOut }
}

/**
 * Helper: sleep function using Promise
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
