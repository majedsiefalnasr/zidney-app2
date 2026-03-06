/**
 * Authentication Type Definitions
 *
 * File: packages/domain-core/src/auth/types.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Central TypeScript interfaces for all authentication domains (MMC, Backoffice, Frontoffice).
 * Ensures type safety across authentication stack.
 *
 * Domains:
 * 1. MMC (Platform) - master database, global scope
 * 2. Backoffice (Workspace staff) - tenant database, workspace-scoped
 * 3. Frontoffice (Students) - tenant database, workspace-scoped
 *
 * Compliance:
 * - ADR-0001: Database-per-tenant (MMC in master, others in tenant)
 * - AGENTS.md: Strict type definitions prevent architectural drift
 */

/**
 * ================================================================
 * JWT PAYLOAD TYPES
 * ================================================================
 */

/**
 * Base JWT claims (common to all domains)
 */
export interface JwtPayloadBase {
  /** JWT issued at timestamp */
  iat: number
  /** JWT expiration timestamp */
  exp: number
  /** User ID (subject of token) */
  user_id: string
  /** User email for audit trail */
  user_email: string
  /** Token version for stateless invalidation */
  token_version: number
  /** Workspace schema version (for compatibility checks) */
  schema_version: string
  /** Product version (for compatibility checks) */
  product_version: string
}

/**
 * MMC Authentication Domain
 * - Platform administrators & operators
 * - Stored in: master_db
 * - Scope: Global (no workspace context)
 * - NOT allowed: workspace_id, division_id
 */
export interface JwtPayloadMmc extends JwtPayloadBase {
  scope: 'MMC'
  role: 'ADMIN' | 'OPERATOR'
}

/**
 * Backoffice Authentication Domain
 * - Workspace staff (instructors, admins)
 * - Stored in: tenant_db
 * - Scope: Single workspace
 * - workspace_id: Required (validated on every request)
 */
export interface JwtPayloadBackoffice extends JwtPayloadBase {
  scope: 'BACKOFFICE'
  workspace_id: string
  role: 'ADMIN' | 'INSTRUCTOR' | 'STAFF'
  /** Optional permissions array (derived from role) */
  permissions?: string[]
}

/**
 * Frontoffice Authentication Domain
 * - Students
 * - Stored in: tenant_db
 * - Scope: Single workspace + single division
 * - workspace_id: Required
 * - division_id: Required (students belong to exactly one division)
 * - subscription_status: Required (for access control)
 */
export interface JwtPayloadFrontoffice extends JwtPayloadBase {
  scope: 'FRONTOFFICE'
  workspace_id: string
  division_id: string
  role: 'STUDENT'
  /** Subscription status affects content access */
  subscription_status: 'ACTIVE' | 'EXPIRED' | 'PENDING'
}

/**
 * Union type for all JWT payload variants
 */
export type JwtPayload = JwtPayloadMmc | JwtPayloadBackoffice | JwtPayloadFrontoffice

/**
 * ================================================================
 * USER TYPES
 * ================================================================
 */

/**
 * MMC User (stored in master_db)
 */
export interface MmcUser {
  id: string
  email: string
  password_hash: string
  role: 'ADMIN' | 'OPERATOR'
  token_version: number
  locked_until: Date | null
  failed_login_count: number
  is_active: boolean
  created_at: Date
  updated_at: Date
  last_login: Date | null
}

/**
 * Tenant User (backoffice - staff/instructors)
 */
export interface BackofficeUser {
  id: string
  email: string
  password_hash: string
  role: 'ADMIN' | 'INSTRUCTOR' | 'STAFF'
  token_version: number
  locked_until: Date | null
  failed_login_count: number
  is_active: boolean
  created_at: Date
  updated_at: Date
  division_id?: string | null
  subscription_status: null // Null for backoffice users
}

/**
 * Tenant User (frontoffice - students)
 */
export interface FrontofficeUser {
  id: string
  email: string
  password_hash: string
  role: 'STUDENT'
  token_version: number
  locked_until: Date | null
  failed_login_count: number
  is_active: boolean
  created_at: Date
  updated_at: Date
  division_id: string
  subscription_status: 'ACTIVE' | 'EXPIRED' | 'PENDING'
}

/**
 * Union type for all user types
 */
export type TenantUser = BackofficeUser | FrontofficeUser

/**
 * ================================================================
 * SESSION/LOGIN TYPES
 * ================================================================
 */

