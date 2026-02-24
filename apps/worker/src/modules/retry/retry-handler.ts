import { logger } from '@zidney/logger'

/**
 * T053: Job retry logic with exponential backoff
 *
 * Implements retry strategy:
 * - Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 5 retries)
 * - On error, requeue with increasing delay
 * - Track retry_count in job metadata
 * - Move to DLQ after 5 retries
 */

export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  multiplier: number
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 16000, // 16 seconds
  multiplier: 2.0,
}

export class RetryHandler {
  private config: RetryConfig

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config }
  }

  /**
   * Calculate backoff delay for a retry attempt
   */
  async calculateBackoff(retryCount: number): Promise<number> {
    if (retryCount < 0) {
      return 0
    }

    if (retryCount >= this.config.maxRetries) {
      return -1 // Signal: do not retry
    }

    // Exponential backoff: delay = baseDelay * multiplier^retryCount
    const delay = Math.min(
      this.config.baseDelayMs * Math.pow(this.config.multiplier, retryCount),
      this.config.maxDelayMs
    )

    logger.debug(`Backoff delay calculated`, {
      retry_count: retryCount,
      delay_ms: delay,
      max_retries: this.config.maxRetries,
    })

    return delay
  }

  /**
   * Determine if job should be retried
   */
  shouldRetry(retryCount: number): boolean {
    return retryCount < this.config.maxRetries
  }

  /**
   * Get retry info for logging
   */
  getRetryInfo(retryCount: number): {
    shouldRetry: boolean
    delayMs: number
    attemptsRemaining: number
  } {
    const delayMs = Math.min(
      this.config.baseDelayMs * Math.pow(this.config.multiplier, retryCount),
      this.config.maxDelayMs
    )

    return {
      shouldRetry: this.shouldRetry(retryCount),
      delayMs,
      attemptsRemaining: Math.max(0, this.config.maxRetries - retryCount - 1),
    }
  }

  /**
   * Log retry attempt
   */
  logRetryAttempt(
    jobId: string,
    retryCount: number,
    error: Error,
    delayMs: number
  ): void {
    const info = this.getRetryInfo(retryCount)

    if (info.shouldRetry) {
      logger.info(`Job retry scheduled`, {
        job_id: jobId,
        retry_count: retryCount,
        delay_ms: delayMs,
        attempts_remaining: info.attemptsRemaining,
        error_message: error.message,
      })
    } else {
      logger.warn(`Job exceeded max retries`, {
        job_id: jobId,
        retry_count: retryCount,
        max_retries: this.config.maxRetries,
        final_error: error.message,
      })
    }
  }

  /**
   * Calculate delay sequence for all remaining retries
   */
  getDelaySequence(startRetryCount: number): number[] {
    const delays: number[] = []

    for (let i = startRetryCount; i < this.config.maxRetries; i++) {
      const delay = Math.min(
        this.config.baseDelayMs * Math.pow(this.config.multiplier, i),
        this.config.maxDelayMs
      )
      delays.push(delay)
    }

    return delays
  }

  /**
   * Get text representation of retry configuration
   */
  getConfigSummary(): string {
    const sequence = this.getDelaySequence(0)
    return (
      `Max retries: ${this.config.maxRetries}, ` +
      `Base delay: ${this.config.baseDelayMs}ms, ` +
      `Max delay: ${this.config.maxDelayMs}ms, ` +
      `Multiplier: ${this.config.multiplier}x, ` +
      `Sequence: [${sequence.map((d) => `${d}ms`).join(', ')}]`
    )
  }
}

export const retryHandler = new RetryHandler()
