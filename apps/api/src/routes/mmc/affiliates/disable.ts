/**
 * Disable Affiliate Handler
 * Stage: STAGE_13_AFFILIATES
 * Endpoint: POST /v1/mmc/affiliates/:id/disable
 * Auth: MMC token + RBAC admin role
 * Purpose: Soft delete affiliate by changing status to INACTIVE
 */

import { Affiliate } from '@zidney/domain-core/affiliates/types'
import { Context } from 'hono'
import { pool } from '../../../../db'

export async function disableAffiliateHandler(c: Context) {
  try {
    const affiliateId = c.req.param('id')

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

    // Check if already inactive
    if (current.status === 'INACTIVE') {
      c.status(400)
      return c.json({
        success: false,
        data: null,
        error: {
          code: 'ALREADY_INACTIVE',
          message: 'Affiliate is already disabled',
        },
      })
    }

    // Update status to INACTIVE
    const updateResult = await pool.query(
      `UPDATE affiliates SET status = 'INACTIVE', updated_at = NOW()
       WHERE id = $1
       RETURNING id, promo_code, discount_percentage, commission_percentage,
                allow_with_other_discounts, usage_limit_total, usage_limit_per_client,
                usage_count, start_date, end_date, status, description,
                created_at, updated_at`,
      [affiliateId]
    )

    const updated = updateResult.rows[0] as Affiliate

    // TODO: Insert into affiliate_admin_audit with ACTION='DISABLE'

    console.log('[AFFILIATE] Disabled:', {
      affiliate_id: affiliateId,
      promo_code: current.promo_code,
      correlation_id: c.get('correlation_id'),
    })

    c.status(200)
    return c.json({
      success: true,
      data: updated,
      error: null,
    })
  } catch (error: any) {
    console.error('[AFFILIATE] Disable error:', error)

    c.status(500)
    return c.json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to disable affiliate',
      },
    })
  }
}