/**
 * Login request payload
 */
export interface LoginRequest {
  email: string
  password: string
}

/**
 * Successful login response (includes JWT token)
 */
export interface LoginResponse {
  success: true
  data: {
    access_token: string
    token_type: 'Bearer'
    expires_in: number
    user: {
      id: string
      email: string
      role: string
      workspace_id?: string
      division_id?: string
    }
  }
  error: null
}

/**
 * Failed login response
 */
export interface LoginErrorResponse {
  success: false
  data: null
  error: {
    code: string
    message: string
  }
}

/**
 * ================================================================
 * AUTHENTICATION CONTEXT
 * ================================================================
 */

/**
 * Authenticated request context (set by middleware)
 */
export interface AuthContext {
  /** User ID from JWT */
  userId: string
  /** User role */
  role: string
  /** Permission codes derived from role (if backoffice) */
  permissions: string[]
  /** Workspace ID (if tenant-scoped) */
  workspaceId?: string
  /** Division ID (if frontoffice) */
  divisionId?: string
  /** Full JWT payload */
  payload: JwtPayload
  /** Whether user is authenticated */
  isAuthenticated: boolean
  /** Correlation ID for request tracing */
  correlationId: string
}

/**
 * ================================================================
 * AUDIT LOG TYPES
 * ================================================================
 */

/**
 * Audit event types
 */
export type AuditEventType =
  | 'login_success'
  | 'login_failed'
  | 'account_locked'
  | 'token_issued'
  | 'token_invalidated'
  | 'token_version_mismatch'
  | 'workspace_mismatch'
  | 'schema_mismatch'
  | 'license_blocked'
  | 'permission_denied'
  | 'logout'
  | 'role_changed'
  | 'password_changed'
  | 'account_unlocked'

/**
 * Audit event result
 */
export type AuditResult = 'SUCCESS' | 'FAILURE' | 'BLOCKED'

/**
 * Audit log entry
 */
export interface AuditLog {
  id: string
  correlation_id: string
  event_type: AuditEventType
  result: AuditResult
  user_id: string | null
  user_email: string | null
  workspace_slug: string
  ip_address: string | null
  user_agent: string | null
  metadata: Record<string, any>
  schema_version: string | null
  product_version: string | null
  timestamp: Date
}

/**
 * Audit event data for logging
 */
export interface AuditEventData {
  correlationId: string
  eventType: AuditEventType
  result: AuditResult
  userId?: string
  userEmail?: string
  workspaceSlug: string
  ipAddress?: string
  userAgent?: string
  metadata?: Record<string, any>
  schemaVersion?: string
  productVersion?: string
}

/**
 * ================================================================
 * ERROR TYPES
 * ================================================================
 */

/**
 * Authentication error codes
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  USER_INACTIVE = 'USER_INACTIVE',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_INVALID = 'TOKEN_INVALID',
  TOKEN_VERSION_MISMATCH = 'TOKEN_VERSION_MISMATCH',
  WORKSPACE_MISMATCH = 'WORKSPACE_MISMATCH',
  SCHEMA_MISMATCH = 'SCHEMA_MISMATCH',
  PRODUCT_VERSION_INCOMPATIBLE = 'PRODUCT_VERSION_INCOMPATIBLE',
  LICENSE_BLOCKED = 'LICENSE_BLOCKED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  INVALID_SCOPE = 'INVALID_SCOPE',
  MISSING_WORKSPACE_ID = 'MISSING_WORKSPACE_ID',
}

/**
 * Authentication error
 */
export class AuthError extends Error {
  constructor(
    public code: AuthErrorCode,
    public message: string,
    public statusCode: number = 401,
    public metadata?: Record<string, any>
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

/**
 * ================================================================
 * RBAC TYPES
 * ================================================================
 */

/**
 * Role definition
 */
export interface Role {
  id: string
  code: string
  name: string
  description?: string
}

/**
 * Role permission mapping
 */
export interface RolePermission {
  id: string
  role_id: string
  permission_code: string
}

/**
 * Permission evaluation result
 */
export interface PermissionResult {
  allowed: boolean
  reason?: string
  metadata?: Record<string, any>
}

/**
 * RBAC context for permission evaluation
 */
export interface RbacContext {
  userId: string
  workspace_id?: string
  role: string
  permissions: string[]
  division_id?: string
}
