/**
 * T041: Payload size and format validation middleware
 *
 * Enforces:
 * - Max 1MB request body size
 * - Max 100MB file upload size
 * - Max JSON depth (10 levels)
 *
 * Returns 400 PAYLOAD_TOO_LARGE on violation
 */

import { createLogger } from '@zidney/logger'
import { Hono } from 'hono'

const logger = createLogger('payload-validator')

interface PayloadLimits {
  maxBodySizeBytes: number // 1MB default
  maxFileSizeBytes: number // 100MB default
  maxJsonDepth: number // 10 default
}

const DEFAULT_LIMITS: PayloadLimits = {
  maxBodySizeBytes: 1024 * 1024, // 1MB
  maxFileSizeBytes: 100 * 1024 * 1024, // 100MB
  maxJsonDepth: 10,
}

export async function payloadValidator(
  c: Hono,
  next: () => Promise<void>,
  limits: PayloadLimits = DEFAULT_LIMITS
): Promise<void> {
  const correlationId = c.state.requestId || 'unknown'
  const contentType = c.req.header('content-type') || ''

  try {
    // Get content length
    const contentLengthHeader = c.req.header('content-length')
    if (contentLengthHeader) {
      const contentLength = parseInt(contentLengthHeader)

      // Check general body size limit
      if (contentLength > limits.maxBodySizeBytes) {
        logger.warn(`Payload validation failed: body too large`, {
          correlation_id: correlationId,
          content_length: contentLength,
          max_body_size: limits.maxBodySizeBytes,
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'Request body exceeds maximum size limit',
            },
          },
          400
        )
      }

      // Check file upload size
      if (
        contentType.includes('multipart/form-data') &&
        contentLength > limits.maxFileSizeBytes
      ) {
        logger.warn(`Payload validation failed: file too large`, {
          correlation_id: correlationId,
          content_length: contentLength,
          max_file_size: limits.maxFileSizeBytes,
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'File upload exceeds maximum size limit',
            },
          },
          400
        )
      }
    }

    // For JSON payloads, validate depth when parsing
    if (contentType.includes('application/json')) {
      try {
        const rawBody = await c.req.text()

        if (rawBody.length > limits.maxBodySizeBytes) {
          logger.warn(`Payload validation failed: JSON body too large`, {
            correlation_id: correlationId,
            body_length: rawBody.length,
            max_body_size: limits.maxBodySizeBytes,
          })

          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: 'PAYLOAD_TOO_LARGE',
                message: 'Request body exceeds maximum size limit',
              },
            },
            400
          )
        }

        // Parse and check depth
        const parsed = JSON.parse(rawBody)
        const depth = calculateJsonDepth(parsed)

        if (depth > limits.maxJsonDepth) {
          logger.warn(`Payload validation failed: JSON depth too deep`, {
            correlation_id: correlationId,
            json_depth: depth,
            max_json_depth: limits.maxJsonDepth,
          })

          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: 'INVALID_PAYLOAD',
                message: 'JSON structure too deeply nested',
              },
            },
            400
          )
        }

        // Store parsed body in state for reuse
        c.state.parsedBody = parsed
      } catch (e) {
        if (e instanceof SyntaxError) {
          logger.warn(`Payload validation failed: invalid JSON`, {
            correlation_id: correlationId,
            error: e.message,
          })

          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: 'INVALID_JSON',
                message: 'Request body is not valid JSON',
              },
            },
            400
          )
        }
        throw e
      }
    }

    await next()
  } catch (error) {
    logger.error(`Payload validation error`, {
      correlation_id: correlationId,
      error: error instanceof Error ? error.message : String(error),
    })

    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Payload validation failed',
        },
      },
      400
    )
  }
}

/**
 * Calculate maximum depth of a JSON object/array
 */
function calculateJsonDepth(obj: unknown, current = 1, max = 1): number {
  if (obj === null || obj === undefined) {
    return max
  }

  if (typeof obj !== 'object') {
    return max
  }

  if (current > max) {
    max = current
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      max = calculateJsonDepth(item, current + 1, max)
    }
  } else if (typeof obj === 'object') {
    for (const value of Object.values(obj)) {
      max = calculateJsonDepth(value, current + 1, max)
    }
  }

  return max
}
