/**
 * Role-Based Access Control (RBAC)
 *
 * File: packages/domain-core/src/auth/rbac.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Evaluate user permissions based on role and permission matrix.
 * Backend-only permission enforcement (frontend has NO security logic).
 *
 * Architecture:
 * - Permission codes: Format "{resource}:{action}" (e.g., "exam:submit", "report:download")
 * - Permission matrix: role_permissions table (many-to-many: roles ↔ permissions)
 * - Evaluation: Live lookup from database (not cached in JWT)
 * - Caching: Optional local cache (Phase 2+)
 *
 * Compliance:
 * - AGENTS.md: Permission checks MUST occur in backend only
 * - No permission information in frontend
 * - All authorization failures logged (403 Forbidden)
 * - Division-level overrides deferred to Phase 2+
 */

import { PermissionResult, RbacContext } from './types'

/**
 * Check if user has a specific permission
 *
 * @param context - RBAC context (user role + permissions)
 * @param requiredPermission - Permission code to check (e.g., "exam:submit")
 * @returns PermissionResult with allowed flag and reason
 *
 * Example:
 * ```
 * const context = { role: 'INSTRUCTOR', permissions: ['exam:grade', 'exam:view'] }
 * const result = evaluatePermission(context, 'exam:submit')
 * // result = { allowed: false, reason: 'Permission not granted to role' }
 * ```
 *
 * Logic:
 * 1. Check if requiredPermission exists in context.permissions array
 * 2. Return { allowed: true } if found
 * 3. Return { allowed: false, reason } if not found
 * 4. All denials are logged by middleware
 */
export function evaluatePermission(
  context: RbacContext,
  requiredPermission: string
): PermissionResult {
  // Validation
  if (!context || typeof context !== 'object') {
    return {
      allowed: false,
      reason: 'Invalid RBAC context',
    }
  }

  if (!requiredPermission || typeof requiredPermission !== 'string') {
    return {
      allowed: false,
      reason: 'Invalid permission code format',
    }
  }

  // Check permission
  const hasPermission =
    Array.isArray(context.permissions) &&
    context.permissions.includes(requiredPermission)

  return {
    allowed: hasPermission,
    reason: hasPermission
      ? undefined
      : `User role '${context.role}' does not have permission '${requiredPermission}'`,
    metadata: {
      role: context.role,
      requiredPermission,
      userPermissions: context.permissions,
    },
  }
}

/**
 * Check if user can perform action on resource in specific context
 *
 * Supports division-level filtering (Phase 1: Optional, Phase 2+: Mandatory)
 *
 * @param context - RBAC context
 * @param resourceId - ID of resource being accessed (e.g., exam_id, report_id)
 * @param action - Action code (e.g., "view", "edit", "delete")
 * @param resourceDivisionId - Division ID of resource (for division boundary checks)
 * @returns PermissionResult
 *
 * Division Boundary Rules (Phase 2+):
 * - Students can only access resources in their division
 * - Instructors can access resources in their assigned divisions
 * - Admins can access all divisions
 *
 * Phase 1: Division checks deferred (assume all resources accessible if permission granted)
 */
export function evaluateResourcePermission(
  context: RbacContext,
  resourceId: string,
  action: string,
  resourceDivisionId?: string
): PermissionResult {
  // Step 1: Check basic permission
  const permissionCode = `${action.toLowerCase()}:resource`
  const permissionResult = evaluatePermission(context, permissionCode)

  if (!permissionResult.allowed) {
    return permissionResult
  }

  // Step 2 (Phase 2+): Division boundary check
  // For now: Allow if permission granted (division checks deferred to Phase 2)
  if (resourceDivisionId && context.division_id) {
    // Student can only access resources in their division
    if (
      context.role === 'STUDENT' &&
      context.division_id !== resourceDivisionId
    ) {
      return {
        allowed: false,
        reason: 'Student cannot access resources outside their division',
        metadata: {
          role: context.role,
          userDivision: context.division_id,
          resourceDivision: resourceDivisionId,
        },
      }
    }

    // Instructor/Staff can only access resources in assigned divisions (Phase 2+)
    // For now: Allow (assume assigned to all divisions until Phase 2 division assignment)
  }

  return {
    allowed: true,
    metadata: {
      resourceId,
      action,
      division: resourceDivisionId,
    },
  }
}

/**
 * Evaluate multiple permissions (check if user has ANY or ALL required permissions)
 *
 * @param context - RBAC context
 * @param requiredPermissions - Array of permission codes to check
 * @param requireAll - If true, require ALL permissions; if false, require ANY
 * @returns PermissionResult
 *
 * Example - ANY (OR logic):
 * ```
 * evaluatePermissions(context, ['exam:submit', 'exam:create'], false)
 * // Returns true if user has submit OR create permission
 * ```
 *
 * Example - ALL (AND logic):
 * ```
 * evaluatePermissions(context, ['exam:view', 'report:download'], true)
 * // Returns true only if user has BOTH view AND download permissions
 * ```
 */
