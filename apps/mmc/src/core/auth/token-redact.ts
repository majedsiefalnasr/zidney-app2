/**
 * Token redaction utility for MMC.
 * Scrubs access token values from log objects before structured logging.
 *
 * Rules (FR-SEC-03, Constitutional token-opacity):
 * - Tokens must not appear in logs in full, partial, truncated, or hashed form.
 * - The only safe representation is complete omission: "[REDACTED]".
 * - No substring of the token value may survive.
 *
 * Pure function — zero runtime imports — safe to use in any test environment.
 *
 * Stage: STAGE_UI_09_SECURITY_AND_TOKEN_HANDLING
 */

/** Well-known log fields that may contain token values. */
const SENSITIVE_KEYS = new Set([
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'authorization',
  'Authorization',
  'password',
  'credential',
  // CSRF tokens (FR-SEC-03: all credential-class fields must be redacted)
  'csrfToken',
  'csrf_token',
  'x-csrf-token',
  'X-CSRF-Token',
])

const REDACTED = '[REDACTED]' as const

/**
 * Returns a shallow copy of `logObject` with sensitive fields replaced by "[REDACTED]".
 * Does not recurse into nested objects — callers are responsible for flattening.
 *
 * IMPLEMENTATION NOTE (H2 — test helper):
 * To protect against future regressions where a nested object containing a token is passed
 * directly to a logger, unit tests must include an `assertNoTokenInLogArgs` helper that
 * inspects all arguments passed to `packages/logger` during test execution and asserts that
 * no argument (at any nesting depth) contains a string matching `looksLikeToken()`. This is
 * tested in T026–T028 (token-redact unit tests). Shallow-copy behaviour is intentional:
 * nested objects must be pre-flattened by the caller before passing to this function.
 */
export function redactSensitiveFields<T extends Record<string, unknown>>(
  logObject: T
): T {
  const result = { ...logObject }
  for (const key of Object.keys(result)) {
    if (SENSITIVE_KEYS.has(key)) {
      result[key as keyof T] = REDACTED as unknown as T[keyof T]
    }
  }
  return result
}

/**
 * Type guard: returns true if the value looks like an access token string
 * (long base64url string). Used in tests to verify no token leaked.
 */
export function looksLikeToken(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return value.length > 20 && /^[A-Za-z0-9\-_=.]+$/.test(value)
}
