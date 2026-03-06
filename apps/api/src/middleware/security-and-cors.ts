import { createLogger } from '@zidney/logger'
import type { Hono } from 'hono'

const logger = createLogger('security-cors')

/**
 * T063-T066: Security Headers & CORS
 *
 * Implements comprehensive security headers on all responses:
 * - Content-Security-Policy
 * - X-Frame-Options
 * - X-Content-Type-Options
 * - X-XSS-Protection
 * - Strict-Transport-Security
 * - Referrer-Policy
 * - Permissions-Policy
 */

export interface SecurityHeadersConfig {
  contentSecurityPolicy?: string
  frameOptions?: string
  contentTypeOptions?: string
  xssProtection?: string
  strictTransportSecurity?: string
  referrerPolicy?: string
  permissionsPolicy?: string
}

const DEFAULT_HEADERS: SecurityHeadersConfig = {
  contentSecurityPolicy:
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'",
  frameOptions: 'DENY',
  contentTypeOptions: 'nosniff',
  xssProtection: '1; mode=block',
  strictTransportSecurity: 'max-age=31536000; includeSubDomains; preload',
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: 'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
}

/**
 * Security headers middleware
 */
export function securityHeaders(config: SecurityHeadersConfig = DEFAULT_HEADERS) {
  return async (c: Hono, next: () => Promise<void>) => {
    try {
      // Proceed with request
      await next()

      const correlationId = c.state.requestId || 'unknown'

      // Add security headers to response (after route execution)
      if (config.contentSecurityPolicy) {
        c.header('Content-Security-Policy', config.contentSecurityPolicy)
      }

      if (config.frameOptions) {
        c.header('X-Frame-Options', config.frameOptions)
      }

      if (config.contentTypeOptions) {
        c.header('X-Content-Type-Options', config.contentTypeOptions)
      }

      if (config.xssProtection) {
        c.header('X-XSS-Protection', config.xssProtection)
      }

      if (config.strictTransportSecurity) {
        c.header('Strict-Transport-Security', config.strictTransportSecurity)
      }

      if (config.referrerPolicy) {
        c.header('Referrer-Policy', config.referrerPolicy)
      }

      if (config.permissionsPolicy) {
        c.header('Permissions-Policy', config.permissionsPolicy)
      }

      logger.debug(`Security headers applied`, {
        correlation_id: correlationId,
        path: c.req.path,
      })
    } catch (error) {
      logger.error(`Security headers middleware error`, {
        correlation_id: c.state.requestId || 'unknown',
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }
}

/**
 * T064: CORS configuration
 */
export interface CORSConfig {
  allowedOrigins: string[]
  allowedMethods: string[]
  allowedHeaders: string[]
  exposedHeaders: string[]
  maxAge: number
  allowCredentials: boolean
}

export const CORS_DEV_CONFIG: CORSConfig = {
  allowedOrigins: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
  exposedHeaders: [
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'Retry-After',
  ],
  maxAge: 86400, // 24 hours
  allowCredentials: true,
}

export const CORS_PROD_CONFIG: CORSConfig = {
  allowedOrigins: [
    process.env.APP_DOMAIN || 'https://app.example.com',
    process.env.APP_DOMAIN_ALT || 'https://exam.example.com',
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-ID'],
  exposedHeaders: [
    'X-Rate-Limit-Limit',
    'X-Rate-Limit-Remaining',
    'X-Rate-Limit-Reset',
    'Retry-After',
  ],
  maxAge: 86400,
  allowCredentials: true,
}

/**
 * Validate origin against allowed list
 */
export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  if (!origin) {
    return false
  }

  // Exact match
  if (allowedOrigins.includes(origin)) {
    return true
  }

  // Wildcard support for subdomains in dev
  for (const allowed of allowedOrigins) {
    if (allowed.includes('*')) {
      const regex = new RegExp(`^${allowed.replace(/\*/g, '[a-z0-9-]+')}$`)
      if (regex.test(origin)) {
        return true
      }
    }
  }

  return false
}

/**
 * CORS middleware
 */
export function corsMiddleware(corsConfig: CORSConfig = CORS_DEV_CONFIG) {
  return async (c: Hono, next: () => Promise<void>) => {
    const origin = c.req.header('Origin')
    const correlationId = c.state.requestId || 'unknown'

    try {
      // Check if origin is allowed
      if (!isOriginAllowed(origin, corsConfig.allowedOrigins)) {
        logger.warn(`CORS origin rejected`, {
          correlation_id: correlationId,
          origin: origin || 'undefined',
          allowed_origins: corsConfig.allowedOrigins,
        })

        // Don't set CORS headers for disallowed origins
        await next()
        return
      }

      // Set CORS headers
      c.header('Access-Control-Allow-Origin', origin!)
      c.header('Access-Control-Allow-Methods', corsConfig.allowedMethods.join(', '))
      c.header('Access-Control-Allow-Headers', corsConfig.allowedHeaders.join(', '))
      c.header('Access-Control-Expose-Headers', corsConfig.exposedHeaders.join(', '))
      c.header('Access-Control-Allow-Credentials', String(corsConfig.allowCredentials))
      c.header('Access-Control-Max-Age', String(corsConfig.maxAge))

      // Handle preflight
      if (c.req.method === 'OPTIONS') {
        return c.text('', 204)
      }

      await next()
    } catch (error) {
      logger.error(`CORS middleware error`, {
        correlation_id: correlationId,
        origin,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }
}
