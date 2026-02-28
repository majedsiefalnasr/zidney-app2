/**
 * Revenue Breakdown Query Builder
 *
 * Purpose: Build query for top N products by revenue with growth
 * - Supports date range filtering
 * - Calculates growth metrics vs previous period
 * - Sorted by revenue descending
 *
 * File: packages/domain-core/mmc-dashboard/queries/revenue-breakdown-query.ts
 * Task: T013 [P]
 * Phase: 1 - Backend Implementation (parallel)
 */

import { Pool } from 'pg'

export interface RevenueBreakdownParams {
  date_from?: string // ISO 8601 date
  date_to?: string
  limit?: number // Default: 5
}

/**
 * Get revenue by product for specified date range
 */
export async function getProductRevenue(
  pool: Pool,
  dateFrom?: Date,
  dateTo?: Date,
  limit?: number
) {
  const fromDate = dateFrom || new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const toDate = dateTo || new Date()
  const limitValue = limit || 5

  const query = `
    SELECT
      p.id as product_id,
      p.name->>'en' as product_name,
      SUM(r.amount_cents) as total_revenue_cents,
      COUNT(DISTINCT r.license_id) as license_count
    FROM products p
    LEFT JOIN revenue_records r ON p.id = r.product_id
      AND r.created_at >= $1
      AND r.created_at <= $2
    WHERE p.enabled_modules IS NOT NULL
    GROUP BY p.id, p.name
    HAVING SUM(r.amount_cents) > 0 OR COUNT(r.*) = 0
    ORDER BY total_revenue_cents DESC
    LIMIT $3
  `

  const result = await pool.query(query, [fromDate, toDate, limitValue])
  return result.rows
}

/**
 * Get revenue for previous period (for growth calculation)
 */
export async function getProductRevenuePreviousPeriod(
  pool: Pool,
  dateFrom: Date,
  dateTo: Date
) {
  // Calculate previous period of same duration
  const duration = dateTo.getTime() - dateFrom.getTime()
  const previousTo = new Date(dateFrom.getTime())
  const previousFrom = new Date(previousTo.getTime() - duration)

  const query = `
    SELECT
      r.product_id,
      SUM(r.amount_cents) as total_revenue_cents
    FROM revenue_records r
    WHERE r.created_at >= $1
      AND r.created_at <= $2
    GROUP BY r.product_id
  `

  const result = await pool.query(query, [previousFrom, previousTo])
  
  // Convert to map for easy lookup
  const map = new Map<string, number>()
  for (const row of result.rows) {
    map.set(row.product_id, row.total_revenue_cents)
  }
  return map
}

export default {
  getProductRevenue,
  getProductRevenuePreviousPeriod,
}

