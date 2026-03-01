/**
 * Auth layer TypeScript type definitions for MMC.
 * Zero runtime imports — this file is safe to import in test environments
 * without any framework setup.
 *
 * Stage: STAGE_UI_01_AUTH_MODULE
 */

// ─── Role ────────────────────────────────────────────────────────────────────
// TODO: Replace with packages/types MMCUserRole once a shared frontend-facing
//       enum is defined. MMC currently uses MMCUserRole from packages/types/master-db.
//       Using string alias for now to keep types portable across apps.
export type UserRole = string

// ─── Error Codes ─────────────────────────────────────────────────────────────
export type AuthErrorCode =
  | 'AUTH_REFRESH_FAILED' // refresh endpoint returned non-2xx or network error
  | 'AUTH_SESSION_EXPIRED' // 401 received after refresh was already attempted
  | 'AUTH_LOGOUT_FAILED' // logout endpoint error (non-fatal; state still cleared)
  | 'AUTH_INIT_FAILED' // initSession() silent refresh failed
  | 'AUTH_PROFILE_FETCH_FAILED' // /me endpoint failed after successful token acquisition

// ─── AuthError ───────────────────────────────────────────────────────────────
export interface AuthError {
  /** Machine-readable error discriminant from AuthErrorCode union */
  code: AuthErrorCode
  /** Human-readable message — must NOT contain token values */
  message: string
}

// ─── AuthUser ────────────────────────────────────────────────────────────────
export interface AuthUser {
  /** Backend-assigned UUID for the user */
  id: string
  /** Primary email address */
  email: string
  /** Display name — from backend /me response */
  name: string
  /** Role discriminant — populated from /me response, not JWT payload */
  role: UserRole
}

// ─── AuthStoreState ──────────────────────────────────────────────────────────
export interface AuthStoreState {
  /** True only after a backend-confirmed session (login or silent refresh) */
  isAuthenticated: boolean
  /** Populated from /me endpoint; null when not authenticated */
  user: AuthUser | null
  /** True during in-flight auth operations (initSession, login, logout) */
  isLoading: boolean
  /** Last auth failure; null after any successful auth operation */
  authError: AuthError | null
}

// ─── LoginCredentials ────────────────────────────────────────────────────────
export interface LoginCredentials {
  /** User email address */
  email: string
  /** Raw password — passed directly to backend without frontend validation */
  password: string
}

// ─── LoginResponse ───────────────────────────────────────────────────────────
export interface LoginResponse {
  /** Short-lived access token — stored in TokenManager memory only */
  accessToken: string
  /** Minimal user profile — same shape as AuthUser */
  user: AuthUser
}
