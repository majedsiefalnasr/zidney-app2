/**
 * Get Affiliate Usages Handler
 * Stage: STAGE_13_AFFILIATES
 * Endpoint: GET /v1/mmc/affiliates/:id/usages
 * Auth: MMC token + RBAC admin role
 * Purpose: View usage history for an affiliate with aggregate statistics
 */

import type { AffiliateUsage } from '@zidney/domain-core/affiliates/types'
import { logger } from '@zidney/logger'
import type { Context } from 'hono'
import { pool } from '../../../../db'

interface UsageStats {
  total_base_amount: string
  total_discount_amount: string
  total_commission_amount: string
  total_usages: number
}

interface UsageResponse {
  affiliate_id: string
  promo_code: string
  usages: AffiliateUsage[]
  stats: UsageStats
  page: number
  limit: number
  total: number
  pages: number
}

export async function getAffiliateUsagesHandler(c: Context) {
  try {
    const affiliateId = c.req.param('id')
    const page = parseInt(c.req.query('page') || '1', 10)
    const limit = parseInt(c.req.query('limit') || '20', 10)

    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      c.status(400)
      return c.json({
        success: false,
        data: null,
        error: {
          code: 'INVALID_PAGINATION',
          message: 'Invalid pagination parameters',
        },
      })
    }

    // Load affiliate
    const affiliateResult = await pool.query(
      'SELECT id, promo_code FROM affiliates WHERE id = $1',
      [affiliateId]
    )

    if (affiliateResult.rows.length === 0) {
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

    const affiliate = affiliateResult.rows[0]

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) as count FROM affiliate_usages WHERE affiliate_id = $1',
      [affiliateId]
    )

    const totalCount = parseInt(countResult.rows[0].count, 10)
    const offset = (page - 1) * limit
    const pages = Math.ceil(totalCount / limit)

    // Get usages with pagination
    const usagesResult = await pool.query(
      `SELECT id, affiliate_id, client_id, license_id,
              base_amount, discount_percentage, discount_amount,
              commission_percentage, commission_amount, created_at
       FROM affiliate_usages
       WHERE affiliate_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [affiliateId, limit, offset]
    )

    // Calculate aggregate statistics
    const statsResult = await pool.query(
      `SELECT 
         SUM(base_amount)::numeric as total_base_amount,
         SUM(discount_amount)::numeric as total_discount_amount,
         SUM(commission_amount)::numeric as total_commission_amount
       FROM affiliate_usages
       WHERE affiliate_id = $1`,
      [affiliateId]
    )

    const statsRow = statsResult.rows[0]
    const stats: UsageStats = {
      total_base_amount: statsRow.total_base_amount || '0.00',
      total_discount_amount: statsRow.total_discount_amount || '0.00',
      total_commission_amount: statsRow.total_commission_amount || '0.00',
      total_usages: totalCount,
    }

    const response: UsageResponse = {
      affiliate_id: affiliateId,
      promo_code: affiliate.promo_code,
      usages: usagesResult.rows as AffiliateUsage[],
      stats: stats,
      page: page,
      limit: limit,
      total: totalCount,
      pages: pages,
    }

    return c.json({
      success: true,
      data: response,
      error: null,
    })
  } catch (error: unknown) {
    logger.error('[AFFILIATE] Get usages error:', { error })

    c.status(500)
    return c.json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve affiliate usages',
      },
    })
  }
}
