/**
 * Geographic Revenue Query Builder
 *
 * Purpose: Get revenue grouped by billing country
 * - Calculates avg revenue per license by country
 * - Supports sorting and pagination
 * - Returns country-level aggregates
 *
 * File: packages/domain-core/mmc-dashboard/queries/geographic-query.ts
 * Task: T014 [P]
 * Phase: 1 - Backend Implementation (parallel)
 */

import { Pool } from 'pg'

export async function getRevenueByCountry(
  pool: Pool,
  sortBy: 'revenue' | 'license_count' = 'revenue',
  limit?: number,
  offset?: number
) {
  const orderBy =
    sortBy === 'license_count' ? 'license_count DESC' : 'total_revenue DESC'

  const query = `
    SELECT
      COALESCE(r.billing_country, 'UNKNOWN') as country_code,
      SUM(r.amount_cents) as total_revenue_cents,
      COUNT(DISTINCT r.license_id) as license_count
    FROM revenue_records r
    GROUP BY r.billing_country
    ORDER BY ${orderBy}
    ${limit ? 'LIMIT $1' : ''}
    ${offset ? 'OFFSET $2' : ''}
  `

  const params = []
  if (limit) params.push(limit)
  if (offset) params.push(offset)

  const result = await pool.query(query, params)
  return result.rows
}

export default {
  getRevenueByCountry,
}
