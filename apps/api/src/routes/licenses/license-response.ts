/**
 * License Response Types
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Standardized response objects for license creation and status polling.
 * All responses follow RFC 7807 Problem Details format for errors.
 */

import type { LicenseStatus } from '@zidney/types/licenses/license-state'

/**
 * License Creation Response (200 OK)
 * Returned after successful license creation and job enqueueing.
 */
export interface LicenseCreationResponse {
  success: true
  data: {
    license_id: string
    workspace_slug: string
    organization_name: string
    status: LicenseStatus
    job_id: string
    created_at: string // ISO 8601 timestamp
    schema_version: string
    product_version: string
    estimated_provision_time_seconds: number
  }
  error: null
}

/**
 * License Status Response (200 OK)
 * Returned by GET /v1/mmc/licenses/{license_id} for status polling.
 */
export interface LicenseStatusResponse {
  success: true
  data: {
    license_id: string
    workspace_slug: string
    organization_name: string
    status: LicenseStatus
    created_at: string // ISO 8601 timestamp
    provisioned_at: string | null
    failed_at: string | null
    last_provision_error: string | null
    retry_count: number
    estimated_remaining_seconds: number | null
  }
  error: null
}

/**
 * Error Response (4xx, 5xx)
 * RFC 7807 Problem Details
 */
export interface ErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  }
}

/**
 * Generic API Response
 * Union type for any API response
 */
export type ApiResponse<T = unknown> = {
  success: boolean
  data: T | null
  error: {
    code: string
    message: string
    details?: Record<string, unknown>
  } | null
}

/**
 * Rate Limit Headers
 * Included in every API response
 */
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string
  'X-RateLimit-Remaining': string
  'X-RateLimit-Reset': string
  'X-Correlation-ID': string
}

/**
 * Idempotency Headers
 */
export interface IdempotencyHeaders {
  'Idempotent-Replay': 'true' | 'false'
  'Idempotent-Response-Stored-At'?: string
}

/**
 * Create successful license creation response
 */
export function createLicenseCreationResponse(
  licenseId: string,
  workspaceSlug: string,
  organizationName: string,
  jobId: string,
  schemaVersion: string,
  productVersion: string,
  estimatedSeconds: number = 120
): LicenseCreationResponse {
  return {
    success: true,
    data: {
      license_id: licenseId,
      workspace_slug: workspaceSlug,
      organization_name: organizationName,
      status: 'PENDING_PROVISION' as LicenseStatus,
      job_id: jobId,
      created_at: new Date().toISOString(),
      schema_version: schemaVersion,
      product_version: productVersion,
      estimated_provision_time_seconds: estimatedSeconds,
    },
    error: null,
  }
}

/**
 * Create license status response
 */
export function createLicenseStatusResponse(
  licenseId: string,
  workspaceSlug: string,
  organizationName: string,
  status: LicenseStatus,
  createdAt: string,
  provisionedAt: string | null,
  failedAt: string | null,
  lastError: string | null,
  retryCount: number
): LicenseStatusResponse {
  // Calculate estimated remaining time based on status
  let estimatedRemaining: number | null = null
  if (status === 'PENDING_PROVISION') {
    const createdAtMs = new Date(createdAt).getTime()
    const elapsedMs = Date.now() - createdAtMs
    const totalEstimateMs = 120000 // 120 seconds
    estimatedRemaining = Math.max(0, Math.round((totalEstimateMs - elapsedMs) / 1000))
  }

  return {
    success: true,
    data: {
      license_id: licenseId,
      workspace_slug: workspaceSlug,
      organization_name: organizationName,
      status,
      created_at: createdAt,
      provisioned_at: provisionedAt,
      failed_at: failedAt,
      last_provision_error: lastError,
      retry_count: retryCount,
      estimated_remaining_seconds: estimatedRemaining,
    },
    error: null,
  }
}

/**
 * Create error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ErrorResponse {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
      details,
    },
  }
}

/**
 * Create rate limit headers
 */
export function createRateLimitHeaders(
  limit: number,
  remaining: number,
  resetAt: Date,
  correlationId: string
): RateLimitHeaders {
  return {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.floor(resetAt.getTime() / 1000)),
    'X-Correlation-ID': correlationId,
  }
}

/**
 * Create idempotency headers
 */
export function createIdempotencyHeaders(isReplay: boolean, storedAt?: Date): IdempotencyHeaders {
  const headers: IdempotencyHeaders = {
    'Idempotent-Replay': isReplay ? 'true' : 'false',
  }
  if (isReplay && storedAt) {
    headers['Idempotent-Response-Stored-At'] = storedAt.toISOString()
  }
  return headers
}
