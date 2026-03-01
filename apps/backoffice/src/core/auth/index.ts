/**
 * Auth module public API for Backoffice.
 * Re-exports from all new auth modules introduced in STAGE_UI_01_AUTH_MODULE.
 * The old useAuth() composable and token-store.ts are superseded by this stage.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */

// Types (zero runtime imports)
export type {
  UserRole,
  AuthErrorCode,
  AuthError,
  AuthUser,
  AuthStoreState,
  LoginCredentials,
  LoginResponse,
} from './types'

// Token Manager
export type { ITokenManager } from './token-manager'
export { createTokenManager } from './token-manager'

// Refresh Manager
export type { IRefreshManager, RefreshManagerFactory } from './refresh-manager'
export { createRefreshManager } from './refresh-manager'

// Auth Service
export type { IAuthService } from './auth.service'
export { createAuthService } from './auth.service'

