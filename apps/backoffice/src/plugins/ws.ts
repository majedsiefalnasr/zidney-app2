/**
 * Backoffice WebSocket Plugin — STAGE_17
 *
 * File: apps/backoffice/src/plugins/ws.ts
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 *
 * Manages the WebSocket connection to /ws/backoffice.
 * Reconnects automatically on non-1008/1011 close codes.
 *
 * Close code semantics:
 * - 1008 DUPLICATE_CONNECTION   — do NOT reconnect (server rejected intentionally)
 * - 1008 WORKSPACE_SUSPENDED    — do NOT reconnect (license non-ACTIVE)
 * - 1011 POLL_FAILURE           — do NOT reconnect (fail-closed)
 * - Any other close code        — reconnect with backoff
 *
 * Constitutional Compliance:
 * ✓ No credentials stored in JS — WebSocket sends HttpOnly cookie automatically
 * ✓ Structured error handling — no console.log in production path
 */

export interface BackofficeWsOptions {
  /** Called when a close code signals intentional termination (1008, 1011) */
  onTerminated?: (code: number, reason: string) => void
  /** Called when the WebSocket receives a message */
  onMessage?: (event: MessageEvent) => void
  /** Base reconnect delay in ms (default 3000) */
  reconnectDelayMs?: number
  /** Maximum reconnect attempts (default 5) */
  maxReconnectAttempts?: number
}

const NO_RECONNECT_CODES = new Set([1008, 1011])

/**
 * Creates a managed WebSocket client that connects to /ws/backoffice.
 * Returns a cleanup function to close the connection.
 */
export function createBackofficeWsClient(
  options: BackofficeWsOptions = {}
): () => void {
  const {
    onTerminated,
    onMessage,
    reconnectDelayMs = 3000,
    maxReconnectAttempts = 5,
  } = options

  let ws: WebSocket | null = null
  let reconnectAttempts = 0
  let destroyed = false

  function connect() {
    if (destroyed) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws/backoffice`

    ws = new WebSocket(url)

    ws.onopen = () => {
      reconnectAttempts = 0
    }

    ws.onmessage = (event) => {
      onMessage?.(event)
    }

    ws.onclose = (event) => {
      ws = null
      if (destroyed) return

      if (NO_RECONNECT_CODES.has(event.code)) {
        // Server intentionally terminated — do not reconnect
        onTerminated?.(event.code, event.reason)
        return
      }

      // Reconnect with linear backoff up to maxReconnectAttempts
      if (reconnectAttempts < maxReconnectAttempts) {
        reconnectAttempts++
        const delay = reconnectDelayMs * reconnectAttempts
        setTimeout(connect, delay)
      } else {
        onTerminated?.(event.code, 'Max reconnect attempts exceeded')
      }
    }

    ws.onerror = () => {
      // Error events are followed by close events — handle in onclose
    }
  }

  connect()

  // Return cleanup function
  return () => {
    destroyed = true
    if (ws) {
      ws.close(1000, 'Client disconnecting')
      ws = null
    }
  }
}
