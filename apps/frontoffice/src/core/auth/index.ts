/**
 * Auth module public API for Frontoffice.
 * Re-exports from all new auth modules introduced in STAGE_UI_01_AUTH_MODULE.
 * The old useAuth() composable and token-store.ts are superseded by this stage.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */

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

// Token Manager
export { createTokenManager } from './token-manager'
export type { ITokenManager } from './token-manager'

// Refresh Manager
export { createRefreshManager } from './refresh-manager'
export type { IRefreshManager, RefreshManagerFactory } from './refresh-manager'

// Auth Service
export { createAuthService } from './auth.service'
export type { IAuthService } from './auth.service'
