import {
  ErrorCode,
  errorResponse,
  successResponse,
  // @ts-ignore: LOGIC-BUG: module path missing - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
} from '@zidney/domain-core/src/errors/index.js'
// @ts-ignore: LOGIC-BUG: @zidney/domain-core subpath imports require .js extension alias — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
import { AuditService } from '@zidney/domain-core/src/services/audit.service.js'
// @ts-ignore: LOGIC-BUG: @zidney/domain-core subpath imports require .js extension alias — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
import { InvitationService } from '@zidney/domain-core/src/services/invitation.service.js'
// @ts-ignore: LOGIC-BUG: @zidney/domain-core subpath imports require .js extension alias — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
import { EmailService } from '@zidney/domain-core/src/utils/email.js'
import type { CreateInvitationRequest } from '@zidney/types'
import {
  mmc_member_invitations,
  mmc_members,
  roles,
  // @ts-ignore: LOGIC-BUG: module path missing - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
} from '@zidney/types/db-schema'
import { eq } from 'drizzle-orm'
// @ts-ignore: LOGIC-BUG: drizzle-orm/node-postgres does not export Database — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
import type { Database } from 'drizzle-orm/node-postgres'
import { Hono } from 'hono'
import { generateAndHashToken } from '../utils/tokens.js'

