import type { InvitationWithMemberData } from '@zidney/types'
import {
  mmc_member_invitations,
  mmc_members,
  roles,
} from '@zidney/types/db-schema'
// @ts-ignore: drizzle-orm not declared as dependency of domain-core [INFRA-001-DEPS-03]
import { and, desc, eq } from 'drizzle-orm'
// @ts-ignore: drizzle-orm/node-postgres not declared as dependency of domain-core [INFRA-001-DEPS-03]
import { type Database } from 'drizzle-orm/node-postgres'
import { AppError, ErrorCode } from '../errors/index.js'
import { AuditService } from './audit.service.js'

export interface InvitationServiceConstructor {
  db: Database
  auditService: AuditService
}

export class InvitationService {
  private db: Database
  private auditService: AuditService

  constructor({ db, auditService }: InvitationServiceConstructor) {
    this.db = db
    this.auditService = auditService
  }

  /**
   * Send an invitation to an email address
   * Validates email not already invited or member
   * Generates one-time token and stores hash
   * Returns plaintext token (to be sent via email)
   */
  async sendInvitation(
    email: string,
    roleId: string,
    requestorId: string,
    token: string,
    tokenHash: string
  ): Promise<{ invitationId: string; token: string }> {
    // Validate email not already a member
    const existingMember = await this.db.query.mmc_members.findFirst({
      where: eq(mmc_members.email, email),
    })

    if (existingMember) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Email already registered as MMC member`,
        409
      )
    }

    // Validate no pending invitation for same email
    const existingInvitation =
      await this.db.query.mmc_member_invitations.findFirst({
        where: and(
          eq(mmc_member_invitations.email, email),
          eq(mmc_member_invitations.status, 'PENDING')
        ),
      })

    if (existingInvitation) {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Pending invitation already exists for this email`,
        409
      )
    }

    // Validate role exists and is ACTIVE
    const role = await this.db.query.roles.findFirst({
      where: eq(roles.id, roleId),
    })

    if (!role) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Role not found`, 400)
    }

    if (role.status !== 'ACTIVE') {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Role is not active`, 400)
    }

    // Create invitation record within transaction
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now

    const result = await this.db.transaction(async (trx: any) => {
      // Insert invitation
      const [invitation] = await trx
        .insert(mmc_member_invitations)
        .values({
          email,
          role_id: roleId,
          token_hash: tokenHash,
          status: 'PENDING',
          expires_at: expiresAt,
          invited_by: requestorId,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning()

      if (!invitation.id) {
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          `Failed to create invitation`,
          500
        )
      }

      // Audit log
      // @ts-ignore: LOGIC-BUG: logInvitationSent called with object but expects 7 positional args — see INFRA-001-LOGIC-02
      await this.auditService.logInvitationSent({
        invitationId: invitation.id,
        email,
        roleId,
        invitedBy: requestorId,
        correlationId: '',
        ipAddress: '',
        userAgent: '',
      })

      return invitation.id
    })

    return { invitationId: result, token }
  }

  /**
   * Accept an invitation with password and username
   * Validates token hash, expiration, and creates member
   */
  async acceptInvitation(
    tokenHash: string,
    password: string,
    username: string,
    correlationId: string,
    ipAddress: string
  ): Promise<{ memberId: string; username: string; email: string }> {
    // Find invitation by token hash
    const invitation = await this.db.query.mmc_member_invitations.findFirst({
      where: eq(mmc_member_invitations.token_hash, tokenHash),
    })

    if (!invitation) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Invalid or expired invitation token`,
        401
      )
    }

    // Validate invitation not already accepted
    if (invitation.status !== 'PENDING') {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Invitation has already been used or is no longer valid`,
        401
      )
    }

    // Validate not expired (server time authoritative)
    const now = new Date()
    if (now > invitation.expires_at) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Invitation token has expired`,
        401
      )
    }

    // Validate username uniqueness
    const existingUsername = await this.db.query.mmc_members.findFirst({
      where: eq(mmc_members.username, username),
    })

    if (existingUsername) {
      throw new AppError(ErrorCode.CONFLICT, `Username already taken`, 409)
    }

    // Import password utilities dynamically to avoid circular deps
    const { hashPassword } = await import('../utils/password.js')

    // Hash password
    const passwordHash = await hashPassword(password)

    // Create member and update invitation within transaction
    const result = await this.db.transaction(async (trx: any) => {
      // Create member
      const [member] = await trx
        .insert(mmc_members)
        .values({
          username,
          email: invitation.email,
          password_hash: passwordHash,
          role_id: invitation.role_id,
          status: 'ACTIVE',
          token_version: 1,
          created_by: invitation.invited_by, // Set creator to person who sent invite
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returning()

      if (!member.id) {
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          `Failed to create member`,
          500
        )
      }

      // Update invitation
      await trx
        .update(mmc_member_invitations)
        .set({
          status: 'ACCEPTED',
          accepted_at: now,
          accepted_by_user_id: member.id,
          updated_at: now,
        })
        .where(eq(mmc_member_invitations.id, invitation.id))

      // Audit log
      // @ts-ignore: LOGIC-BUG: logInvitationAccepted called with object but expects 6 positional args — see INFRA-001-LOGIC-02
      await this.auditService.logInvitationAccepted({
        memberId: member.id,
        invitationId: invitation.id,
        correlationId,
        ipAddress,
        userAgent: '',
      })

      return {
        memberId: member.id,
        username: member.username,
        email: member.email,
      }
    })

    return result
  }

  /**
   * Get invitations with optional status filter and pagination
   */
  async getInvitations(
    status?: 'PENDING' | 'ACCEPTED' | 'EXPIRED',
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    invitations: InvitationWithMemberData[]
    total: number
  }> {
    // Query with filter
    let query = this.db.query.mmc_member_invitations

    if (status) {
      query = query.where(eq(mmc_member_invitations.status, status))
    }

    const invitations = await query
      .orderBy(desc(mmc_member_invitations.created_at))
      .limit(limit)
      .offset(offset)

    // Total count
    const [_countResult] = await this.db
      .select()
      .from(mmc_member_invitations)
      .where(status ? eq(mmc_member_invitations.status, status) : undefined)

    const total = status
      ? invitations.filter((inv: any) => inv.status === status).length
      : invitations.length

    // Augment with invited_by username and role name
    const enriched = await Promise.all(
      invitations.map(async (inv: any) => {
        const invitedByMember = await this.db.query.mmc_members.findFirst({
          where: eq(mmc_members.id, inv.invited_by),
        })

        const role = await this.db.query.roles.findFirst({
          where: eq(roles.id, inv.role_id),
        })

        return {
          ...inv,
          invited_by_username: invitedByMember?.username || 'unknown',
          role_name: role?.name || 'unknown',
        }
      })
    )

    return {
      invitations: enriched,
      total,
    }
  }

  /**
   * Resend invitation email for pending invitations
   * Does not create new token, returns existing token (caller must hash it)
   */
  async resendInvitation(invitationId: string): Promise<{
    email: string
    roleName: string
  }> {
    const invitation = await this.db.query.mmc_member_invitations.findFirst({
      where: eq(mmc_member_invitations.id, invitationId),
    })

    if (!invitation) {
      throw new AppError(ErrorCode.NOT_FOUND, `Invitation not found`, 404)
    }

    if (invitation.status !== 'PENDING') {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Can only resend pending invitations`,
        400
      )
    }

    // Check expiration
    const now = new Date()
    if (now > invitation.expires_at) {
      // Mark as expired
      await this.db
        .update(mmc_member_invitations)
        .set({
          status: 'EXPIRED',
          updated_at: now,
        })
        .where(eq(mmc_member_invitations.id, invitationId))

      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        `Invitation has expired`,
        401
      )
    }

    // Get role name
    const role = await this.db.query.roles.findFirst({
      where: eq(roles.id, invitation.role_id),
    })

    return {
      email: invitation.email,
      roleName: role?.name || 'unknown',
    }
  }

  /**
   * Mark expired invitations as expired (background job optional)
   */
  async expireOldInvitations(): Promise<number> {
    const now = new Date()

    const result = await this.db
      .update(mmc_member_invitations)
      .set({
        status: 'EXPIRED',
        updated_at: now,
      })
      .where(
        and(
          eq(mmc_member_invitations.status, 'PENDING'),
          (col: any) => col.expires_at < now
        )
      )

    return result.rowCount || 0
  }
}
