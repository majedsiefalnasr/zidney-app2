import type { ApiErrorResponse, NormalizedError } from './types'

function isApiErrorResponse(raw: unknown): raw is ApiErrorResponse {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as Record<string, unknown>).success === false &&
    typeof (raw as Record<string, unknown>).error === 'object' &&
    (raw as Record<string, unknown>).error !== null &&
    typeof ((raw as Record<string, { code: unknown }>).error as Record<string, unknown>).code ===
      'string' &&
    typeof ((raw as Record<string, { message: unknown }>).error as Record<string, unknown>)
      .message === 'string'
  )
}

export function normalizeError(raw: unknown): NormalizedError {
  // Network error: TypeError (e.g. "Failed to fetch") or httpStatus === 0
  if (raw instanceof TypeError) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Network request failed',
      httpStatus: 0,
    }
  }

  // Structured normalized error already (from internal rethrow)
  if (
    typeof raw === 'object' &&
    raw !== null &&
    typeof (raw as Record<string, unknown>).code === 'string' &&
    typeof (raw as Record<string, unknown>).httpStatus === 'number'
  ) {
    return raw as NormalizedError
  }

  // Standard API error response shape
  if (
    typeof raw === 'object' &&
    raw !== null &&
    isApiErrorResponse((raw as Record<string, unknown>).body)
  ) {
    const body = (raw as Record<string, unknown>).body as ApiErrorResponse
    const status =
      typeof (raw as Record<string, unknown>).httpStatus === 'number'
        ? ((raw as Record<string, unknown>).httpStatus as number)
        : 0
    return {
      code: body.error.code,
      message: body.error.message,
      httpStatus: status,
    }
  }

  // Object with direct error shape (body already parsed)
  if (isApiErrorResponse(raw)) {
    return {
      code: (raw as ApiErrorResponse).error.code,
      message: (raw as ApiErrorResponse).error.message,
      httpStatus: 0,
    }
  }

  // Fallback: unknown shape
  return {
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
    httpStatus: -1,
  }
}