export function evaluatePermissions(
  context: RbacContext,
  requiredPermissions: string[],
  requireAll: boolean = true
): PermissionResult {
  if (!Array.isArray(requiredPermissions) || requiredPermissions.length === 0) {
    return {
      allowed: false,
      reason: 'No permissions to evaluate',
    }
  }

  if (!Array.isArray(context.permissions)) {
    return {
      allowed: false,
      reason: 'No permissions assigned to user',
    }
  }

  const userPermissions = new Set(context.permissions)

  if (requireAll) {
    // AND logic: All required permissions must be present
    const hasAll = requiredPermissions.every((perm) =>
      userPermissions.has(perm)
    )

    return {
      allowed: hasAll,
      reason: hasAll ? undefined : `User missing some required permissions`,
      metadata: {
        requiredPermissions,
        userPermissions: Array.from(userPermissions),
        missing: requiredPermissions.filter((p) => !userPermissions.has(p)),
      },
    }
  } else {
    // OR logic: At least one required permission must be present
    const hasAny = requiredPermissions.some((perm) => userPermissions.has(perm))

    return {
      allowed: hasAny,
      reason: hasAny ? undefined : `User has none of the required permissions`,
      metadata: {
        requiredPermissions,
        userPermissions: Array.from(userPermissions),
      },
    }
  }
}

/**
 * Build RBAC context from database user + permissions
 *
 * Fetches user's role and associated permissions from database.
 * Called during authentication flow to populate context for request.
 *
 * @param userId - User ID
 * @param userRole - User's role from database
 * @param permissions - List of permission codes assigned to user's role
 * @param workspaceId - Optional workspace context
 * @param divisionId - Optional division context
 * @returns Complete RBAC context
 */
export function buildRbacContext(
  userId: string,
  userRole: string,
  permissions: string[],
  workspaceId?: string,
  divisionId?: string
): RbacContext {
  return {
    userId,
    workspace_id: workspaceId,
    role: userRole,
    permissions: permissions || [],
    division_id: divisionId,
  }
}

/**
 * Get role description for human-readable output
 *
 * @param role - Role code (e.g., "ADMIN", "INSTRUCTOR", "STUDENT")
 * @returns Human-readable description
 */
export function getRoleDescription(role: string): string {
  const descriptions: Record<string, string> = {
    ADMIN: 'Administrator',
    INSTRUCTOR: 'Instructor',
    STAFF: 'Staff',
    STUDENT: 'Student',
    OPERATOR: 'Platform Operator',
  }

  return descriptions[role] || role
}

/**
 * Get permission description for human-readable output
 *
 * @param permissionCode - Permission code (e.g., "exam:submit")
 * @returns Human-readable description
 */
export function getPermissionDescription(permissionCode: string): string {
  const parts = permissionCode.split(':')
  if (parts.length !== 2) return permissionCode

  const [resource, action] = parts
  const resources: Record<string, string> = {
    exam: 'Exam',
    report: 'Report',
    question: 'Question',
    division: 'Division',
    user: 'User Account',
  }

  const actions: Record<string, string> = {
    view: 'View',
    create: 'Create',
    edit: 'Edit',
    delete: 'Delete',
    submit: 'Submit',
    grade: 'Grade',
    manage: 'Manage',
    download: 'Download',
  }

  const resourceName = resources[resource] || resource
  const actionName = actions[action] || action

  return `${actionName} ${resourceName}`
}

/**
 * Validate permission code format
 *
 * Expected format: "{resource}:{action}"
 * - resource: lowercase alphanumeric + underscores
 * - action: lowercase alphanumeric + underscores
 *
 * @param permissionCode - Code to validate
 * @returns true if valid format, false otherwise
 *
 * Examples:
 * ```
 * isValidPermissionCode('exam:submit') // true
 * isValidPermissionCode('report:download') // true
 * isValidPermissionCode('invalid') // false
 * isValidPermissionCode('exam:') // false
 * ```
 */
export function isValidPermissionCode(permissionCode: string): boolean {
  // Must be string in format "resource:action"
  if (typeof permissionCode !== 'string') return false

  const pattern = /^[a-z_]+:[a-z_]+$/
  return pattern.test(permissionCode)
}

/**
 * Generate default permissions for standard roles
 *
 * Used during tenant provisioning to seed role_permissions table.
 * Can be extended with custom permissions per tenant.
 *
 * @param role - Role code
 * @returns Array of permission codes for that role
 *
 * Phase 1 Default Permissions:
 * - STUDENT: Minimal (exam:submit, report:view)
 * - INSTRUCTOR: Moderate (exam:manage, report:download, question:manage)
 * - STAFF: Extended (user:manage, division:view)
 * - ADMIN: Full (all permissions - wildcard not used for security)
 */
export function getDefaultPermissionsForRole(role: string): string[] {
  const permissions: Record<string, string[]> = {
    STUDENT: ['exam:submit', 'report:view'],
    INSTRUCTOR: [
      'exam:manage',
      'exam:grade',
      'question:manage',
      'report:download',
      'division:view',
    ],
    STAFF: [
      'exam:view',
      'question:view',
      'user:manage',
      'division:view',
      'report:view',
    ],
    ADMIN: [
      'exam:create',
      'exam:edit',
      'exam:delete',
      'exam:manage',
      'question:create',
      'question:edit',
      'question:delete',
      'question:manage',
      'division:create',
      'division:edit',
      'division:delete',
      'division:manage',
      'user:create',
      'user:edit',
      'user:delete',
      'user:manage',
      'report:download',
      'report:view',
    ],
  }

  return permissions[role] || []
}
