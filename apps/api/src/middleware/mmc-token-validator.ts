/**
 * MMC Token Validator Middleware
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Validates Bearer token authentication for MMC service account.
 * Required for all provisioning endpoints.
 *
 * Token Format: Bearer <service-token>
 * Validation: Token must match MMC_SERVICE_TOKEN environment variable
 *
 * Failure: Returns 401 Unauthorized
 */

import {
  ProvisioningErrorCode,
  getErrorDetails,
} from '@zidney/types/errors/provisioning-errors'
import { Context, Next } from 'hono'
import { createErrorResponse } from '../routes/licenses/license-response'

/**
 * MMC Token Validator Middleware
 */
export async function mmcTokenValidator(
  c: Context,
  next: Next
): Promise<Response | void> {
  const authHeader = c.req.header('authorization')

  if (!authHeader) {
    const error = getErrorDetails(ProvisioningErrorCode.UNAUTHORIZED_SERVICE)
    c.status(error.httpStatus)
    return c.json(
      createErrorResponse(
        ProvisioningErrorCode.UNAUTHORIZED_SERVICE,
        'Missing Authorization header'
      )
    )
  }

  // Parse Bearer token
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    const error = getErrorDetails(ProvisioningErrorCode.UNAUTHORIZED_SERVICE)
    c.status(error.httpStatus)
    return c.json(
      createErrorResponse(
        ProvisioningErrorCode.UNAUTHORIZED_SERVICE,
        'Invalid Authorization header format; expected: Bearer <token>'
      )
    )
  }

  const token = parts[1]
  const expectedToken = process.env.MMC_SERVICE_TOKEN || 'dev-token-not-set'

  // Constant-time comparison to prevent timing attacks
  if (!constantTimeCompare(token, expectedToken)) {
    const error = getErrorDetails(ProvisioningErrorCode.UNAUTHORIZED_SERVICE)
    c.status(error.httpStatus)
    return c.json(
      createErrorResponse(
        ProvisioningErrorCode.UNAUTHORIZED_SERVICE,
        'Invalid or expired service token'
      )
    )
  }

  // Token is valid
  c.set('mmcServiceToken', token)
  await next()
}

/**
 * Constant-time string comparison
 * Prevents timing attacks on token comparison
 */
function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Alternative: Get MMC service token from context
 */
export function getMMCServiceToken(c: Context): string | undefined {
  return c.get('mmcServiceToken')
}
