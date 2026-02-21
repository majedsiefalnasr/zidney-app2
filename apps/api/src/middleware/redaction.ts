import { Context, Next } from 'hono'

/**
 * Redaction patterns for sensitive data detection.
 * Defense-in-depth: Redact before any logging occurs.
 */
const REDACTION_PATTERNS = {
  jwt: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  password: /"password"\s*:\s*"[^"]*"/gi,
  token:
    /"(authorization|token|api_key|secret|access_token|refresh_token)"\s*:\s*"[^"]*"/gi,
  email: /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
  ssn: /\d{3}-\d{2}-\d{4}/g,
  credit_card: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g,
  phone: /\+?1?\s?\(?([0-9]{3})\)?[\s.-]?([0-9]{3})[\s.-]?([0-9]{4})/g,
}

/**
 * Redact sensitive data from a string using regex patterns.
 * Applies multiple patterns for defense-in-depth protection.
 *
 * @param str - String to redact
 * @param patterns - Patterns to apply for redaction
 * @returns Redacted string with sensitive data masked
 */
export function redactSensitiveData(str: string): string {
  if (!str || typeof str !== 'string') {
    return str
  }

  let redacted = str

  // Apply JWT redaction
  redacted = redacted.replace(REDACTION_PATTERNS.jwt, '[REDACTED_JWT]')

  // Apply password redaction
  redacted = redacted.replace(
    REDACTION_PATTERNS.password,
    '"password":"[REDACTED]"'
  )

  // Apply token redaction
  redacted = redacted.replace(
    REDACTION_PATTERNS.token,
    (match) => match.split('"')[1] + '":"[REDACTED]"'
  )

  // Apply email redaction (with partial masking for context)
  redacted = redacted.replace(REDACTION_PATTERNS.email, (email) => {
    const [name] = email.split('@')
    const maskedName = name.charAt(0) + '*'.repeat(name.length - 1)
    return `${maskedName}@***`
  })

  // Apply SSN redaction
  redacted = redacted.replace(REDACTION_PATTERNS.ssn, '***-**-****')

  // Apply credit card redaction
  redacted = redacted.replace(
    REDACTION_PATTERNS.credit_card,
    '****-****-****-****'
  )

  // Apply phone redaction
  redacted = redacted.replace(
    REDACTION_PATTERNS.phone,
    (match) => '***-***-' + match.slice(-4)
  )

  return redacted
}

/**
 * Redaction middleware - applied before route handlers.
 * Middleware is primarily informational; actual redaction happens in logger serializers (T001).
 * This middleware stores sanitized request body for reference.
 *
 * Primary redaction happens at Pino serializer level (defense-in-depth).
 */
export function redactionMiddleware() {
  return async (c: Context, next: Next): Promise<void> => {
    // For GET/HEAD/DELETE requests with no body, skip body processing
    if (['GET', 'HEAD', 'DELETE'].includes(c.req.method)) {
      await next()
      return
    }

    try {
      // Clone request body for analysis
      const bodyText = await c.req.text()

      // Attempt to parse and redact JSON body
      try {
        const parsed = JSON.parse(bodyText)
        const sanitized = redactSensitiveData(JSON.stringify(parsed))
        c.set('sanitized_body', JSON.parse(sanitized))
      } catch {
        // Body is not JSON, apply string redaction
        const sanitized = redactSensitiveData(bodyText)
        c.set('sanitized_body', sanitized)
      }

      // Continue to next middleware
      await next()
    } catch {
      // If body reading fails, continue without sanitization
      await next()
    }
  }
}
