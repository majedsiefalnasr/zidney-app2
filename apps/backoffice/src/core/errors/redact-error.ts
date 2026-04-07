import type { AppError } from '@zidney/api-client'
import { createAppError } from '@zidney/api-client'

const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g
const CREDENTIAL_PATTERN = /(password|token|secret)=[^\s&]*/gi
const STACK_FRAME_PATTERN = /\s+at\s+[^\n]+/gm

/**
 * Redact sensitive data from an AppError.
 * In production, stack frame lines are also stripped.
 */
export function redactError(error: AppError, isProduction: boolean): AppError {
  let message = error.message
    .replace(BEARER_PATTERN, 'Bearer [REDACTED]')
    .replace(CREDENTIAL_PATTERN, '$1=[REDACTED]')

  if (isProduction) {
    message = message.replace(STACK_FRAME_PATTERN, '')
  }

  return Object.freeze(
    createAppError({
      code: error.code,
      message: message.trim(),
      httpStatus: error.httpStatus,
      isNetworkError: error.isNetworkError,
      ...(error.retryAfter !== undefined ? { retryAfter: error.retryAfter } : {}),
    })
  )
}
