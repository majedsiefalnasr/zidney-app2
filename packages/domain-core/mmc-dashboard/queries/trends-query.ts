/**
 * Trends Query Builder
 *
 * Purpose: Get monthly revenue and license trends
 * - Supports 3, 6, 12 month periods
 * - Calculates month-over-month growth
 *
 * File: packages/domain-core/mmc-dashboard/queries/trends-query.ts
 * Task: T016 [P]
 * Phase: 1 - Backend Implementation (parallel)
 */

import type { Pool } from 'pg'

export async function getTrendsData(pool: Pool, months: 3 | 6 | 12 = 12) {
  const startDate = new Date()
  startDate.setMonth(startDate.getMonth() - months)

  const query = `
    SELECT
      DATE_TRUNC('month', r.created_at)::DATE as period,
      SUM(r.amount_cents) as revenue_cents,
      COUNT(DISTINCT r.license_id) as license_count
    FROM revenue_records r
    WHERE r.created_at >= $1
    GROUP BY DATE_TRUNC('month', r.created_at)
    ORDER BY period ASC
  `

  const result = await pool.query(query, [startDate])
  return result.rows.map((row: Record<string, unknown>) => {
    const periodVal = row.period as Date | string | undefined
    const periodStr =
      periodVal instanceof Date ? periodVal.toISOString().substring(0, 7) : String(periodVal ?? '')
    return {
      period: periodStr,
      revenue_cents: (row.revenue_cents as number) || 0,
      license_count: (row.license_count as number) || 0,
    }
  })
}

export default {
  getTrendsData,
}
