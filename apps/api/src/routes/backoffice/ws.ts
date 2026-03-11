/**
 * Backoffice WebSocket Route — STAGE_17
 *
 * File: apps/api/src/routes/backoffice/ws.ts
 * Stage: STAGE_17_TENANT_BOOTSTRAP
 * Date: 2026-02-28
 *
 * Establishes a WebSocket connection for Backoffice. Validates workspace,
 * license, and auth on handshake. Polls license status periodically during
 * the session and closes the connection on non-ACTIVE status.
 *
 * Features:
 * - F-01: Module-scoped Redis client (never created per-connection)
 * - H-02: Atomic SET NX EX prevents TOCTOU race for connection deduplication
 * - M-01: Fail-closed after WS_MAX_POLL_FAILURES consecutive poll failures (1011)
 * - WS-02: wsKey hoisted to outer closure — shared by onOpen, onClose, onError
 * - Structured logging on all events (open, close, error, poll failure)
 *
 * Redis keys:
 * - ws:backoffice:{workspace_id}:{user_id}  — connection presence, TTL = WS_POLL_MS * 3
 * - license:status:{workspace_id}           — license status cache (set by license middleware)
 *
 * Close codes:
 * - 1008  WORKSPACE_SUSPENDED    — non-ACTIVE license during polling
 * - 1008  DUPLICATE_CONNECTION   — duplicate connection rejected on open
 * - 1011  POLL_FAILURE           — max consecutive poll failures exceeded (fail-closed)
 *
 * Constitutional Compliance:
 * ✓ All tenant context from Hono context (set by middleware chain)
 * ✓ Server-authoritative time (ADR-0006)
 * ✓ No console.log — all logging through @zidney/logger
 * ✓ Structured logs include workspace_id, workspace_slug, correlation_id, user_id, route_name
 */

import { createLogger } from '@zidney/logger'
import { createRedisClient } from '@zidney/redis-utils'
import { upgradeWebSocket } from 'hono/bun'

const logger = createLogger('backoffice-ws')

// WS license poll interval: env var, clamped 5 000–120 000 ms, default 30 000 ms
const WS_POLL_MS = Math.min(
  Math.max(parseInt(process.env.WS_LICENSE_POLL_INTERVAL_MS ?? '30000', 10), 5000),
  120000
)

// Max consecutive poll failures before fail-closed (M-01)
const MAX_POLL_FAILURES = parseInt(process.env.WS_MAX_POLL_FAILURES ?? '3', 10)

// F-01: Module-scoped shared Redis client — shared across ALL connections on this process.
// Never created per-connection; never closed per-connection.
// Lifetime is process lifetime (same pattern as license middleware Redis client).
const moduleWsRedis = createRedisClient()

/**
 * Creates the Backoffice WebSocket Hono route handler.
 *
 * Mount at: GET /ws/backoffice
 *
 * Middleware chain (applied at app.ts level):
 *   correlationId → tenantResolver → licenseEnforcement
 *   → rateLimit(max:10, keyPrefix:'backoffice-ws') → authentication → this handler
 */
