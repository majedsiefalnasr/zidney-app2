import type { AppError } from '@zidney/api-client'
import type { Logger } from '@zidney/logger'

import { normalizeError } from './error-normalizer'
import { redactError } from './redact-error'

export interface GlobalErrorHandlerOptions {
  onError: (error: AppError) => void
  logger?: Logger | undefined
  isProduction?: boolean
}

type UnhandledRejectionHandler = (event: PromiseRejectionEvent) => void
type ErrorHandler = (event: ErrorEvent) => void

let _rejectionHandler: UnhandledRejectionHandler | null = null
let _errorHandler: ErrorHandler | null = null

export function registerGlobalErrorHandlers(options: GlobalErrorHandlerOptions): void {
  const { onError, logger, isProduction = false } = options

  function handle(raw: unknown): void {
    const normalized = normalizeError(raw)
    const safe = redactError(normalized, isProduction)
    logger?.error('global unhandled error', {
      code: safe.code,
      httpStatus: safe.httpStatus,
      isNetworkError: safe.isNetworkError,
    })
    onError(safe)
  }

  _rejectionHandler = (event: PromiseRejectionEvent) => {
    event.preventDefault()
    handle(event.reason)
  }

  _errorHandler = (event: ErrorEvent) => {
    event.preventDefault()
    handle(event.error ?? new Error(event.message))
  }

  window.addEventListener('unhandledrejection', _rejectionHandler)
  window.addEventListener('error', _errorHandler)
}

export function unregisterGlobalErrorHandlers(): void {
  if (_rejectionHandler !== null) {
    window.removeEventListener('unhandledrejection', _rejectionHandler)
    _rejectionHandler = null
  }
  if (_errorHandler !== null) {
    window.removeEventListener('error', _errorHandler)
    _errorHandler = null
  }
}
