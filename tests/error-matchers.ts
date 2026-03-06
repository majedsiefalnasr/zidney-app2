/**
 * RFC 7807 Error Response Matchers
 * Custom matchers for error response validation
 */

export interface RFC7807Error {
  type?: string
  title?: string
  status: number
  detail?: string
  instance?: string
  error_code?: string
  [key: string]: any
}

/**
 * Custom Vitest matcher for RFC 7807 error format
 */
export function toMatchRFC7807(received: any, expectedStatus: number, expectedCode: string) {
  const pass =
    received &&
    received.status === expectedStatus &&
    received.error &&
    received.error.code === expectedCode &&
    received.data === null

  return {
    pass,
    message: () =>
      pass
        ? `Expected error NOT to match RFC 7807 format with status ${expectedStatus} and code ${expectedCode}`
        : `Expected error to match RFC 7807 format with status ${expectedStatus} and code ${expectedCode}, but got: ${JSON.stringify(received)}`,
  }
}

/**
 * Validate RFC 7807 error structure
 */
export function validateRFC7807Error(error: RFC7807Error): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!('status' in error)) {
    errors.push('Missing required field: status')
  }

  if (!('error_code' in error)) {
    errors.push('Missing required field: error_code')
  }

  if (typeof error.status !== 'number') {
    errors.push('Field "status" must be a number')
  }

  if (typeof error.error_code !== 'string') {
    errors.push('Field "error_code" must be a string')
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Assert error is a valid 4xx or 5xx RFC 7807 error
 */
export function assertIsRFC7807Error(error: any): RFC7807Error {
  if (!error) {
    throw new Error('Error object is null or undefined')
  }

  if (!('status' in error)) {
    throw new Error('Missing status field in error')
  }

  if (!('error_code' in error)) {
    throw new Error('Missing error_code field in error')
  }

  const status = error.status
  if (status < 400 || status >= 600) {
    throw new Error(`Invalid HTTP status for error: ${status}`)
  }

  return error as RFC7807Error
}

/**
 * Error code constants
 */
export const ErrorCodes = {
  INVALID_TRANSITION: 'INVALID_TRANSITION',
  SCHEMA_MISMATCH: 'SCHEMA_MISMATCH',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  UPGRADE_REQUIRED: 'UPGRADE_REQUIRED',
} as const

/**
 * HTTP status code constants
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UPGRADE_REQUIRED: 426,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SOFT_LOCKED: 423,
  ARCHIVED: 403,
} as const
