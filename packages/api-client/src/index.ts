// ─── Types ──────────────────────────────────────────────────────────────────

// ─── Adapters ───────────────────────────────────────────────────────────────
export { createFetchAdapter } from './adapters/fetch-adapter'
export type { MockAdapter } from './adapters/mock-adapter'
export { createMockAdapter } from './adapters/mock-adapter'
// ─── Client Factory ─────────────────────────────────────────────────────────
export { createApiClient } from './client'
// ─── Error Utilities ────────────────────────────────────────────────────────
export {
  createAppError,
  ErrorCodes,
  isAppError,
  mapHttpStatusToCode,
  normalizeResponseError,
} from './http-error'
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
