/**
 * @zidney/api-client — Public API Contract
 *
 * This file defines the public TypeScript interface contract for the API client package.
 * All frontend apps (MMC, Backoffice, Frontoffice) consume this API.
 *
 * Feature: UI-02 API Client Layer
 * Date: 2026-03-01
 *
 * NOTE: This is a contract definition file, not runtime code.
 * Implementation lives in packages/api-client/src/.
 */

// ─── Error Types ────────────────────────────────────────────────────────────

/**
 * Normalized error object consumed by all UI code.
 *
 * Every API failure (network, HTTP, timeout, cancellation) is normalized
 * into this structure before reaching the caller.
 */
export interface AppError {
  /** Machine-readable error code (e.g., 'NETWORK_ERROR', 'RATE_LIMITED', or backend error code) */
  readonly code: string
  /** Human-readable error description */
  readonly message: string
  /** HTTP status code. 0 for non-HTTP errors (network, timeout, cancellation). */
  readonly httpStatus: number
  /** true for DNS failure, connection reset, timeout */
  readonly isNetworkError: boolean
  /** Seconds until retry allowed. Present only on 429 responses with Retry-After header. */
  readonly retryAfter?: number
}

// ─── Request/Response Types ─────────────────────────────────────────────────

/**
 * Per-request configuration. All fields are optional.
 */
export interface RequestConfig {
  /** Query parameters appended to the URL. Serialized to query string. */
  readonly params?: Record<string, string | number | boolean>
  /** Idempotency key sent as Idempotency-Key header. Attached on mutations (POST/PATCH/PUT/DELETE) only. Ignored on GET. */
  readonly idempotencyKey?: string
  /** Override auto-generated correlation ID for X-Correlation-ID header. */
  readonly correlationId?: string
  /** Caller-provided abort signal for request cancellation. */
  readonly signal?: AbortSignal
  /** Per-request timeout in milliseconds. Default: 30000. Set 0 to disable. */
  readonly timeout?: number
  /** Additional custom headers (merged after interceptors). */
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
 *
 * Production: FetchAdapter (wraps native fetch)
 * Testing: MockAdapter (queue-based, deterministic)
 */
export interface HttpAdapter {
  execute(request: AdapterRequest): Promise<AdapterResponse>
}

// ─── Client Configuration ───────────────────────────────────────────────────

/**
 * Configuration for createApiClient factory.
 * Each app (MMC, Backoffice, Frontoffice) provides its own configuration.
 */
export interface ClientConfig {
  /** API base URL (from app's env.ts). No trailing slash. */
  readonly baseUrl: string
  /** Default timeout in milliseconds for all requests. Default: 30000. */
  readonly defaultTimeout?: number
  /** Returns current access token or null if unauthenticated. Must never throw. */
  readonly getAccessToken: () => string | null
  /** Performs token refresh. Returns new access token. Throws/rejects on failure. */
  readonly onRefreshToken: () => Promise<string>
  /** Called when auth refresh fails (e.g., navigate to login, clear auth state). */
  readonly onAuthFailure: () => void
  /** Fetch credentials mode. Default: 'include' (needed for httpOnly cookie auth). */
  readonly credentials?: RequestCredentials
  /** Injectable HTTP transport. Default: FetchAdapter. */
  readonly adapter?: HttpAdapter
}

// ─── Client Interface ───────────────────────────────────────────────────────

/**
 * Public API client interface.
 *
 * All frontend HTTP communication goes through this interface.
 * No module may call fetch/axios directly.
 */
export interface ApiClient {
  /** HTTP GET */
  get<T>(url: string, config?: RequestConfig): Promise<ClientResponse<T>>
  /** HTTP POST */
  post<T>(url: string, data: unknown, config?: RequestConfig): Promise<ClientResponse<T>>
  /** HTTP PUT */
  put<T>(url: string, data: unknown, config?: RequestConfig): Promise<ClientResponse<T>>
  /** HTTP PATCH */
  patch<T>(url: string, data: unknown, config?: RequestConfig): Promise<ClientResponse<T>>
  /** HTTP DELETE */
  delete<T>(url: string, data?: unknown, config?: RequestConfig): Promise<ClientResponse<T>>
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a configured API client instance.
 *
 * Each app calls this once with its configuration.
 * The factory returns an ApiClient that handles:
 * - Auth token injection
 * - Correlation ID generation
 * - Idempotency key headers
 * - Timeout enforcement
 * - 401 single-flight refresh + retry
 * - Error normalization to AppError
 * - 429 rate-limit surfacing
 * - Request cancellation via AbortSignal
 */
export declare function createApiClient(config: ClientConfig): ApiClient

// ─── Adapters ───────────────────────────────────────────────────────────────

/**
 * Production HTTP adapter using native fetch.
 */
export declare function createFetchAdapter(): HttpAdapter

/**
 * Test mock HTTP adapter with queue-based response control.
 */
export interface MockAdapter extends HttpAdapter {
  /** Add a response to the FIFO queue */
  enqueue(response: Partial<AdapterResponse>): void
  /** Add a network error to the queue (simulates fetch TypeError) */
  enqueueError(error: Error): void
  /** Return all received requests (for test assertions) */
  getRequests(): AdapterRequest[]
  /** Return the most recent request */
  getLastRequest(): AdapterRequest | undefined
  /** Clear response queue and request log */
  reset(): void
  /** Assert exact number of requests made (throws if mismatch) */
  assertRequestCount(count: number): void
}

export declare function createMockAdapter(): MockAdapter

// ─── Error Utilities ────────────────────────────────────────────────────────

/**
 * Type guard: checks if a thrown value is an AppError.
 */
export declare function isAppError(error: unknown): error is AppError

/**
 * Known error codes emitted by the client.
 * Backend error codes are passed through as-is.
 */
export declare const ErrorCodes: {
  readonly NETWORK_ERROR: 'NETWORK_ERROR'
  readonly REQUEST_TIMEOUT: 'REQUEST_TIMEOUT'
  readonly REQUEST_CANCELLED: 'REQUEST_CANCELLED'
  readonly RATE_LIMITED: 'RATE_LIMITED'
  readonly AUTH_REFRESH_FAILED: 'AUTH_REFRESH_FAILED'
  readonly INVALID_RESPONSE: 'INVALID_RESPONSE'
  readonly UNKNOWN_ERROR: 'UNKNOWN_ERROR'
}
