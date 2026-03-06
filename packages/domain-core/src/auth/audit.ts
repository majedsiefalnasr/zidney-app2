/**
 * Audit Event Logging
 *
 * File: packages/domain-core/src/auth/audit.ts
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Structured JSON logging of all authentication events for forensic analysis and compliance.
 * Integrates with observability stack (Pino logger).
 *
 * Event Categories:
 * - Authentication: login_success, login_failed, account_locked, account_unlocked
 * - Authorization: token_issued, token_invalidated, permission_denied, role_changed
 * - Security: token_version_mismatch, workspace_mismatch, schema_mismatch, license_blocked
 * - Session: logout, password_changed
 *
 * Structured Fields (all events):
 * - correlation_id: Request tracing (links all logs in single request)
 * - workspace_slug: Tenant identifier (enables workspace-level filtering)
 * - user_id: Subject of the event
 * - event_type: Category of event
 * - result: SUCCESS | FAILURE | BLOCKED
 * - timestamp: Server-authoritative time
 * - metadata: Event-specific JSON data (e.g., failed login count, schema mismatch reason)
 *
 * Compliance:
 * - AGENTS.md: Structured logging mandatory
 * - ADR-0006: Server time only (no client-supplied timestamps)
 * - PCI DSS: All auth events logged
 * - GDPR: User data retention policy (90 days)
 */

import { logger } from '@zidney/logger'
import type { AuditEventData } from './types'

// Simple logger interface
interface SimpleLogger {
  info: (obj: Record<string, unknown>, msg: string) => void
  warn: (obj: Record<string, unknown>, msg: string) => void
  error: (obj: Record<string, unknown>, msg: string) => void
}

/**
 * Get simple logger instance for auth audit logs
 * Configures structured JSON output with correlation ID support
 */
function getAuditLogger(): SimpleLogger {
  return {
    info: (obj, msg) => logger.info(msg, obj),
    warn: (obj, msg) => logger.warn(msg, obj),
    error: (obj, msg) => logger.error(msg, obj),
  }
}

/**
 * Log an authentication event to audit trail
 *
 * @param event - Audit event data
 *
 * Example:
 * ```
 * await logAuthEvent({
 *   correlationId: 'req-uuid-123',
 *   eventType: 'login_success',
 *   result: 'SUCCESS',
 *   userId: 'user-uuid-456',
 *   userEmail: 'user@example.com',
 *   workspaceSlug: 'acme-university',
 *   ipAddress: '192.168.1.100',
 *   userAgent: 'Mozilla/5.0...',
 *   schemaVersion: '1.0.0',
 *   productVersion: '1.0.0',
 *   metadata: {
 *     token_version: 0,
 *     subscription_status: 'ACTIVE'
 *   }
 * })
 * ```
 *
 * Output (JSON):
 * ```json
 * {
 *   "level": 20,
 *   "time": 1705513200000,
 *   "pid": 12345,
 *   "hostname": "prod-api-01",
 *   "name": "auth-audit",
 *   "correlation_id": "req-uuid-123",
 *   "event_type": "login_success",
 *   "result": "SUCCESS",
 *   "workspace_slug": "acme-university",
 *   "user_id": "user-uuid-456",
 *   "user_email": "user@example.com",
 *   "ip_address": "192.168.1.100",
 *   "user_agent": "Mozilla/5.0...",
 *   "metadata": { "token_version": 0, "subscription_status": "ACTIVE" },
 *   "schema_version": "1.0.0",
 *   "product_version": "1.0.0",
 *   "msg": "Authentication event"
 * }
 * ```
 *
 * Queries:
 * ```bash
 * # Find all login failures
 * jq '.event_type == "login_failed" and .result == "FAILURE"' ../logs/audit.jsonl
 *
 * # Find all events for specific workspace
 * jq '.workspace_slug == "acme-university"' ../logs/audit.jsonl
 *
 * # Find blocked attempts (license, workspace mismatch, etc.)
 * jq '.result == "BLOCKED"' ../logs/audit.jsonl
 *
 * # Find by correlation ID (single request trace)
 * jq '.correlation_id == "req-uuid-123"' ../logs/audit.jsonl
 * ```
 *
 * Database Storage (Optional - Phase 2+):
 * For compliance, async worker can tail audit logs and insert into audit_logs table
 * This provides queryable audit trail in SQL (current implementation: log files only)
 */