export function createBackofficeWsRoute() {
  return upgradeWebSocket((c) => {
    const tenant = c.get('tenant') as {
      id: string
      slug: string
      schema_version: number
    }
    const staff_user = c.get('staff_user') as { user_id: string; role: string }
    const correlation_id: string = (c.get('correlationId') as string) || 'unknown'

    // WS-02: Hoist key to outer closure so onOpen/onClose/onError all share the same scope
    const wsKey = `ws:backoffice:${tenant.id}:${staff_user.user_id}`

    // F-01: Use module-scoped moduleWsRedis (no per-connection client)
    const wsRedis = moduleWsRedis

    let pollInterval: ReturnType<typeof setInterval> | undefined

    // M-01: Fail-closed counter — tracks consecutive license poll failures
    let consecutivePollFailures = 0

    return {
      async onOpen(_event, ws) {
        // H-02: Atomic SET NX prevents TOCTOU race — replaces two-step GET + SETEX
        // registered = 'OK' on success, null if key already exists (duplicate)
        const registered = await wsRedis.set(
          wsKey,
          '1',
          'EX',
          Math.ceil((WS_POLL_MS * 3) / 1000),
          'NX'
        )

        if (!registered) {
          // Key already exists — duplicate connection for this user
          logger.warn('Duplicate WS connection rejected', {
            workspace_id: tenant.id,
            workspace_slug: tenant.slug,
            correlation_id,
            user_id: staff_user.user_id,
            route_name: 'WS /ws/backoffice',
          })
          ws.close(1008, 'DUPLICATE_CONNECTION')
          return
        }

        logger.info('Backoffice WS connected', {
          workspace_id: tenant.id,
          workspace_slug: tenant.slug,
          correlation_id,
          user_id: staff_user.user_id,
          route_name: 'WS /ws/backoffice',
        })

        pollInterval = setInterval(async () => {
          try {
            // V-04: Reuse outer-scope wsRedis client — no new Redis client per tick
            const status = await wsRedis.get(`license:status:${tenant.id}`)

            // CR FIX: Reset failure counter immediately after license is confirmed —
            // BEFORE the best-effort TTL refresh. If setex throws (transient Redis write
            // hiccup) the connection stays open because the license was confirmed ACTIVE.
            consecutivePollFailures = 0

            // Best-effort TTL refresh — non-fatal if it fails
            try {
              await wsRedis.setex(wsKey, Math.ceil((WS_POLL_MS * 3) / 1000), '1')
            } catch {
              // Intentionally swallowed — TTL expiry is handled by onOpen NX enforcement
            }

            if (status !== 'ACTIVE') {
              logger.warn('WS license became non-ACTIVE; closing connection', {
                workspace_id: tenant.id,
                workspace_slug: tenant.slug,
                correlation_id,
                user_id: staff_user.user_id,
                license_status: status ?? 'UNKNOWN',
                route_name: 'WS /ws/backoffice',
              })
              clearInterval(pollInterval)
              ws.close(1008, 'WORKSPACE_SUSPENDED')
            }
          } catch (err) {
            consecutivePollFailures++

            // M-01: Fail-closed on repeated failures — suspend WS after MAX_POLL_FAILURES
            if (consecutivePollFailures >= MAX_POLL_FAILURES) {
              logger.error('WS license poll exceeded max failures; closing fail-closed', {
                workspace_id: tenant.id,
                workspace_slug: tenant.slug,
                correlation_id,
                user_id: staff_user.user_id,
                route_name: 'WS /ws/backoffice',
                consecutive_failures: consecutivePollFailures,
              })
              clearInterval(pollInterval)
              ws.close(1011, 'POLL_FAILURE')
            } else {
              logger.error('WS license poll failed', {
                workspace_id: tenant.id,
                workspace_slug: tenant.slug,
                correlation_id,
                user_id: staff_user.user_id,
                route_name: 'WS /ws/backoffice',
                attempt: consecutivePollFailures,
                error: err instanceof Error ? err.message : String(err),
              })
            }
          }
        }, WS_POLL_MS)
      },

      onClose() {
        if (pollInterval) clearInterval(pollInterval)

        // CR FIX: Log Redis del failure (silent failure leaves presence key alive until TTL expiry)
        wsRedis.del(wsKey).catch((e: unknown) =>
          logger.error('WS cleanup Redis del failed on close', {
            workspace_id: tenant.id,
            workspace_slug: tenant.slug,
            correlation_id,
            user_id: staff_user.user_id,
            route_name: 'WS /ws/backoffice',
            error: e instanceof Error ? e.message : String(e),
          })
        )

        logger.info('Backoffice WS disconnected', {
          workspace_id: tenant.id,
          workspace_slug: tenant.slug,
          correlation_id,
          user_id: staff_user.user_id,
          route_name: 'WS /ws/backoffice',
        })
      },

      onError(evt) {
        if (pollInterval) clearInterval(pollInterval)

        // CR FIX: Log Redis del failure + log evt.message for production observability
        wsRedis.del(wsKey).catch((e: unknown) =>
          logger.error('WS cleanup Redis del failed on error', {
            workspace_id: tenant.id,
            workspace_slug: tenant.slug,
            correlation_id,
            user_id: staff_user.user_id,
            route_name: 'WS /ws/backoffice',
            error: e instanceof Error ? e.message : String(e),
          })
        )

        logger.error('Backoffice WS error', {
          workspace_id: tenant.id,
          workspace_slug: tenant.slug,
          correlation_id,
          user_id: staff_user.user_id,
          route_name: 'WS /ws/backoffice',
          // CR FIX: Include actual error diagnostic — cast to ErrorEvent where possible
          error_message:
            typeof ErrorEvent !== 'undefined' && evt instanceof ErrorEvent
              ? evt.message
              : String(evt),
        })
      },
    }
  })
}
