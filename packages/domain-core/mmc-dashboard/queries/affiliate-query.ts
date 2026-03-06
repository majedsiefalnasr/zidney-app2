/**
 * Affiliate Query Builder
 *
 * Purpose: Get affiliate performance metrics with pagination
 * - Calculate commission totals and averages
 * - Support filtering by status
 * - Support sorting and pagination
 *
 * File: packages/domain-core/mmc-dashboard/queries/affiliate-query.ts
 * Task: T015 [P]
 * Phase: 1 - Backend Implementation (parallel)
 */

import type { Pool } from 'pg'

export async function getAffiliates(
  pool: Pool,
  page: number = 1,
  pageSize: number = 20,
  status: 'ACTIVE' | 'INACTIVE' | 'ALL' = 'ACTIVE'
) {
  const offset = Math.max(0, (page - 1) * pageSize)

  const statusFilter = status !== 'ALL' ? `AND a.status = $1` : ''
  const params = []
  if (status !== 'ALL') params.push(status)
  params.push(pageSize, offset)

  const query = `
    SELECT
      a.id as affiliate_id,
      a.name as affiliate_name,
      a.status,
      SUM(COALESCE(au.amount_cents, 0)) as total_commission_cents,
      COUNT(DISTINCT au.id) as usage_count
    FROM affiliates a
    LEFT JOIN affiliate_usages au ON a.id = au.affiliate_id
    WHERE a.status IS NOT NULL
    ${statusFilter}
    GROUP BY a.id, a.name, a.status
    ORDER BY total_commission_cents DESC
    LIMIT $${params.length - 1}
    OFFSET $${params.length}
  `

  const result = await pool.query(query, params)
  return result.rows
}

export async function getAffiliateCount(
  pool: Pool,
  status: 'ACTIVE' | 'INACTIVE' | 'ALL' = 'ACTIVE'
) {
  const statusFilter = status !== 'ALL' ? 'WHERE status = $1' : ''
  const params = status !== 'ALL' ? [status] : []

  const query = `
    SELECT COUNT(*) as count
    FROM affiliates
    ${statusFilter}
  `

  const result = await pool.query(query, params)
  return result.rows[0]?.count || 0
}

export default {
  getAffiliates,
  getAffiliateCount,
}
