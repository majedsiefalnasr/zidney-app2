// ─── Error Types ────────────────────────────────────────────────────────────

/**
 * Normalized error object consumed by all UI code.
 * Plain interface (not a class) — serializes cleanly, no prototype issues.
 */
export interface AppError {
  readonly code: string
  readonly message: string
  readonly httpStatus: number
  readonly isNetworkError: boolean
  readonly retryAfter?: number
}

// ─── Request/Response Types ─────────────────────────────────────────────────

/**
 * Per-request configuration. All fields are optional.
 */
export interface RequestConfig {
  readonly params?: Record<string, string | number | boolean>
  readonly idempotencyKey?: string
  readonly correlationId?: string
  readonly signal?: AbortSignal
  readonly timeout?: number
  readonly headers?: Record<string, string>
}

/**
 * Successful API response wrapper.
 * Named ClientResponse to avoid collision with @zidney/types ApiResponse.
 */
export interface ClientResponse<T> {
  readonly success: true
  readonly data: T
}

// ─── Transport Layer ────────────────────────────────────────────────────────

/**
 * Raw request passed to HttpAdapter.
 */
export interface AdapterRequest {
  readonly url: string
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  readonly headers: Record<string, string>
  readonly body?: string
  readonly signal?: AbortSignal
}

/**
 * Raw response returned by HttpAdapter.
 */
export interface AdapterResponse {
  readonly status: number
  readonly headers: Record<string, string>
  readonly body: unknown
  readonly ok: boolean
}

/**
 * Injectable HTTP transport interface.
 */
export interface HttpAdapter {
  execute(request: AdapterRequest): Promise<AdapterResponse>
}

// ─── Client Configuration ───────────────────────────────────────────────────

/**
 * Configuration for createApiClient factory.
 */
export interface ClientConfig {
  readonly baseUrl: string
  readonly defaultTimeout?: number
  readonly getAccessToken: () => string | null
  readonly onRefreshToken: () => Promise<string>
  readonly onAuthFailure: () => void
  readonly credentials?: RequestCredentials
  readonly adapter?: HttpAdapter
}

// ─── Client Interface ───────────────────────────────────────────────────────

/**
 * Public API client interface.
 */
export interface ApiClient {
  get<T>(url: string, config?: RequestConfig): Promise<ClientResponse<T>>
  post<T>(
    url: string,
    data: unknown,
    config?: RequestConfig
  ): Promise<ClientResponse<T>>
  put<T>(
    url: string,
    data: unknown,
    config?: RequestConfig
  ): Promise<ClientResponse<T>>
  patch<T>(
    url: string,
    data: unknown,
    config?: RequestConfig
  ): Promise<ClientResponse<T>>
  delete<T>(
    url: string,
    data?: unknown,
    config?: RequestConfig
  ): Promise<ClientResponse<T>>
}
