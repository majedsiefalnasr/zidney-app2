import { createLogger } from '@zidney/logger'
import { Hono } from 'hono'
import { Jwt } from 'hono/utils/jwt'
import { redis } from '../../infrastructure/redis'

const logger = createLogger('websocket')

const app = new Hono()

/**
 * GET /ws/attempt/{id} - WebSocket endpoint for attempt interaction
 *
 * Handles:
 * - JWT authentication via Authorization header
 * - Workspace/attempt ID validation
 * - Per-user connection rate limiting (1 connection per attempt)
 * - Message rate limiting (100 msgs/60s with 10 msg/sec burst)
 * - Heartbeat monitoring (ping/pong every 30s)
 * - Graceful close handling
 */
app.get('/ws/attempt/:id', async (c) => {
  const correlationIDValue = c.state.requestId
  const workspace = c.state.workspace
  const userId = c.state.userId
  const attemptId = c.req.param('id')

  try {
    logger.info(`WebSocket connection attempt: ${attemptId}`, {
      correlation_id: correlationIDValue,
      workspace_slug: workspace.slug,
      workspace_id: workspace.id,
      user_id: userId,
      attempt_id: attemptId,
    })

    // Extract JWT from Authorization header
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      logger.warn(`WebSocket auth failed: missing bearer token`, {
        correlation_id: correlationIDValue,
        workspace_slug: workspace.slug,
        workspace_id: workspace.id,
        attempt_id: attemptId,
      })
      return c.text('Unauthorized', 401)
    }

    const token = authHeader.substring(7)
    let claims: any = null

    try {
      claims = await Jwt.verify(
        token,
        process.env.JWT_SECRET || 'dev-secret-change-in-production',
        'HS256'
      )
    } catch {
      claims = null
    }

    if (!claims) {
      logger.warn(`WebSocket auth failed: invalid JWT`, {
        correlation_id: correlationIDValue,
        workspace_slug: workspace.slug,
        workspace_id: workspace.id,
        attempt_id: attemptId,
      })
      return c.text('Unauthorized', 401)
    }

    // Validate workspace_id claim matches context
    if (claims.workspace_id !== workspace.id) {
      logger.warn(`WebSocket auth failed: workspace mismatch`, {
        correlation_id: correlationIDValue,
        workspace_slug: workspace.slug,
        workspace_id: workspace.id,
        user_id: userId,
        attempt_id: attemptId,
        claimed_workspace_id: claims.workspace_id,
      })
      return c.text('Forbidden', 403)
    }

    // Validate attempt_id in token matches URL param
    if (claims.attempt_id !== attemptId) {
      logger.warn(`WebSocket auth failed: attempt ID mismatch`, {
        correlation_id: correlationIDValue,
        workspace_slug: workspace.slug,
        workspace_id: workspace.id,
        user_id: userId,
        attempt_id: attemptId,
        claimed_attempt_id: claims.attempt_id,
      })
      return c.text('Forbidden', 403)
    }

    // Check rate limit: 1 connection per user per attempt
    const connectionKey = `ws:connection:${userId}:${attemptId}`
    const existingConnection = await redis.get(connectionKey)

    if (existingConnection) {
      logger.warn(`WebSocket rate limit: user already has active connection`, {
        correlation_id: correlationIDValue,
        workspace_slug: workspace.slug,
        workspace_id: workspace.id,
        user_id: userId,
        attempt_id: attemptId,
      })
      return c.text('Too Many Requests', 429)
    }

    // Store connection metadata in Redis (30min TTL)
    const connectionMetadata = {
      user_id: userId,
      workspace_id: workspace.id,
      workspace_slug: workspace.slug,
      attempt_id: attemptId,
      correlation_id: correlationIDValue,
      connected_at: new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
      message_count: 0,
    }

    await redis.setEx(
      connectionKey,
      1800, // 30 minutes
      JSON.stringify(connectionMetadata)
    )

    logger.info(`WebSocket connection established`, {
      correlation_id: correlationIDValue,
      workspace_slug: workspace.slug,
      workspace_id: workspace.id,
      user_id: userId,
      attempt_id: attemptId,
    })

    // Upgrade to WebSocket
    return (c as any).upgrade((ws: any) => {
      let heartbeatInterval: NodeJS.Timeout | null = null
      let heartbeatTimeout: NodeJS.Timeout | null = null
      const messageTimestamps: number[] = []

      // Heartbeat setup
      const startHeartbeat = () => {
        heartbeatInterval = setInterval(() => {
          try {
            ws.send(JSON.stringify({ type: 'ping' }))

            // Set timeout for pong response (5 seconds)
            heartbeatTimeout = setTimeout(() => {
              logger.warn(`WebSocket heartbeat timeout: no pong received`, {
                correlation_id: correlationIDValue,
                workspace_slug: workspace.slug,
                workspace_id: workspace.id,
                user_id: userId,
                attempt_id: attemptId,
              })
              ws.close(1011, 'Heartbeat timeout')
            }, 5000)
          } catch (e) {
            logger.error(`WebSocket heartbeat send error`, {
              correlation_id: correlationIDValue,
              workspace_slug: workspace.slug,
              workspace_id: workspace.id,
              user_id: userId,
              attempt_id: attemptId,
              error: (e as Error).message,
            })
          }
        }, 30000) // Every 30 seconds
      }

      // Message handler
      ws.onmessage = async (event: any) => {
        try {
          // Clear heartbeat timeout on message
          if (heartbeatTimeout) {
            clearTimeout(heartbeatTimeout)
            heartbeatTimeout = null
          }

          const data = JSON.parse(event.data as string)

          // Handle pong response
          if (data.type === 'pong') {
            logger.debug(`WebSocket pong received`, {
              correlation_id: correlationIDValue,
              workspace_slug: workspace.slug,
              workspace_id: workspace.id,
              user_id: userId,
              attempt_id: attemptId,
            })
            return
          }

          // Rate limiting: 100 messages per 60 seconds with 10 msg/sec burst
          const now = Date.now()
          messageTimestamps.push(now)

          // Remove messages older than 60 seconds
          while (messageTimestamps.length > 0 && messageTimestamps[0]! < now - 60000) {
            messageTimestamps.shift()
          }

          // Check burst limit (10 messages in last 1 second)
          const recentMessages = messageTimestamps.filter((ts) => ts > now - 1000)
          if (recentMessages.length > 10) {
            logger.warn(`WebSocket rate limit: too many messages (burst)`, {
              correlation_id: correlationIDValue,
              workspace_slug: workspace.slug,
              workspace_id: workspace.id,
              user_id: userId,
              attempt_id: attemptId,
              message_count_1s: recentMessages.length,
            })
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many messages in burst',
              })
            )
            ws.close(4029, 'Rate limited')
            return
          }

          // Check 60-second limit (100 messages)
          if (messageTimestamps.length > 100) {
            logger.warn(`WebSocket rate limit: too many messages (window)`, {
              correlation_id: correlationIDValue,
              workspace_slug: workspace.slug,
              workspace_id: workspace.id,
              user_id: userId,
              attempt_id: attemptId,
              message_count_60s: messageTimestamps.length,
            })
            ws.send(
              JSON.stringify({
                type: 'error',
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many messages in window',
              })
            )
            ws.close(4029, 'Rate limited')
            return
          }

          // Update connection metadata
          const metadata = await redis.get(connectionKey)
          if (metadata) {
            const parsed = JSON.parse(metadata)
            parsed.message_count = (parsed.message_count || 0) + 1
            parsed.last_heartbeat = new Date().toISOString()
            await redis.setEx(connectionKey, 1800, JSON.stringify(parsed))
          }

          logger.debug(`WebSocket message received`, {
            correlation_id: correlationIDValue,
            workspace_slug: workspace.slug,
            workspace_id: workspace.id,
            user_id: userId,
            attempt_id: attemptId,
            message_type: data.type,
          })

          // Echo back (application logic would process this)
          ws.send(
            JSON.stringify({
              type: 'ack',
              message_type: data.type,
            })
          )
        } catch (e) {
          logger.error(`WebSocket message processing error`, {
            correlation_id: correlationIDValue,
            workspace_slug: workspace.slug,
            workspace_id: workspace.id,
            user_id: userId,
            attempt_id: attemptId,
            error: (e as Error).message,
          })
          ws.send(
            JSON.stringify({
              type: 'error',
              message: 'Message processing error',
            })
          )
        }
      }

      // Close handler
      ws.onclose = async () => {
        if (heartbeatInterval) clearInterval(heartbeatInterval)
        if (heartbeatTimeout) clearTimeout(heartbeatTimeout)

        // Remove connection from Redis
        await redis.del(connectionKey)

        logger.info(`WebSocket connection closed`, {
          correlation_id: correlationIDValue,
          workspace_slug: workspace.slug,
          workspace_id: workspace.id,
          user_id: userId,
          attempt_id: attemptId,
          session_duration_ms: Date.now() - Date.parse(connectionMetadata.connected_at),
        })
      }

      // Error handler
      ws.onerror = (error: unknown) => {
        logger.error(`WebSocket connection error`, {
          correlation_id: correlationIDValue,
          workspace_slug: workspace.slug,
          workspace_id: workspace.id,
          user_id: userId,
          attempt_id: attemptId,
          error: error instanceof Error ? error.message : String(error),
        })
      }

      // Start heartbeat
      startHeartbeat()
    })
  } catch (e) {
    logger.error(`WebSocket connection error`, {
      correlation_id: correlationIDValue,
      workspace_slug: workspace.slug,
      workspace_id: workspace.id,
      user_id: userId,
      attempt_id: attemptId,
      error: (e as Error).message,
    })
    return c.text('Internal Server Error', 500)
  }
})

export default app