export async function logAuthEvent(event: AuditEventData): Promise<void> {
  const logger = getAuditLogger()

  // Build structured log entry
  const logEntry = {
    correlation_id: event.correlationId,
    event_type: event.eventType,
    result: event.result,
    workspace_slug: event.workspaceSlug,
    user_id: event.userId || null,
    user_email: event.userEmail || null,
    ip_address: event.ipAddress || null,
    user_agent: event.userAgent || null,
    metadata: event.metadata || {},
    schema_version: event.schemaVersion || null,
    product_version: event.productVersion || null,
  }

  // Choose log level based on result
  const logLevel =
    event.result === 'SUCCESS' ? 'info' : event.result === 'BLOCKED' ? 'warn' : 'warn'

  // Log with appropriate level
  if (logLevel === 'info') {
    logger.info(logEntry, `Auth event: ${event.eventType}`)
  } else if (logLevel === 'warn') {
    logger.warn(logEntry, `Auth event: ${event.eventType}`)
  } else {
    logger.error(logEntry, `Auth event: ${event.eventType}`)
  }
}

/**
 * Log successful login attempt
 *
 * @param correlationId - Request correlation ID
 * @param userId - Authenticated user ID
 * @param userEmail - User email
 * @param workspaceSlug - Workspace identifier
 * @param ipAddress - Client IP
 * @param userAgent - Client user agent
 * @param metadata - Additional event data (role, token_version, etc.)
 */
export async function logLoginSuccess(
  correlationId: string,
  userId: string,
  userEmail: string,
  workspaceSlug: string,
  ipAddress?: string,
  userAgent?: string,
  metadata?: Record<string, any>
): Promise<void> {
  await logAuthEvent({
    correlationId,
    eventType: 'login_success',
    result: 'SUCCESS',
    userId,
    userEmail,
    workspaceSlug,
    ipAddress,
    userAgent,
    metadata: {
      ...metadata,
      action: 'user_authenticated',
    },
  })
}

/**
 * Log failed login attempt
 *
 * @param correlationId - Request correlation ID
 * @param userEmail - Email attempted (user may not exist)
 * @param workspaceSlug - Workspace identifier
 * @param reason - Reason for failure (invalid_password, user_not_found, account_locked, etc.)
 * @param failedCount - Current failed attempt count
 * @param ipAddress - Client IP
 * @param userAgent - Client user agent
 */
export async function logLoginFailure(
  correlationId: string,
  userEmail: string,
  workspaceSlug: string,
  reason: string,
  failedCount: number,
  ipAddress?: string,
  userAgent?: string
): Promise<void> {
  await logAuthEvent({
    correlationId,
    eventType: 'login_failed',
    result: 'FAILURE',
    userEmail,
    workspaceSlug,
    ipAddress,
    userAgent,
    metadata: {
      reason,
      failed_attempt_count: failedCount,
      will_lock_after: 5 - failedCount,
    },
  })
}

/**
 * Log account lock due to failed login threshold
 *
 * @param correlationId - Request correlation ID
 * @param userId - User ID
 * @param userEmail - User email
 * @param workspaceSlug - Workspace identifier
 * @param lockDurationSeconds - How long account is locked
 */
export async function logAccountLocked(
  correlationId: string,
  userId: string,
  userEmail: string,
  workspaceSlug: string,
  lockDurationSeconds: number = 300
): Promise<void> {
  await logAuthEvent({
    correlationId,
    eventType: 'account_locked',
    result: 'BLOCKED',
    userId,
    userEmail,
    workspaceSlug,
    metadata: {
      reason: 'max_failed_login_attempts_exceeded',
      lock_duration_seconds: lockDurationSeconds,
      will_auto_unlock: true,
    },
  })
}

/**
 * Log token invalidation (logout-all)
 *
 * @param correlationId - Request correlation ID
 * @param userId - User ID
 * @param userEmail - User email
 * @param workspaceSlug - Workspace identifier
 * @param reason - Reason for invalidation (logout_all, password_changed, role_changed, etc.)
 * @param newTokenVersion - New token version after increment
 */
export async function logTokenInvalidation(
  correlationId: string,
  userId: string,
  userEmail: string,
  workspaceSlug: string,
  reason: string,
  newTokenVersion: number
): Promise<void> {
  await logAuthEvent({
    correlationId,
    eventType: 'token_invalidated',
    result: 'SUCCESS',
    userId,
    userEmail,
    workspaceSlug,
    metadata: {
      reason,
      new_token_version: newTokenVersion,
      all_sessions_revoked: true,
    },
  })
}

