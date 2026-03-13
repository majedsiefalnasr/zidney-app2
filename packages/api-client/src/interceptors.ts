// ─── Auth Interceptor ───────────────────────────────────────────────────────

/**
 * Attach Authorization: Bearer <token> header when token is available.
 */
export function applyAuthHeader(
  headers: Record<string, string>,
  getAccessToken: () => string | null
): void {
  const token = getAccessToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
}

// ─── Correlation ID Interceptor ─────────────────────────────────────────────

/**
 * Attach X-Correlation-ID header. Auto-generates UUID if not provided.
 */
export function applyCorrelationId(headers: Record<string, string>, correlationId?: string): void {
  headers['X-Correlation-ID'] = correlationId ?? crypto.randomUUID()
}

// ─── Content-Type Interceptor ───────────────────────────────────────────────

/**
 * Attach Content-Type: application/json on POST, PUT, PATCH mutations.
 */
export function applyContentType(headers: Record<string, string>, method: string): void {
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    headers['Content-Type'] = 'application/json'
  }
}

// ─── Idempotency Interceptor ────────────────────────────────────────────────

/**
 * Attach Idempotency-Key header on non-GET methods when key is provided.
 */
export function applyIdempotencyKey(
  headers: Record<string, string>,
  method: string,
  idempotencyKey?: string
): void {
  if (idempotencyKey && method !== 'GET') {
    headers['Idempotency-Key'] = idempotencyKey
  }
}

// ─── Timeout Interceptor ────────────────────────────────────────────────────

/**
 * Create a combined AbortSignal from timeout and optional user signal.
 * Returns undefined if no timeout and no user signal.
 */
export function createCombinedSignal(
  timeout: number,
  userSignal?: AbortSignal
): AbortSignal | undefined {
  const signals: AbortSignal[] = []

  if (timeout > 0) {
    signals.push(AbortSignal.timeout(timeout))
  }

  if (userSignal) {
    signals.push(userSignal)
  }

  if (signals.length === 0) return undefined
  if (signals.length === 1) {
    const [first] = signals
    if (first) return first
    return undefined
  }
  return AbortSignal.any(signals)
}
