/**
 * MMC Entity Types
 *
 * File: packages/types/src/mmc.types.ts
 * Task: T020
 * Phase: 3 - Member Management CRUD
 *
 * TypeScript interfaces for all MMC entities:
 * - Member
 * - Role
 * - Permission
 * - Invitation
 * - AuditLog
 *
 * Properties:
 * - Type-safe across services
 * - Marshaling-ready (JSON serialization)
 * - Immutability markers where applicable
 */

/**
 * MMC Member
 *
 * Internal platform user account with role assignment and session versioning
 */
export interface MMCMember {
  id: string // UUID
  username: string // Immutable after creation
  email: string
  password_hash?: string // Never sent to client
  role_id: string // UUID
  role_name?: string // Augmented on retrieval
  team_id?: string | null
  group_id?: string | null
  department_id?: string | null
  token_version: number // Incremented on role/status change
  status: 'ACTIVE' | 'DISABLED'
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
  created_by?: string | null // UUID (creator's user ID)
  created_by_username?: string | null // Augmented on retrieval
  updated_by?: string | null // UUID
  updated_by_username?: string | null // Augmented on retrieval
}

/**
 * MMC Role
 *
 * Role definition with name, description, and permission matrix
 */
export interface MMCRole {
  id: string // UUID
  name: string
  description?: string
  status: 'ACTIVE' | 'INACTIVE'
  member_count?: number // Augmented on retrieval
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
}

/**
 * Permission Domain
 */
export type PermissionDomain =
  | 'ORGANIZATION_SETTINGS'
  | 'PRODUCT_MANAGEMENT'
  | 'LICENSE_MANAGEMENT'
  | 'CLIENT_MANAGEMENT'
  | 'AFFILIATE_MANAGEMENT'
  | 'MEMBERS_MANAGEMENT'
  | 'REPORTING'

/**
 * Role Permission Entry
 *
 * Row in role_permissions table (domain × abilities for a role)
 */
export interface RolePermission {
  id: string // UUID
  role_id: string // UUID
  domain: PermissionDomain
  can_view: boolean
  can_create: boolean
  can_edit: boolean
  can_delete: boolean
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
}

/**
 * Role Permissions Matrix
 *
 * All permissions for a role (7 domains)
 */
export interface RolePermissionsMatrix {
  role_id: string // UUID
  permissions: RolePermission[]
}

/**
 * MMC Member Invitation
 *
 * One-time token-based invitation for member onboarding
 */
export interface MMCMemberInvitation {
  id: string // UUID
  email: string
  role_id: string // UUID
  role_name?: string // Augmented on retrieval
  token_hash: string // SHA256(token); never send plaintext
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED'
  expires_at: string // ISO 8601
  invited_by: string // UUID (creator)
  invited_by_username?: string // Augmented on retrieval
  accepted_at?: string | null // ISO 8601 (if accepted)
  accepted_by_user_id?: string | null // UUID
  created_at: string // ISO 8601
  updated_at: string // ISO 8601
}

/**
 * Audit Log Entry
 *
 * Immutable append-only record of all administrative actions
 */
export interface AuditLogEntry {
  id: string // UUID
  actor_user_id: string | null // UUID (can be null if creator deleted)
  actor_username?: string | null // Augmented on retrieval
  action_type:
    | 'MEMBER_CREATED'
    | 'MEMBER_UPDATED'
    | 'MEMBER_DISABLED'
    | 'MEMBER_ENABLED'
    | 'MEMBER_ROLE_CHANGED'
    | 'MEMBER_DELETED'
    | 'ROLE_CREATED'
    | 'ROLE_UPDATED'
    | 'ROLE_DELETED'
    | 'PERMISSION_BATCH_UPDATED'
    | 'PERMISSION_SINGLE_CHANGED'
    | 'INVITATION_SENT'
    | 'INVITATION_ACCEPTED'
    | 'INVITATION_EXPIRED'
    | 'INVITATION_RESENT'
    | 'LOGIN_ATTEMPT_SUCCESS'
    | 'LOGIN_ATTEMPT_FAILED'
    | 'LOGOUT'
    | 'PERMISSION_CHECK_DENIED'
    | 'PERMISSION_CHECK_ALLOWED'
    | 'SESSION_INVALIDATED'
  entity_type: 'MEMBER' | 'ROLE' | 'PERMISSION' | 'INVITATION' | 'SESSION'
  entity_id?: string | null // UUID (can be null for bulk operations)
  previous_state?: Record<string, unknown> | null // JSON snapshot
  new_state?: Record<string, unknown> | null // JSON snapshot
  correlation_id: string // UUID (links to API request)
  ip_address?: string | null
  user_agent?: string | null
  timestamp: string // ISO 8601
}

/**
 * API Request/Response types
 */

/**
 * Create Member Request
 */
export interface CreateMemberRequest {
  username: string // Unique; alphanumeric + underscore
  email: string // Unique; valid email format
  password: string // Min 8 chars, upper + lower + digit + special
  role_id: string // UUID; must reference ACTIVE role
  team_id?: string // Optional
  group_id?: string // Optional
  department_id?: string // Optional
}

/**
 * Update Member Request
 */
export interface UpdateMemberRequest {
  email?: string // Can update
  team_id?: string | null // Can update
  group_id?: string | null // Can update
  department_id?: string | null // Can update
  // Note: Cannot update username (immutable), password (separate endpoint), role (separate endpoint)
}

/**
 * Change Member Role Request
 */
export interface ChangeMemberRoleRequest {
  role_id: string // UUID; must reference ACTIVE role
}

/**
 * Create Invitation Request
 */
export interface CreateInvitationRequest {
  email: string // Unique within pending/accepted invitations
  role_id: string // UUID; must reference role
}

/**
 * Accept Invitation Request
 */
export interface AcceptInvitationRequest {
  token: string // Plaintext token from email (hashed on server)
  password: string // Min 8 chars, upper + lower + digit + special
}

/**
 * Update Role Permission Request
 */
export interface UpdateRolePermissionRequest {
  domain: PermissionDomain
  can_view?: boolean
  can_create?: boolean
  can_edit?: boolean
  can_delete?: boolean
}

/**
 * List Members Response
 */
export interface ListMembersResponse {
  members: MMCMember[]
  total: number
  limit: number
  offset: number
}

/**
 * List Roles Response
 */
export interface ListRolesResponse {
  roles: MMCRole[]
  total: number
}

/**
 * List Invitations Response
 */
export interface ListInvitationsResponse {
  invitations: MMCMemberInvitation[]
  total: number
  limit: number
  offset: number
}

/**
 * Permission Check Response
 */
export interface PermissionCheckResponse {
  user_id: string // UUID
  role_id: string // UUID
  permissions: {
    domain: PermissionDomain
    can_view: boolean
    can_create: boolean
    can_edit: boolean
    can_delete: boolean
  }[]
}
