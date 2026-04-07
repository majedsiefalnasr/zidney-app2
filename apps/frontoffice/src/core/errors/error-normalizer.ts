import type { AdapterResponse, AppError } from '@zidney/api-client'
import {
  createAppError,
  ErrorCodes,
  isAppError,
  mapHttpStatusToCode,
  normalizeResponseError,
} from '@zidney/api-client'

export function normalizeError(raw: unknown): AppError {
  // 1. TypeError → network failure
  if (raw instanceof TypeError) {
    return createAppError({
      code: ErrorCodes.NETWORK_ERROR,
      message: raw.message || 'Network request failed',
      httpStatus: 0,
      isNetworkError: true,
    })
  }

  // 2. Already an AppError — pass through
  if (isAppError(raw)) return raw

  // 3. Legacy NormalizedError (has code + httpStatus, lacks isNetworkError — migration safety)
  if (
    typeof raw === 'object' &&
    raw !== null &&
    typeof (raw as Record<string, unknown>).code === 'string' &&
    typeof (raw as Record<string, unknown>).httpStatus === 'number' &&
    !('isNetworkError' in raw)
  ) {
    const leg = raw as { code: string; message?: string; httpStatus: number }
    return createAppError({
      code: leg.code,
      message: leg.message ?? 'Request failed',
      httpStatus: leg.httpStatus,
      isNetworkError: false,
    })
  }

  // 4. Structured API body: { success: false, error: { code, message } }
  if (typeof raw === 'object' && raw !== null) {
    const r = raw as Record<string, unknown>
    if (r.success === false && typeof r.error === 'object' && r.error !== null) {
      const err = r.error as Record<string, unknown>
      if (typeof err.code === 'string' && typeof err.message === 'string') {
        const status = typeof r.httpStatus === 'number' ? (r.httpStatus as number) : 0
        return createAppError({
          code: err.code,
          message: err.message,
          httpStatus: status,
          isNetworkError: false,
        })
      }
    }

    // 5. AdapterResponse shape → delegate to shared normalizeResponseError
    if (typeof r.status === 'number' && 'headers' in r && 'body' in r) {
      return normalizeResponseError(raw as AdapterResponse)
    }

    // 6. Raw HTTP-like object with status code only
    if (typeof r.status === 'number') {
      return createAppError({
        code: mapHttpStatusToCode(r.status as number),
        message: typeof r.statusText === 'string' ? r.statusText : 'Request failed',
        httpStatus: r.status as number,
        isNetworkError: false,
      })
    }
  }

  // 7. Fallback
  return createAppError({
    code: ErrorCodes.UNKNOWN_ERROR,
    message: 'An unexpected error occurred',
    httpStatus: -1,
    isNetworkError: false,
  })
}
