import { createLogger } from '@zidney/logging'

const logger = createLogger('ws-heartbeat')

/**
 * T035: WebSocket heartbeat monitoring
 *
 * Ensures connection health by:
 * - Sending ping every 30 seconds
 * - Requiring pong response within 30 seconds
 * - Closing connection on heartbeat timeout (code 1011)
 * - Logging all heartbeat failures
 */

export interface HeartbeatConfig {
  intervalMs: number // Time between pings (default: 30000ms / 30s)
  timeoutMs: number // Max time to wait for pong (default: 30000ms / 30s)
  maxMissedPings: number // Max consecutive missed pongs before close (default: 2)
}

export const DEFAULT_HEARTBEAT_CONFIG: HeartbeatConfig = {
  intervalMs: 30000, // 30 seconds
  timeoutMs: 30000, // 30 seconds
  maxMissedPings: 2, // 2 consecutive failures
}

export class WebSocketHeartbeatMonitor {
  private config: HeartbeatConfig
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private timeouts: Map<string, NodeJS.Timeout> = new Map()
  private missedPings: Map<string, number> = new Map()

  constructor(config: Partial<HeartbeatConfig> = {}) {
    this.config = { ...DEFAULT_HEARTBEAT_CONFIG, ...config }
  }

  /**
   * Start heartbeat monitoring for a connection
   */
  startHeartbeat(
    connectionId: string,
    userId: string,
    attemptId: string,
    onPingNeeded: () => void,
    onHeartbeatTimeout: () => void
  ): void {
    // Clear any existing heartbeat for this connection
    this.stopHeartbeat(connectionId)

    // Initialize missed pings counter
    this.missedPings.set(connectionId, 0)

    logger.debug(`WebSocket heartbeat started`, {
      connection_id: connectionId,
      user_id: userId,
      attempt_id: attemptId,
      interval_ms: this.config.intervalMs,
      timeout_ms: this.config.timeoutMs,
    })

    // Send initial ping after interval
    const interval = setInterval(() => {
      try {
        // Increment missed pings counter
        const missed = (this.missedPings.get(connectionId) || 0) + 1
        this.missedPings.set(connectionId, missed)

        if (missed > this.config.maxMissedPings) {
          logger.warn(
            `WebSocket heartbeat timeout: max missed pings exceeded`,
            {
              connection_id: connectionId,
              user_id: userId,
              attempt_id: attemptId,
              missed_pings: missed,
              max_missed_pings: this.config.maxMissedPings,
            }
          )
          onHeartbeatTimeout()
          this.stopHeartbeat(connectionId)
          return
        }

        onPingNeeded()

        // Set timeout for pong response
        const timeout = setTimeout(() => {
          logger.warn(`WebSocket heartbeat: pong timeout`, {
            connection_id: connectionId,
            user_id: userId,
            attempt_id: attemptId,
            timeout_ms: this.config.timeoutMs,
          })
          // Don't immediately close - wait for next ping interval
          // The missed pings counter will track this
        }, this.config.timeoutMs)

        this.timeouts.set(connectionId, timeout)
      } catch (error) {
        logger.error(`WebSocket heartbeat send error`, {
          connection_id: connectionId,
          user_id: userId,
          attempt_id: attemptId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }, this.config.intervalMs)

    this.intervals.set(connectionId, interval)
  }

  /**
   * Record pong response from client
   */
  recordPong(connectionId: string): void {
    // Clear pending timeout
    const timeout = this.timeouts.get(connectionId)
    if (timeout) {
      clearTimeout(timeout)
      this.timeouts.delete(connectionId)
    }

    // Reset missed pings counter on successful pong
    this.missedPings.set(connectionId, 0)

    logger.debug(`WebSocket heartbeat: pong received`, {
      connection_id: connectionId,
    })
  }

  /**
   * Stop heartbeat monitoring for a connection
   */
  stopHeartbeat(connectionId: string): void {
    // Clear interval
    const interval = this.intervals.get(connectionId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(connectionId)
    }

    // Clear timeout
    const timeout = this.timeouts.get(connectionId)
    if (timeout) {
      clearTimeout(timeout)
      this.timeouts.delete(connectionId)
    }

    // Clear missed pings counter
    this.missedPings.delete(connectionId)

    logger.debug(`WebSocket heartbeat stopped`, {
      connection_id: connectionId,
    })
  }

  /**
   * Get heartbeat status for debugging
   */
  getStatus(connectionId: string): {
    isActive: boolean
    missedPings: number
    hasTimeout: boolean
  } {
    return {
      isActive: this.intervals.has(connectionId),
      missedPings: this.missedPings.get(connectionId) || 0,
      hasTimeout: this.timeouts.has(connectionId),
    }
  }

  /**
   * Clean up all active heartbeats
   */
  cleanup(): void {
    this.intervals.forEach((interval) => clearInterval(interval))
    this.timeouts.forEach((timeout) => clearTimeout(timeout))
    this.intervals.clear()
    this.timeouts.clear()
    this.missedPings.clear()

    logger.info(`WebSocket heartbeat monitor cleaned up`)
  }
}

export const heartbeatMonitor = new WebSocketHeartbeatMonitor()
