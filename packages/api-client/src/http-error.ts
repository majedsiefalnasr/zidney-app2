import type { AdapterResponse, AppError } from './types'

// ─── Error Codes ────────────────────────────────────────────────────────────

export const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  REQUEST_CANCELLED: 'REQUEST_CANCELLED',
  RATE_LIMITED: 'RATE_LIMITED',
  AUTH_REFRESH_FAILED: 'AUTH_REFRESH_FAILED',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const

// ─── Type Guard ─────────────────────────────────────────────────────────────

/**
 * Type guard: checks if a thrown value is an AppError.
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as Record<string, unknown>)['code'] === 'string' &&
    typeof (error as Record<string, unknown>)['message'] === 'string' &&
    typeof (error as Record<string, unknown>)['httpStatus'] === 'number' &&
    typeof (error as Record<string, unknown>)['isNetworkError'] === 'boolean'
  )
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a frozen AppError object.
 */
export function createAppError(fields: {
  code: string
  message: string
  httpStatus: number
  isNetworkError: boolean
  retryAfter?: number
}): AppError {
  return Object.freeze({
    code: fields.code,
    message: fields.message,
    httpStatus: fields.httpStatus,
    isNetworkError: fields.isNetworkError,
    ...(fields.retryAfter !== undefined
      ? { retryAfter: fields.retryAfter }
      : {}),
  })
}

// ─── Response Error Normalization ───────────────────────────────────────────

/**
 * Normalize a non-ok AdapterResponse into an AppError.
 */
export function normalizeResponseError(response: AdapterResponse): AppError {
  // 429 Rate Limited
  if (response.status === 429) {
    const retryAfterRaw = response.headers['retry-after']
    const retryAfter =
      retryAfterRaw !== undefined ? Number(retryAfterRaw) : undefined
    const validRetryAfter =
      retryAfter !== undefined && !Number.isNaN(retryAfter)
        ? retryAfter
        : undefined

    return createAppError({
      code: ErrorCodes.RATE_LIMITED,
      message: 'Rate limited. Please try again later.',
      httpStatus: 429,
      isNetworkError: false,
      retryAfter: validRetryAfter,
    })
  }

  // Try to extract backend structured error: { success: false, error: { code, message } }
  const body = response.body
  if (
    typeof body === 'object' &&
    body !== null &&
    (body as Record<string, unknown>)['success'] === false &&
    typeof (body as Record<string, unknown>)['error'] === 'object' &&
    (body as Record<string, unknown>)['error'] !== null
  ) {
    const errorObj = (
      body as Record<string, { code: unknown; message: unknown }>
    )['error']
    if (
      typeof errorObj?.code === 'string' &&
      typeof errorObj?.message === 'string'
    ) {
      return createAppError({
        code: errorObj.code as string,
        message: errorObj.message as string,
        httpStatus: response.status,
        isNetworkError: false,
      })
    }
  }

  // Non-JSON or unexpected shape
  if (body === null || body === undefined) {
    return createAppError({
      code: ErrorCodes.INVALID_RESPONSE,
      message: 'Server returned an invalid response',
      httpStatus: response.status,
      isNetworkError: false,
    })
  }

  // Fallback: unknown error
  return createAppError({
    code: ErrorCodes.UNKNOWN_ERROR,
    message:
      typeof (body as Record<string, unknown>)['message'] === 'string'
        ? ((body as Record<string, unknown>)['message'] as string)
        : `Request failed with status ${response.status}`,
    httpStatus: response.status,
    isNetworkError: false,
  })
}

// ─── Network Error Normalization ────────────────────────────────────────────

/**
 * Normalize a thrown error (from adapter) into an AppError.
 */
export function normalizeNetworkError(error: unknown): AppError {
  // AbortError — check for timeout vs user cancellation
  if (error instanceof DOMException && error.name === 'AbortError') {
    // Check if this is a timeout abort
    // AbortSignal.timeout() sets reason to a TimeoutError DOMException
    const reason = (error as DOMException & { cause?: unknown }).cause
    if (reason instanceof DOMException && reason.name === 'TimeoutError') {
      return createAppError({
        code: ErrorCodes.REQUEST_TIMEOUT,
        message: 'Request timed out',
        httpStatus: 0,
        isNetworkError: true,
      })
    }
    // User-initiated cancellation
    return createAppError({
      code: ErrorCodes.REQUEST_CANCELLED,
      message: 'Request was cancelled',
      httpStatus: 0,
      isNetworkError: false,
    })
  }

  // TimeoutError DOMException (direct)
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return createAppError({
      code: ErrorCodes.REQUEST_TIMEOUT,
      message: 'Request timed out',
      httpStatus: 0,
      isNetworkError: true,
    })
  }

  // TypeError — fetch network failure (DNS, connection reset, etc.)
  if (error instanceof TypeError) {
    return createAppError({
      code: ErrorCodes.NETWORK_ERROR,
      message: error.message || 'Network request failed',
      httpStatus: 0,
      isNetworkError: true,
    })
  }

  // Already an AppError — pass through
  if (isAppError(error)) {
    return error
  }

  // Unknown error
  return createAppError({
    code: ErrorCodes.UNKNOWN_ERROR,
    message:
      error instanceof Error ? error.message : 'An unknown error occurred',
    httpStatus: 0,
    isNetworkError: false,
  })
}
