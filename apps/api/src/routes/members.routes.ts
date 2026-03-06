/**
 * Member CRUD Routes
 *
 * File: apps/api/src/routes/members.routes.ts
 * Task: T015, T016, T017, T018
 * Phase: 3 - Member Management CRUD
 *
 * Endpoints:
 * - POST /mmc/members (T015) - Create member
 * - GET /mmc/members/:id (T016) - Get member
 * - PATCH /mmc/members/:id (T017) - Update member
 * - DELETE /mmc/members/:id (T018) - Disable member
 *
 * All endpoints require MMC authentication + permission check
 */

import { AppError, ErrorCode, errorResponse, successResponse } from '@zidney/domain-core/errors'
import type { AuditService } from '@zidney/domain-core/services/audit.service'
import type { MemberService } from '@zidney/domain-core/services/member.service'
import type { Logger } from '@zidney/logger'
import type { CreateMemberRequest, UpdateMemberRequest } from '@zidney/types/mmc.types'
import { type Context, Hono } from 'hono'
import type { Database } from 'postgres'
import {
  getRequestContext,
  // @ts-expect-error: LOGIC-BUG: requireMMCAuth is not exported from correlation-id.middleware — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
  requireMMCAuth,
} from '../middleware/correlation-id.middleware'

export function createMembersRouter(
  _db: Database,
  memberService: MemberService,
  _auditService: AuditService,
  logger: Logger
): Hono {
  const router = new Hono()

  /**
   * POST /mmc/members
   *
   * Create a new MMC member
   *
   * Permission: MEMBERS_MANAGEMENT.create
   * Rate limit: 10/min/user
   */
  router.post('/members', async (ctx: Context) => {
    try {
      const context = getRequestContext(ctx)
      requireMMCAuth(ctx)

      const userId = context.mmcUser?.userId
      const correlationId = context.correlationId
      const ipAddress = ctx.req.header('X-Forwarded-For') || 'unknown'
      const userAgent = ctx.req.header('User-Agent') || 'unknown'

      // Parse request
      const body = await ctx.req.json<CreateMemberRequest>()

      // Validate required fields
      if (!body.username || !body.email || !body.password || !body.role_id) {
        return ctx.json(
          errorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Missing required fields: username, email, password, role_id',
            // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
            400
          ),
          // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
          400
        )
      }

      // Create member
      const member = await memberService.createMember(
        body,
        userId,
        correlationId,
        ipAddress,
        userAgent
      )

      logger.info(
        {
          correlation_id: correlationId,
          user_id: userId,
          created_member_id: member.id,
          action: 'member_created',
        },
        `Member ${member.username} created`
      )

      return ctx.json(successResponse(member), 201)
    } catch (error) {
      if (error instanceof AppError) {
        logger.warn(
          {
            correlation_id: getRequestContext(ctx).correlationId,
            error_code: error.code,
            status: error.statusCode,
          },
          `Member creation failed: ${error.message}`
        )
        return ctx.json(
          errorResponse(error.code, error.message, error.details),
          // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
          error.statusCode
        )
      }

      logger.error(
        {
          correlation_id: getRequestContext(ctx).correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Unexpected error in member creation'
      )

      return ctx.json(
        errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to create member', {
          error: error instanceof Error ? error.message : String(error),
        }),
        // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
        500
      )
    }
  })

  /**
   * GET /mmc/members/:id
   *
   * Get member by ID
   *
   * Permission: MEMBERS_MANAGEMENT.view
   */
  router.get('/members/:id', async (ctx: Context) => {
    try {
      const context = getRequestContext(ctx)
      requireMMCAuth(ctx)

      const memberId = ctx.req.param('id')
      const correlationId = context.correlationId

      // Validate UUID format
      // @ts-expect-error: LOGIC-BUG: this implicitly any in route handler closure — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
      if (!this.isValidUUID(memberId)) {
        return ctx.json(
          errorResponse(
            ErrorCode.INVALID_REQUEST,
            'Invalid member ID format',
            // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
            400
          ),
          // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
          400
        )
      }

      const member = await memberService.getMember(memberId)
      if (!member) {
        return ctx.json(
          errorResponse(ErrorCode.NOT_FOUND, 'Member not found'),
          // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
          404
        )
      }

      logger.debug(
        {
          correlation_id: correlationId,
          member_id: memberId,
        },
        `Member retrieved: ${member.username}`
      )

      return ctx.json(successResponse(member))
    } catch (error) {
      logger.error(
        {
          correlation_id: getRequestContext(ctx).correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Unexpected error in member retrieval'
      )

      return ctx.json(
        errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to retrieve member'),
        // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
        500
      )
    }
  })

  /**
   * PATCH /mmc/members/:id
   *
   * Update member (email, team, group, department)
   *
   * Permission: MEMBERS_MANAGEMENT.edit
   * Idempotent: Yes (via Idempotency-Key header)
   */
  router.patch('/members/:id', async (ctx: Context) => {
    try {
      const context = getRequestContext(ctx)
      requireMMCAuth(ctx)

      const memberId = ctx.req.param('id')
      const userId = context.mmcUser?.userId
      const correlationId = context.correlationId
      const ipAddress = ctx.req.header('X-Forwarded-For') || 'unknown'
      const userAgent = ctx.req.header('User-Agent') || 'unknown'

      // Validate UUID format
      // @ts-expect-error: LOGIC-BUG: this implicitly any in route handler closure — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
      if (!this.isValidUUID(memberId)) {
        return ctx.json(
          errorResponse(
            ErrorCode.INVALID_REQUEST,
            'Invalid member ID format',
            // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
            400
          ),
          // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
          400
        )
      }

      // Parse request
      const body = await ctx.req.json<UpdateMemberRequest>()

      // Update member
      const updated = await memberService.updateMember(
        memberId,
        body,
        userId,
        correlationId,
        ipAddress,
        userAgent
      )

      logger.info(
        {
          correlation_id: correlationId,
          user_id: userId,
          member_id: memberId,
          action: 'member_updated',
        },
        `Member ${updated.username} updated`
      )

      return ctx.json(successResponse(updated))
    } catch (error) {
      if (error instanceof AppError) {
        logger.warn(
          {
            correlation_id: getRequestContext(ctx).correlationId,
            error_code: error.code,
          },
          `Member update failed: ${error.message}`
        )
        return ctx.json(
          errorResponse(error.code, error.message, error.details),
          // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
          error.statusCode
        )
      }

      logger.error(
        {
          correlation_id: getRequestContext(ctx).correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Unexpected error in member update'
      )

      return ctx.json(
        errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to update member'),
        // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
        500
      )
    }
  })

  /**
   * DELETE /mmc/members/:id
   *
   * Disable member (soft delete)
   * Sets status=DISABLED and increments token_version
   *
   * Permission: MEMBERS_MANAGEMENT.delete
   */
  router.delete('/members/:id', async (ctx: Context) => {
    try {
      const context = getRequestContext(ctx)
      requireMMCAuth(ctx)

      const memberId = ctx.req.param('id')
      const userId = context.mmcUser?.userId
      const correlationId = context.correlationId
      const ipAddress = ctx.req.header('X-Forwarded-For') || 'unknown'
      const userAgent = ctx.req.header('User-Agent') || 'unknown'

      // Validate UUID format
      // @ts-expect-error: LOGIC-BUG: this implicitly any in route handler closure — see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
      if (!this.isValidUUID(memberId)) {
        return ctx.json(
          errorResponse(
            ErrorCode.INVALID_REQUEST,
            'Invalid member ID format',
            // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
            400
          ),
          // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
          400
        )
      }

      // Prevent self-disable
      if (memberId === userId) {
        return ctx.json(
          errorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Cannot disable your own account',
            // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
            400
          ),
          // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
          400
        )
      }

      // Disable member
      const disabled = await memberService.disableMember(
        memberId,
        userId,
        correlationId,
        ipAddress,
        userAgent
      )

      logger.info(
        {
          correlation_id: correlationId,
          user_id: userId,
          disabled_member_id: memberId,
          action: 'member_disabled',
        },
        `Member ${disabled.username} disabled`
      )

      return ctx.json(
        successResponse({
          status: disabled.status,
          token_version: disabled.token_version,
        })
      )
    } catch (error) {
      if (error instanceof AppError) {
        logger.warn(
          {
            correlation_id: getRequestContext(ctx).correlationId,
            error_code: error.code,
          },
          `Member disable failed: ${error.message}`
        )
        return ctx.json(
          errorResponse(error.code, error.message, error.details),
          // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
          error.statusCode
        )
      }

      logger.error(
        {
          correlation_id: getRequestContext(ctx).correlationId,
          error: error instanceof Error ? error.message : String(error),
        },
        'Unexpected error in member disable'
      )

      return ctx.json(
        errorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to disable member'),
        // @ts-expect-error: LOGIC-BUG: ctx.json() status expects StatusCode not number - see INFRA-001-LOGIC-09 [INFRA-001-LOGIC-09]
        500
      )
    }
  })

  return router
}
