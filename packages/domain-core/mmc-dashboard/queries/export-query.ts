/**
 * CSV Export Query Builder
 *
 * Purpose: Build query for CSV data export
 * - Validates row count before execution (max 50,000 rows)
 * - Supports section filtering (geographic, revenue, affiliate, product)
 * - Returns data ready for CSV streaming
 *
 * File: packages/domain-core/mmc-dashboard/queries/export-query.ts
 * Task: T017 [P]
 * Phase: 1 - Backend Implementation (parallel)
 *
 * Constraint:
 * - MAX 50,000 rows (returns 413 Payload Too Large if exceeded)
 * - Hard timeout: 2 seconds (critical per T023)
 * - Response: CSV with UTF-8 BOM
 */

import type { Pool } from 'pg'

const MAX_EXPORT_ROWS = 50000

export interface ExportParams {
  section: 'geographic' | 'revenue' | 'affiliate' | 'product'
  date_from?: Date
  date_to?: Date
}

/**
 * Count rows for export section
 *
 * Returns: Row count, throws if > 50,000
 */
export async function countExportRows(pool: Pool, section: string): Promise<number> {
  let countQuery = ''

  switch (section) {
    case 'geographic':
      countQuery = `
        SELECT COUNT(DISTINCT billing_country) as count
        FROM revenue_records
      `
      break
    case 'revenue':
      countQuery = `
        SELECT COUNT(*) as count
        FROM revenue_records
      `
      break
    case 'affiliate':
      countQuery = `
        SELECT COUNT(*) as count
        FROM affiliates a
        LEFT JOIN affiliate_usages au ON a.id = au.affiliate_id
      `
      break
    case 'product':
      countQuery = `
        SELECT COUNT(*) as count
        FROM products
      `
      break
    default:
      throw new Error(`Invalid export section: ${section}`)
  }

  const result = await pool.query(countQuery)
  const rowCount = result.rows[0]?.count || 0

  if (rowCount > MAX_EXPORT_ROWS) {
    throw new Error(`Export exceeds maximum rows: ${rowCount} > ${MAX_EXPORT_ROWS}`)
  }

  return rowCount
}

/**
 * Get geographic data for export
 */
export async function getGeographicExport(pool: Pool) {
  const query = `
    SELECT
      r.billing_country as country_code,
      SUM(r.amount_cents) as total_revenue,
      COUNT(DISTINCT r.license_id) as license_count,
      (SUM(r.amount_cents)::FLOAT / COUNT(DISTINCT r.license_id)) as avg_revenue
    FROM revenue_records r
    GROUP BY r.billing_country
    ORDER BY total_revenue DESC
  `
  const result = await pool.query(query)
  return result.rows
}

/**
 * Get revenue data for export
 */
export async function getRevenueExport(pool: Pool, dateFrom?: Date, dateTo?: Date) {
  const params: unknown[] = []
  let dateFilter = ''

  if (dateFrom && dateTo) {
    dateFilter = 'WHERE r.created_at >= $1 AND r.created_at <= $2'
    params.push(dateFrom, dateTo)
  }

  const query = `
    SELECT
      p.name->>'en' as product_name,
      r.amount_cents as amount,
      r.created_at as transaction_date,
      r.billing_country as country
    FROM revenue_records r
    JOIN products p ON r.product_id = p.id
    ${dateFilter}
    ORDER BY r.created_at DESC
  `

  const result = await pool.query(query, params)
  return result.rows
}

/**
 * Get affiliate data for export
 */
export async function getAffiliateExport(pool: Pool) {
  const query = `
    SELECT
      a.name as affiliate_name,
      a.status,
      a.email,
      COUNT(DISTINCT au.id) as referral_count,
      SUM(COALESCE(au.amount_cents, 0)) as total_commission
    FROM affiliates a
    LEFT JOIN affiliate_usages au ON a.id = au.affiliate_id
    GROUP BY a.id, a.name, a.status, a.email
    ORDER BY total_commission DESC
  `

  const result = await pool.query(query)
  return result.rows
}

/**
 * Get product data for export
 */
export async function getProductExport(pool: Pool) {
  const query = `
    SELECT
      p.name->>'en' as product_name,
      p.slug,
      COUNT(DISTINCT r.license_id) as license_count,
      SUM(COALESCE(r.amount_cents, 0)) as total_revenue
    FROM products p
    LEFT JOIN revenue_records r ON p.id = r.product_id
    GROUP BY p.id, p.name, p.slug
    ORDER BY total_revenue DESC
  `

  const result = await pool.query(query)
  return result.rows
}

export default {
  countExportRows,
  getGeographicExport,
  getRevenueExport,
  getAffiliateExport,
  getProductExport,
}