/**
 * Log token version mismatch (potential replay attack or cross-workspace token use)
 *
 * @param correlationId - Request correlation ID
 * @param userId - User ID
 * @param userEmail - User email
 * @param workspaceSlug - Workspace identifier
 * @param tokenVersion - Version in token
 * @param expectedVersion - Current version from database
 * @param ipAddress - Client IP
 */
export async function logTokenVersionMismatch(
  correlationId: string,
  userId: string,
  userEmail: string,
  workspaceSlug: string,
  tokenVersion: number,
  expectedVersion: number,
  ipAddress?: string
): Promise<void> {
  await logAuthEvent({
    correlationId,
    eventType: 'token_version_mismatch',
    result: 'FAILURE',
    userId,
    userEmail,
    workspaceSlug,
    ipAddress,
    metadata: {
      reason: 'token_invalidated_after_issuance',
      token_version: tokenVersion,
      expected_version: expectedVersion,
      potential_replay_attack: true,
    },
  })
}

/**
 * Log workspace boundary violation (cross-workspace token attempt)
 *
 * @param correlationId - Request correlation ID
 * @param userId - User ID
 * @param userEmail - User email
 * @param tokenWorkspace - Workspace in token
 * @param requestedWorkspace - Workspace in request
 * @param ipAddress - Client IP
 */
export async function logWorkspaceMismatch(
  correlationId: string,
  userId: string,
  userEmail: string,
  tokenWorkspace: string,
  requestedWorkspace: string,
  ipAddress?: string
): Promise<void> {
  await logAuthEvent({
    correlationId,
    eventType: 'workspace_mismatch',
    result: 'BLOCKED',
    userId,
    userEmail,
    workspaceSlug: requestedWorkspace,
    ipAddress,
    metadata: {
      reason: 'cross_workspace_token_attempt',
      token_workspace: tokenWorkspace,
      requested_workspace: requestedWorkspace,
      security_incident: true,
    },
  })
}

/**
 * Log license enforcement block
 *
 * @param correlationId - Request correlation ID
 * @param workspaceSlug - Workspace identifier
 * @param licenseStatus - Current license status (SOFT_LOCKED, ARCHIVED, etc.)
 * @param httpStatus - HTTP status code returned (423, 403, etc.)
 * @param userId - User ID (if known)
 */
export async function logLicenseBlocked(
  correlationId: string,
  workspaceSlug: string,
  licenseStatus: string,
  httpStatus: number,
  userId?: string
): Promise<void> {
  await logAuthEvent({
    correlationId,
    eventType: 'license_blocked',
    result: 'BLOCKED',
    userId,
    workspaceSlug,
    metadata: {
      reason: 'workspace_license_status_restricts_access',
      license_status: licenseStatus,
      http_status: httpStatus,
    },
  })
}

/**
 * Log permission denied (RBAC check failed)
 *
 * @param correlationId - Request correlation ID
 * @param userId - User ID
 * @param userEmail - User email
 * @param workspaceSlug - Workspace identifier
 * @param requiredPermission - Permission that was required
 * @param userRole - User's role
 * @param ipAddress - Client IP
 */
export async function logPermissionDenied(
  correlationId: string,
  userId: string,
  userEmail: string,
  workspaceSlug: string,
  requiredPermission: string,
  userRole: string,
  ipAddress?: string
): Promise<void> {
  await logAuthEvent({
    correlationId,
    eventType: 'permission_denied',
    result: 'BLOCKED',
    userId,
    userEmail,
    workspaceSlug,
    ipAddress,
    metadata: {
      reason: 'insufficient_permissions',
      required_permission: requiredPermission,
      user_role: userRole,
    },
  })
}

/**
 * Log schema version mismatch (token from old schema)
 *
 * @param correlationId - Request correlation ID
 * @param userId - User ID
 * @param workspaceSlug - Workspace identifier
 * @param tokenSchema - Schema version in token
 * @param workspaceSchema - Current workspace schema version
 */
export async function logSchemaMismatch(
  correlationId: string,
  userId: string,
  workspaceSlug: string,
  tokenSchema: string,
  workspaceSchema: string
): Promise<void> {
  await logAuthEvent({
    correlationId,
    eventType: 'schema_mismatch',
    result: 'BLOCKED',
    userId,
    workspaceSlug,
    schemaVersion: workspaceSchema,
    metadata: {
      reason: 'workspace_schema_upgraded',
      token_schema_version: tokenSchema,
      current_schema_version: workspaceSchema,
      action_required: 'user_must_login_again',
    },
  })
}
