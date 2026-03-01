// ─── Types ──────────────────────────────────────────────────────────────────
export type {
  AdapterRequest,
  AdapterResponse,
  ApiClient,
  AppError,
  ClientConfig,
  ClientResponse,
  HttpAdapter,
  RequestConfig,
} from './types'

// ─── Error Utilities ────────────────────────────────────────────────────────
export { createAppError, ErrorCodes, isAppError } from './http-error'

// ─── Client Factory ─────────────────────────────────────────────────────────
export { createApiClient } from './client'

// ─── Adapters ───────────────────────────────────────────────────────────────
export { createFetchAdapter } from './adapters/fetch-adapter'
export { createMockAdapter } from './adapters/mock-adapter'
export type { MockAdapter } from './adapters/mock-adapter'
