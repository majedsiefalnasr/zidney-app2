/**
 * Auth module public API for MMC.
 * Re-exports from all new auth modules introduced in STAGE_UI_01_AUTH_MODULE.
 * The old useAuth() composable and token-store.ts are superseded by this stage.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */

export type { IAuthService } from './auth.service'
// Auth Service
export { createAuthService } from './auth.service'
export type { IRefreshManager, RefreshManagerFactory } from './refresh-manager'

// Refresh Manager
export { createRefreshManager } from './refresh-manager'
export type { ITokenManager } from './token-manager'
// Token Manager
export { createTokenManager } from './token-manager'
// Token Redaction (FR-SEC-03)
export { looksLikeToken, redactSensitiveFields } from './token-redact'
// Types (zero runtime imports)
export type {
  AuthError,
  AuthErrorCode,
  AuthStoreState,
  AuthUser,
  LoginCredentials,
  LoginResponse,
  UserRole,
} from './types'
