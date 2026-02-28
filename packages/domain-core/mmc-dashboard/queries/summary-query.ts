/**
 * Summary Endpoint Query Builder
 *
 * Purpose: Build SQL query for dashboard summary (commercial health)
 * - License status aggregation
 * - Current month revenue
 * - Year-to-date revenue
 * - Last month revenue (for growth)
 *
 * File: packages/domain-core/mmc-dashboard/queries/summary-query.ts
 * Task: T012 [P]
 * Phase: 1 - Backend Implementation (parallel)
 *
 * SQL Optimization:
 * - Uses pre-built indexes: idx_licenses_status, idx_revenue_records_created_at
 * - Two queries executed in parallel via Promise.all()
 * - Expected execution time: <50ms each query
 * - Cache TTL: 5 minutes (refresh via cache middleware)
 */

import { Pool } from 'pg'

export interface SummaryQueryParams {
  correlation_id: string
}

/**
 * Get license counts by status
 */
export async function getLicenseCountsByStatus(
  pool: Pool,
  correlationId: string
): Promise<{ status: string; count: number }[]> {
  const query = `
    SELECT status, COUNT(*) as count
    FROM licenses
    WHERE deleted_at IS NULL
    GROUP BY status
    ORDER BY CASE 
      WHEN status = 'ACTIVE' THEN 1
      WHEN status = 'SOFT_LOCKED' THEN 2
      WHEN status = 'ARCHIVED' THEN 3
    END
  `

  try {
    const result = await pool.query(query)
    return result.rows
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    throw new Error(`License count query failed: ${msg}`)
  }
}

/**
 * Get revenue for current month
 */
export async function getRevenueCurrentMonth(
  pool: Pool,
  correlationId: string
): Promise<number> {
  const query = `
    SELECT SUM(amount_cents) as total
    FROM revenue_records
    WHERE created_at >= DATE_TRUNC('month', NOW())
      AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  `

  const result = await pool.query(query)
  return result.rows[0]?.total || 0
}

/**
 * Get revenue for current year
 */
export async function getRevenueCurrentYear(
  pool: Pool,
  correlationId: string
): Promise<number> {
  const query = `
    SELECT SUM(amount_cents) as total
    FROM revenue_records
    WHERE created_at >= DATE_TRUNC('year', NOW())
  `

  const result = await pool.query(query)
  return result.rows[0]?.total || 0
}

/**
 * Get revenue for last month
 */
export async function getRevenueLastMonth(
  pool: Pool,
  correlationId: string
): Promise<number> {
  const query = `
    SELECT SUM(amount_cents) as total
    FROM revenue_records
    WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
      AND created_at < DATE_TRUNC('month', NOW())
  `

  const result = await pool.query(query)
  return result.rows[0]?.total || 0
}

/**
 * Get total revenue across all time
 */
export async function getRevenueTotal(
  pool: Pool,
  correlationId: string
): Promise<number> {
  const query = `
    SELECT SUM(amount_cents) as total
    FROM revenue_records
  `

  const result = await pool.query(query)
  return result.rows[0]?.total || 0
}

/**
 * Get top 5 products by revenue (for summary card)
 */
export async function getTopProducts(
  pool: Pool,
  correlationId: string,
  limit: number = 5
): Promise<{ product_id: string; total_revenue: number, license_count: number }[]> {
  const query = `
    SELECT
      r.product_id,
      SUM(r.amount_cents) as total_revenue,
      COUNT(DISTINCT r.license_id) as license_count
    FROM revenue_records r
    GROUP BY r.product_id
    ORDER BY total_revenue DESC
    LIMIT $1
  `

  const result = await pool.query(query, [limit])
  return result.rows
}

export default {
  getLicenseCountsByStatus,
  getRevenueCurrentMonth,
  getRevenueCurrentYear,
  getRevenueLastMonth,
  getRevenueTotal,
  getTopProducts,
}

