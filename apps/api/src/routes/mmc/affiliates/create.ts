/**
 * Create Affiliate Handler
 * Stage: STAGE_13_AFFILIATES
 * Endpoint: POST /v1/mmc/affiliates
 * Auth: MMC token + RBAC admin role
 * Purpose: Create a new affiliate promotional code
 */

import {
  AffiliateErrorCode,
  AffiliateErrorMessages,
} from '@zidney/domain-core/affiliates/error-codes'
import type { Affiliate } from '@zidney/domain-core/affiliates/types'
import {
  normalizePromoCode,
  validateAffiliateData,
} from '@zidney/domain-core/affiliates/validators'
import { logger } from '@zidney/logger'
import type { Context } from 'hono'
import { pool } from '../../../../db'
import { validateCreateAffiliateRequest } from '../../../middleware/affiliate-validation'

export async function createAffiliateHandler(c: Context) {
  try {
    const body = await c.req.json()

    // Validate request body
    const validated = await validateCreateAffiliateRequest(body)

    // Normalize promo code
    const normalizedCode = normalizePromoCode(validated.promo_code)

    // Validate all affiliate data
    const dataValidation = validateAffiliateData({
      promo_code: normalizedCode,
      discount_percentage: validated.discount_percentage,
      commission_percentage: validated.commission_percentage,
      start_date: validated.start_date,
      end_date: validated.end_date,
      usage_limit_total: validated.usage_limit_total,
      usage_limit_per_client: validated.usage_limit_per_client,
    })

    if (!dataValidation.valid) {
      c.status(400)
      return c.json({
        success: false,
        data: null,
        error: {
          code: dataValidation.errorCode || 'VALIDATION_ERROR',
          message: dataValidation.error || 'Validation failed',
        },
      })
    }

    // Check for duplicate promo code (pre-query check)
    const existingCheck = await pool.query('SELECT id FROM affiliates WHERE promo_code = $1', [
      normalizedCode,
    ])

    if (existingCheck.rows.length > 0) {
      c.status(400)
      return c.json({
        success: false,
        data: null,
        error: {
          code: AffiliateErrorCode.AFFILIATE_FORBIDDEN_DUPLICATE_PROMO_CODE,
          message:
            AffiliateErrorMessages[AffiliateErrorCode.AFFILIATE_FORBIDDEN_DUPLICATE_PROMO_CODE],
        },
      })
    }

    // Insert affiliate record
    const result = await pool.query(
      `INSERT INTO affiliates (
        promo_code, discount_percentage, commission_percentage,
        allow_with_other_discounts, usage_limit_total, usage_limit_per_client,
        start_date, end_date, status, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, promo_code, discount_percentage, commission_percentage,
               allow_with_other_discounts, usage_limit_total, usage_limit_per_client,
               usage_count, start_date, end_date, status, description,
               created_at, updated_at`,
      [
        normalizedCode,
        validated.discount_percentage,
        validated.commission_percentage,
        validated.allow_with_other_discounts,
        validated.usage_limit_total || null,
        validated.usage_limit_per_client || null,
        validated.start_date,
        validated.end_date,
        'ACTIVE',
        validated.description || null,
      ]
    )

    const affiliate: Affiliate = result.rows[0]

    // Log affiliate creation (structured logging would go here)
    logger.info('[AFFILIATE] Created:', {
      affiliate_id: affiliate.id,
      promo_code: affiliate.promo_code,
      correlation_id: c.get('correlation_id'),
    })

    c.status(201)
    return c.json({
      success: true,
      data: affiliate,
      error: null,
    })
  } catch (error: any) {
    logger.error('[AFFILIATE] Create error:', { error })

    if (error.code === 'VALIDATION_ERROR') {
      c.status(400)
      return c.json({
        success: false,
        data: null,
        error: {
          code: error.code,
          message: error.message,
        },
      })
    }

    // Constraint violations (UNIQUE, CHECK, etc.)
    if (error.code === '23505') {
      // Unique violation
      c.status(400)
      return c.json({
        success: false,
        data: null,
        error: {
          code: AffiliateErrorCode.AFFILIATE_FORBIDDEN_DUPLICATE_PROMO_CODE,
          message:
            AffiliateErrorMessages[AffiliateErrorCode.AFFILIATE_FORBIDDEN_DUPLICATE_PROMO_CODE],
        },
      })
    }

    if (error.code === '23514') {
      // Check constraint violation
      c.status(400)
      return c.json({
        success: false,
        data: null,
        error: {
          code: 'CONSTRAINT_VIOLATION',
          message: 'Invalid values for constraint',
        },
      })
    }

    c.status(500)
    return c.json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create affiliate',
      },
    })
  }
}
