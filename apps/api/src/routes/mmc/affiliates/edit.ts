/**
 * Edit Affiliate Handler
 * Stage: STAGE_13_AFFILIATES
 * Endpoint: PATCH /v1/mmc/affiliates/:id
 * Auth: MMC token + RBAC admin role
 * Purpose: Edit affiliate (except immutable promo_code)
 */

import {
  AffiliateErrorCode,
  AffiliateErrorMessages,
} from '@zidney/domain-core/affiliates/error-codes'
import type { Affiliate } from '@zidney/domain-core/affiliates/types'
import { validatePercentageRange } from '@zidney/domain-core/affiliates/validators'
import { logger } from '@zidney/logger'
import type { Context } from 'hono'
import { pool } from '../../../../db'
import { validateUpdateAffiliateRequest } from '../../../middleware/affiliate-validation'

export async function editAffiliateHandler(c: Context) {
  try {
    const affiliateId = c.req.param('id')
    const body = await c.req.json()

    // Check if trying to edit promo_code (immutable)
    if ('promo_code' in body) {
      c.status(409)
      return c.json({
        success: false,
        data: null,
        error: {
          code: 'IMMUTABILITY_VIOLATION',
          message: 'Promo code is immutable and cannot be changed',
        },
      })
    }

    // Validate request body
    const validated = await validateUpdateAffiliateRequest(body)

    // Load current affiliate
    const currentResult = await pool.query(
      `SELECT id, promo_code, discount_percentage, commission_percentage,
              allow_with_other_discounts, usage_limit_total, usage_limit_per_client,
              usage_count, start_date, end_date, status, description,
              created_at, updated_at
       FROM affiliates WHERE id = $1`,
      [affiliateId]
    )

    if (currentResult.rows.length === 0) {
      c.status(404)
      return c.json({
        success: false,
        data: null,
        error: {
          code: 'NOT_FOUND',
          message: 'Affiliate not found',
        },
      })
    }

    const current = currentResult.rows[0]

    // Prepare update values (only specified fields)
    const updates: Record<string, unknown> = {}

    if (validated.discount_percentage !== undefined) {
      if (!validatePercentageRange(validated.discount_percentage)) {
        c.status(400)
        return c.json({
          success: false,
          data: null,
          error: {
            code: AffiliateErrorCode.AFFILIATE_INVALID_DISCOUNT_PERCENTAGE,
            message:
              AffiliateErrorMessages[AffiliateErrorCode.AFFILIATE_INVALID_DISCOUNT_PERCENTAGE],
          },
        })
      }
      updates.discount_percentage = validated.discount_percentage
    }

    if (validated.commission_percentage !== undefined) {
      if (!validatePercentageRange(validated.commission_percentage)) {
        c.status(400)
        return c.json({
          success: false,
          data: null,
          error: {
            code: AffiliateErrorCode.AFFILIATE_INVALID_COMMISSION_PERCENTAGE,
            message:
              AffiliateErrorMessages[AffiliateErrorCode.AFFILIATE_INVALID_COMMISSION_PERCENTAGE],
          },
        })
      }
      updates.commission_percentage = validated.commission_percentage
    }

    if (validated.allow_with_other_discounts !== undefined) {
      updates.allow_with_other_discounts = validated.allow_with_other_discounts
    }

    if (validated.usage_limit_total !== undefined) {
      updates.usage_limit_total = validated.usage_limit_total
    }

    if (validated.usage_limit_per_client !== undefined) {
      updates.usage_limit_per_client = validated.usage_limit_per_client
    }

    if (validated.description !== undefined) {
      updates.description = validated.description
    }

    if (Object.keys(updates).length === 0) {
      // No updates
      c.status(200)
      return c.json({
        success: true,
        data: current as Affiliate,
        error: null,
      })
    }

    // Build UPDATE query
    const updateClauses = Object.keys(updates).map((key, idx) => `${key} = $${idx + 1}`)
    const updateValues = Object.values(updates)

    const updateQuery = `
      UPDATE affiliates
      SET ${updateClauses.join(', ')}, updated_at = NOW()
      WHERE id = $${updateValues.length + 1}
      RETURNING id, promo_code, discount_percentage, commission_percentage,
               allow_with_other_discounts, usage_limit_total, usage_limit_per_client,
               usage_count, start_date, end_date, status, description,
               created_at, updated_at
    `

    const result = await pool.query(updateQuery, [...updateValues, affiliateId])
    const updated = result.rows[0] as Affiliate

    // Log audit trail
    // Store old/new values for audit
    const auditOldValues: Record<string, unknown> = {}
    const auditNewValues: Record<string, unknown> = {}

    Object.keys(updates).forEach((key) => {
      auditOldValues[key] = current[key as keyof Affiliate]
      auditNewValues[key] = updated[key as keyof Affiliate]
    })

    // TODO: Insert into affiliate_admin_audit (requires admin_id context)

    logger.info('[AFFILIATE] Updated:', {
      affiliate_id: affiliateId,
      fields_changed: Object.keys(updates),
      correlation_id: c.get('correlation_id'),
    })

    c.status(200)
    return c.json({
      success: true,
      data: updated,
      error: null,
    })
  } catch (error: unknown) {
    logger.error('[AFFILIATE] Edit error:', { error })
    const errorCode =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : undefined
    const errorMessage =
      error instanceof Error
        ? error.message
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message)
          : String(error)

    if (errorCode === 'VALIDATION_ERROR') {
      c.status(400)
      return c.json({
        success: false,
        data: null,
        error: {
          code: errorCode,
          message: errorMessage,
        },
      })
    }

    c.status(500)
    return c.json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to edit affiliate',
      },
    })
  }
}
