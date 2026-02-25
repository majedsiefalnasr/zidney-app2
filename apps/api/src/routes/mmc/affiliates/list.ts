/**
 * List Affiliates Handler
 * Stage: STAGE_13_AFFILIATES
 * Endpoint: GET /v1/mmc/affiliates
 * Auth: MMC token + RBAC admin role
 * Purpose: List all affiliate codes with optional filtering and pagination
 */

import { Affiliate } from '@zidney/domain-core/affiliates/types'
import { Context } from 'hono'
import { pool } from '../../../../db'
import { validateListAffiliatesRequest } from '../../../middleware/affiliate-validation'

interface ListResponse {
  affiliates: Affiliate[]
  total_count: number
  page: number
  limit: number
  pages: number
}

export async function listAffiliatesHandler(c: Context) {
  try {
    const query = c.req.query()

    // Validate query parameters
    const validated = await validateListAffiliatesRequest(query)

    // Build WHERE clause
    const whereClauses = []
    const params: any[] = []
    let paramIndex = 1

    if (validated.status) {
      whereClauses.push(`status = $${paramIndex}`)
      params.push(validated.status)
      paramIndex++
    }

    if (validated.created_after) {
      whereClauses.push(`created_at >= $${paramIndex}`)
      params.push(validated.created_after)
      paramIndex++
    }

    if (validated.created_before) {
      whereClauses.push(`created_at <= $${paramIndex}`)
      params.push(validated.created_before)
      paramIndex++
    }

    const whereClause =
      whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''

    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM affiliates ${whereClause}`
    const countResult = await pool.query(countQuery, params)
    const totalCount = parseInt(countResult.rows[0].count, 10)

    // Calculate pagination
    const offset = (validated.page - 1) * validated.limit
    const pages = Math.ceil(totalCount / validated.limit)

    // Fetch affiliates
    const selectQuery = `
      SELECT id, promo_code, discount_percentage, commission_percentage,
             allow_with_other_discounts, usage_limit_total, usage_limit_per_client,
             usage_count, start_date, end_date, status, description,
             created_at, updated_at
      FROM affiliates
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `

    const listParams = [...params, validated.limit, offset]
    const result = await pool.query(selectQuery, listParams)

    const response: ListResponse = {
      affiliates: result.rows as Affiliate[],
      total_count: totalCount,
      page: validated.page,
      limit: validated.limit,
      pages: pages,
    }

    return c.json({
      success: true,
      data: response,
      error: null,
    })
  } catch (error: any) {
    console.error('[AFFILIATE] List error:', error)

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

    c.status(500)
    return c.json({
      success: false,
      data: null,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list affiliates',
      },
    })
  }
}