export function createInvitationsRoutes(): Hono {
  const router = new Hono()

  /**
   * POST /mmc/invitations
   * Create and send invitation to email
   * Requires: MEMBERS_MANAGEMENT.create permission
   *
   * Request body:
   * {
   *   email: string,
   *   role_id: string
   * }
   *
   * Response: 201 Created
   * {
   *   success: true,
   *   data: {
   *     invitation_id: string,
   *     email: string,
   *     role_id: string,
   *     expires_at: string (ISO 8601),
   *     status: "PENDING"
   *   }
   * }
   */
  router.post('/mmc/invitations', async (ctx) => {
    const db = ctx.get('db') as Database
    const mmcUser = ctx.get('mmcUser')
    const correlationId = ctx.get('context')?.correlationId || ''
    const ipAddress =
      ctx.req.header('x-forwarded-for') ||
      ctx.req.header('x-real-ip') ||
      'unknown'
    const userAgent = ctx.req.header('user-agent') || ''

    if (!mmcUser) {
      return ctx.json(
        errorResponse(
          null,
          ErrorCode.AUTHENTICATION_FAILED,
          'Authentication required'
        ),
        { status: 401 }
      )
    }

    try {
      const body = (await ctx.req.json()) as CreateInvitationRequest
      const { email, role_id } = body

      // Validate input
      if (!email || !role_id) {
        return ctx.json(
          errorResponse(
            null,
            ErrorCode.VALIDATION_ERROR,
            'Email and role_id are required'
          ),
          { status: 400 }
        )
      }

      // Validate email format (basic)
      if (!email.includes('@')) {
        return ctx.json(
          errorResponse(
            null,
            ErrorCode.VALIDATION_ERROR,
            'Invalid email format'
          ),
          { status: 400 }
        )
      }

      // Initialize services
      const auditService = new AuditService({ db })
      const invitationService = new InvitationService({ db, auditService })
      const emailService = new EmailService({
        provider: process.env.EMAIL_PROVIDER || 'console',
        apiKey: process.env.SENDGRID_API_KEY,
        senderEmail: process.env.SENDER_EMAIL || 'noreply@example.com',
        senderName: process.env.SENDER_NAME || 'Platform',
      })

      // Generate token
      const { plaintext: token, hash: tokenHash } = generateAndHashToken()

      // Send invitation (creates DB record and queues email)
      const { invitationId } = await invitationService.sendInvitation(
        email,
        role_id,
        mmcUser.userId,
        token,
        tokenHash
      )

      // Get role name for email
      const role = await db.query.roles.findFirst({
        where: eq(roles.id, role_id),
      })

      const roleName = role?.name || 'Member'

      // Get inviter name
      const inviter = await db.query.mmc_members.findFirst({
        where: eq(mmc_members.id, mmcUser.userId),
      })

      const inviterName =
        inviter?.full_name || inviter?.username || 'Platform Admin'

      // Build invitation link
      const invitationLink = `${process.env.API_BASE_URL || 'http://localhost:3000'}/accept-invitation?token=${token}`

      // Send email asynchronously (non-blocking)
      await emailService.sendInvitationEmail(
        email,
        invitationLink,
        email,
        roleName,
        inviterName
      )

      // Log audit event
      await auditService.logInvitationSent({
        invitationId,
        email,
        roleId: role_id,
        invitedBy: mmcUser.userId,
        correlationId,
        ipAddress,
        userAgent,
      })

      // Get invitation details for response
      const invitation = await db.query.mmc_member_invitations.findFirst({
        where: eq(mmc_member_invitations.id, invitationId),
      })

      if (!invitation) {
        return ctx.json(
          errorResponse(
            null,
            ErrorCode.INTERNAL_ERROR,
            'Failed to retrieve invitation'
          ),
          { status: 500 }
        )
      }

      return ctx.json(
        successResponse({
          invitation_id: invitation.id,
          email: invitation.email,
          role_id: invitation.role_id,
          expires_at: invitation.expires_at.toISOString(),
          status: invitation.status,
          role_name: roleName,
        }),
        { status: 201 }
      )
    } catch (err) {
      // Map known errors to HTTP status codes
      if (err instanceof Error) {
        const message = err.message

        if (message.includes('already registered')) {
          return ctx.json(
            errorResponse(
              null,
              ErrorCode.CONFLICT,
              'Email already registered as MMC member'
            ),
            { status: 409 }
          )
        }

        if (message.includes('already exists')) {
          return ctx.json(
            errorResponse(
              null,
              ErrorCode.CONFLICT,
              'Pending invitation already exists for this email'
            ),
            { status: 409 }
          )
        }

        if (message.includes('Role not found')) {
          return ctx.json(
            errorResponse(null, ErrorCode.VALIDATION_ERROR, 'Role not found'),
            { status: 400 }
          )
        }
      }

      return ctx.json(
        errorResponse(
          null,
          ErrorCode.INTERNAL_ERROR,
          'Failed to create invitation'
        ),
        { status: 500 }
      )
    }
  })

  /**
   * POST /mmc/invitations/:token/accept
   * Accept invitation and create new member account
   * Public endpoint (no authentication required for acceptance)
   *
   * Request body:
   * {
   *   password: string,
   *   username?: string (optional, auto-generated if not provided)
   * }
   *
   * Response: 201 Created
   * {
   *   success: true,
   *   data: {
   *     member_id: string,
   *     username: string,
   *     email: string,
   *     role_id: string,
   *     status: "ACTIVE"
   *   }
   * }
   */
  router.post('/mmc/invitations/:token/accept', async (ctx) => {
    const db = ctx.get('db') as Database
    const correlationId = ctx.get('context')?.correlationId || ''
    const ipAddress =
      ctx.req.header('x-forwarded-for') ||
      ctx.req.header('x-real-ip') ||
      'unknown'
    const token = ctx.req.param('token')

    try {
      const body = await ctx.req.json()
      const { password, username: provided_username } = body

      // Validate input
      if (!password) {
        return ctx.json(
          errorResponse(
            null,
            ErrorCode.VALIDATION_ERROR,
            'Password is required'
          ),
          { status: 400 }
        )
      }

      // Validate password complexity
      // @ts-ignore: LOGIC-BUG: validatePassword does not exist in @zidney/validation exports — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
      const { validatePassword } = await import('@zidney/validation')
      const passwordValidation = validatePassword(password)
      if (!passwordValidation.valid) {
        return ctx.json(
          errorResponse(
            null,
            ErrorCode.VALIDATION_ERROR,
            `Password requirements: ${passwordValidation.errors?.join(', ')}`
          ),
          { status: 400 }
        )
      }

      // Hash token to find invitation
      const { hashToken } = await import('../utils/tokens.js')
      const tokenHash = hashToken(token)

      // Initialize services
      const auditService = new AuditService({ db })
      const invitationService = new InvitationService({ db, auditService })

      // Generate username if not provided
      let username = provided_username
      if (!username) {
        const { generateUniqueUsername } =
          // @ts-ignore: LOGIC-BUG: @zidney/domain-core subpath import missing — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
          await import('@zidney/domain-core/src/utils/username.js')
        const invitation = await db.query.mmc_member_invitations.findFirst({
          where: eq(mmc_member_invitations.token_hash, tokenHash),
        })

        if (invitation) {
          username = await generateUniqueUsername(invitation.email, db)
        } else {
          return ctx.json(
            errorResponse(
              null,
              ErrorCode.VALIDATION_ERROR,
              'Invalid or expired invitation token'
            ),
            { status: 401 }
          )
        }
      }

      // Accept invitation
      const result = await invitationService.acceptInvitation(
        tokenHash,
        password,
        username,
        correlationId,
        ipAddress
      )

      return ctx.json(
        successResponse({
          member_id: result.memberId,
          username: result.username,
          email: result.email,
          status: 'ACTIVE',
        }),
        { status: 201 }
      )
    } catch (err) {
      // Map known errors to HTTP status codes
      if (err instanceof Error) {
        const message = err.message

        if (message.includes('expired')) {
          return ctx.json(
            errorResponse(
              null,
              ErrorCode.VALIDATION_ERROR,
              'Invitation token has expired'
            ),
            { status: 401 }
          )
        }

        if (message.includes('already been used')) {
          return ctx.json(
            errorResponse(
              null,
              ErrorCode.VALIDATION_ERROR,
              'Invitation has already been used'
            ),
            { status: 401 }
          )
        }

        if (message.includes('already taken')) {
          return ctx.json(
            errorResponse(null, ErrorCode.CONFLICT, 'Username already taken'),
            { status: 409 }
          )
        }
      }

      return ctx.json(
        errorResponse(
          null,
          ErrorCode.INTERNAL_ERROR,
          'Failed to accept invitation'
        ),
        { status: 500 }
      )
    }
  })

  /**
   * GET /mmc/invitations
   * List invitations with optional status filter and pagination
   * Requires: MEMBERS_MANAGEMENT.view permission
   *
   * Query parameters:
   * - status: "PENDING" | "ACCEPTED" | "EXPIRED" (optional)
   * - limit: number (default 50, max 100)
   * - offset: number (default 0)
   *
   * Response: 200 OK
   * {
   *   success: true,
   *   data: {
   *     invitations: [
   *       {
   *         id: string,
   *         email: string,
   *         role_id: string,
   *         role_name: string,
   *         status: string,
   *         expires_at: string,
   *         invited_by: string,
   *         invited_by_username: string,
   *         created_at: string
   *       }
   *     ],
   *     total: number,
   *     limit: number,
   *     offset: number
   *   }
   * }
   */
  router.get('/mmc/invitations', async (ctx) => {
    const db = ctx.get('db') as Database
    const mmcUser = ctx.get('mmcUser')

    if (!mmcUser) {
      return ctx.json(
        errorResponse(
          null,
          ErrorCode.AUTHENTICATION_FAILED,
          'Authentication required'
        ),
        { status: 401 }
      )
    }

    try {
      // Get query parameters
      const status = ctx.req.query('status') as
        | 'PENDING'
        | 'ACCEPTED'
        | 'EXPIRED'
        | undefined
      const limit = Math.min(parseInt(ctx.req.query('limit') || '50', 10), 100)
      const offset = parseInt(ctx.req.query('offset') || '0', 10)

      // Validate status if provided
      if (status && !['PENDING', 'ACCEPTED', 'EXPIRED'].includes(status)) {
        return ctx.json(
          errorResponse(
            null,
            ErrorCode.VALIDATION_ERROR,
            'Invalid status filter'
          ),
          { status: 400 }
        )
      }

      // Initialize service
      const auditService = new AuditService({ db })
      const invitationService = new InvitationService({ db, auditService })

      // Get invitations
      const { invitations, total } = await invitationService.getInvitations(
        status,
        limit,
        offset
      )

      return ctx.json(
        successResponse({
          invitations: invitations.map((inv: any) => ({
            id: inv.id,
            email: inv.email,
            role_id: inv.role_id,
            role_name: inv.role_name,
            status: inv.status,
            expires_at: inv.expires_at.toISOString(),
            invited_by: inv.invited_by,
            invited_by_username: inv.invited_by_username,
            created_at: inv.created_at.toISOString(),
          })),
          total,
          limit,
          offset,
        }),
        { status: 200 }
      )
    } catch (err) {
      return ctx.json(
        errorResponse(
          null,
          ErrorCode.INTERNAL_ERROR,
          'Failed to list invitations'
        ),
        { status: 500 }
      )
    }
  })

  return router
}

/**
 * Mount invitations routes on app
 */
export function mountInvitationsRoutes(app: Hono): void {
  const router = createInvitationsRoutes()
  app.route('/', router)
}
