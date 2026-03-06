/**
 * Error response interceptor for Backoffice.
 * Handles authenticated-session-only 401 expiry flow and 423/426 license responses.
 *
 * INVARIANTS:
 * - FR-SEC-07: Session-expiry flow ONLY fires when store.isAuthenticated === true
 * - FR-SEC-08: _isHandling401 boolean prevents parallel storm; reset after redirect
 * - FR-SEC-20: 423 → onLicenseError(423) — no retry, no override
 * - FR-SEC-21: 426 → onLicenseError(426) — no retry, no override
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 */
import { createLogger } from '@zidney/logger'

const logger = createLogger('auth:error-interceptor')

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ErrorInterceptorOptions {
  /** Returns current isAuthenticated value from auth store */
  getIsAuthenticated: () => boolean
  /** Triggers session-expiry flow: set authError + clear state + redirect to login */
  onSessionExpired: () => Promise<void>
  /** Triggered for 423 (workspace locked) and 426 (upgrade required) responses */
  onLicenseError: (status: 423 | 426) => void
}

export interface IErrorInterceptor {
  /**
   * Call this from the onAuthFailure callback in createAppApiClient.
   * Applies the isAuthenticated guard before triggering session expiry.
   */
  handleAuthFailure(): Promise<void>
  /**
   * Call this when a non-ok HTTP response is received with status 423 or 426.
   */
  handleLicenseError(status: 423 | 426): void
  /**
   * True while a 401 expiry flow is in progress.
   * Prevents concurrent interceptor invocations from re-entering the flow.
   */
  readonly isHandling401: boolean
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates the error interceptor with isAuthenticated guard and idempotency protection.
 *
 * @param options - Callbacks for session expiry and license error handling
 */
export function createErrorInterceptor(options: ErrorInterceptorOptions): IErrorInterceptor {
  let _isHandling401 = false

  return {
    get isHandling401() {
      return _isHandling401
    },

    async handleAuthFailure(): Promise<void> {
      // FR-SEC-07: only trigger expiry flow for authenticated sessions
      if (!options.getIsAuthenticated()) {
        logger.debug('401 received on unauthenticated request — passing through')
        return
      }

      // FR-SEC-08: idempotency guard — drop storm
      if (_isHandling401) {
        logger.debug('401 expiry flow already in progress — dropping duplicate')
        return
      }

      _isHandling401 = true
      logger.warn('Authenticated session 401 — initiating session expiry flow')

      try {
        await options.onSessionExpired()
      } finally {
        _isHandling401 = false
      }
    },

    handleLicenseError(status: 423 | 426): void {
      logger.warn('License-related HTTP response received', { status })
      options.onLicenseError(status)
    },
  }
}
