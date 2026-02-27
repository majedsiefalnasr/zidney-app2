/**
 * Audit Service
 *
 * File: packages/domain-core/src/services/audit.service.ts
 * Task: T011
 * Phase: 2 - Infrastructure & Middleware
 *
 * Append-only logging service for all administrative actions.
 * Writes to immutable mmc_audit_log table with state snapshots.
 * Tracks actor, action, entity, timestamps, and correlation ID.
 *
 * Properties:
 * - Immutable append-only writes
 * - State snapshot capability (before/after)
 * - Correlation ID propagation
 * - No update/delete capability (enforced at DB level)
 */

// @ts-ignore: postgres not declared as dependency of domain-core [INFRA-001-DEPS-05]
import { Database } from 'postgres'

export type ActionType =
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

export type EntityType =
  | 'MEMBER'
  | 'ROLE'
  | 'PERMISSION'
  | 'INVITATION'
  | 'SESSION'

export interface AuditLogEntry {
  id?: string
  actor_user_id: string | null
  action_type: ActionType
  entity_type: EntityType
  entity_id: string | null
  previous_state: Record<string, unknown> | null
  new_state: Record<string, unknown> | null
  correlation_id: string
  ip_address: string | null
  user_agent: string | null
  timestamp?: string
}

/**
 * AuditService: Write-only audit trail
 *
 * Never expose update/delete query patterns; only INSERT and SELECT.
 * Immutability enforced at database layer (trigger).
 */
export class AuditService {
  constructor(private db: Database) {}

  /**
   * Log an administrative action
   *
   * All parameters are required; no defaults.
   * This ensures audit entries are complete.
   */
  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO mmc_audit_log (
          actor_user_id,
          action_type,
          entity_type,
          entity_id,
          previous_state,
          new_state,
          correlation_id,
          ip_address,
          user_agent,
          timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, NOW()))`,
        [
          entry.actor_user_id,
          entry.action_type,
          entry.entity_type,
          entry.entity_id,
          entry.previous_state ? JSON.stringify(entry.previous_state) : null,
          entry.new_state ? JSON.stringify(entry.new_state) : null,
          entry.correlation_id,
          entry.ip_address,
          entry.user_agent,
          entry.timestamp,
        ]
      )
    } catch (error) {
      // Never throw from audit service; log to stderr and continue
      console.error('[AUDIT_LOG_ERROR]', {
        action: entry.action_type,
        entity: entry.entity_type,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Log member creation
   */
  async logMemberCreated(
    actorId: string | null,
    memberId: string,
    memberData: Record<string, unknown>,
    correlationId: string,
    ipAddress: string | null,
    userAgent: string | null
  ): Promise<void> {
    await this.log({
      actor_user_id: actorId,
      action_type: 'MEMBER_CREATED',
      entity_type: 'MEMBER',
      entity_id: memberId,
      previous_state: null,
      new_state: memberData,
      correlation_id: correlationId,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  }

  /**
   * Log member update
   */
  async logMemberUpdated(
    actorId: string,
    memberId: string,
    previousState: Record<string, unknown>,
    newState: Record<string, unknown>,
    correlationId: string,
    ipAddress: string | null,
    userAgent: string | null
  ): Promise<void> {
    await this.log({
      actor_user_id: actorId,
      action_type: 'MEMBER_UPDATED',
      entity_type: 'MEMBER',
      entity_id: memberId,
      previous_state: previousState,
      new_state: newState,
      correlation_id: correlationId,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  }

  /**
   * Log member disable
   */
  async logMemberDisabled(
    actorId: string,
    memberId: string,
    previousState: Record<string, unknown>,
    newState: Record<string, unknown>,
    correlationId: string,
    ipAddress: string | null,
    userAgent: string | null
  ): Promise<void> {
    await this.log({
      actor_user_id: actorId,
      action_type: 'MEMBER_DISABLED',
      entity_type: 'MEMBER',
      entity_id: memberId,
      previous_state: previousState,
      new_state: newState,
      correlation_id: correlationId,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  }

  /**
   * Log permission batch update
   */
  async logPermissionBatchUpdated(
    actorId: string,
    roleId: string,
    previousPermissions: Record<string, unknown>[],
    newPermissions: Record<string, unknown>[],
    correlationId: string,
    ipAddress: string | null,
    userAgent: string | null
  ): Promise<void> {
    await this.log({
      actor_user_id: actorId,
      action_type: 'PERMISSION_BATCH_UPDATED',
      entity_type: 'PERMISSION',
      entity_id: roleId,
      previous_state: { permissions: previousPermissions },
      new_state: { permissions: newPermissions },
      correlation_id: correlationId,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  }

  /**
   * Log login attempt
   */
  async logLoginAttempt(
    memberId: string | null,
    success: boolean,
    correlationId: string,
    ipAddress: string | null,
    userAgent: string | null
  ): Promise<void> {
    await this.log({
      actor_user_id: memberId,
      action_type: success ? 'LOGIN_ATTEMPT_SUCCESS' : 'LOGIN_ATTEMPT_FAILED',
      entity_type: 'SESSION',
      entity_id: null,
      previous_state: null,
      new_state: { success },
      correlation_id: correlationId,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  }

  /**
   * Log permission denial
   */
  async logPermissionDenied(
    actorId: string,
    domain: string,
    action: string,
    correlationId: string,
    ipAddress: string | null,
    userAgent: string | null
  ): Promise<void> {
    await this.log({
      actor_user_id: actorId,
      action_type: 'PERMISSION_CHECK_DENIED',
      entity_type: 'PERMISSION',
      entity_id: null,
      previous_state: null,
      new_state: { domain, action },
      correlation_id: correlationId,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  }

  /**
   * Log invitation sent
   */
  async logInvitationSent(
    actorId: string,
    invitationId: string,
    email: string,
    roleId: string,
    correlationId: string,
    ipAddress: string | null,
    userAgent: string | null
  ): Promise<void> {
    await this.log({
      actor_user_id: actorId,
      action_type: 'INVITATION_SENT',
      entity_type: 'INVITATION',
      entity_id: invitationId,
      previous_state: null,
      new_state: { email, role_id: roleId },
      correlation_id: correlationId,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  }

  /**
   * Log invitation accepted
   */
  async logInvitationAccepted(
    invitationId: string,
    newMemberId: string,
    _email: string,
    correlationId: string,
    ipAddress: string | null,
    userAgent: string | null
  ): Promise<void> {
    await this.log({
      actor_user_id: newMemberId,
      action_type: 'INVITATION_ACCEPTED',
      entity_type: 'INVITATION',
      entity_id: invitationId,
      previous_state: { status: 'PENDING' },
      new_state: { status: 'ACCEPTED', created_member: newMemberId },
      correlation_id: correlationId,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
  }
}

/**
 * Create audit service instance
 */
export function createAuditService(db: Database): AuditService {
  return new AuditService(db)
}
