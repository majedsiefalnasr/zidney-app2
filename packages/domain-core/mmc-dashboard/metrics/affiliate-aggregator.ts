/**
 * Affiliate Metrics Functions for MMC Dashboard
 *
 * Purpose: Calculate affiliate performance metrics
 * - Commission summation with precision
 * - Average calculation per affiliate
 * - Pagination math for result sets
 * - Ranking/leaderboard calculations
 */

export interface AffiliateMetrics {
  affiliate_id: string
  total_commission_cents: number
  usage_count: number
  avg_commission_per_usage_cents: number
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
}

export function calculateAverageCommission(
  totalCents: number,
  usageCount: number
): number {
  if (usageCount === 0) return 0
  return Math.floor(totalCents / usageCount)
}

export function calculatePaginationOffset(
  page: number,
  pageSize: number,
  totalItems: number
): {
  offset: number
  page: number
  page_size: number
  total_pages: number
} {
  const offset = Math.max(0, (page - 1) * pageSize)
  const totalPages = Math.ceil(totalItems / pageSize)

  return {
    offset,
    page: Math.max(1, page),
    page_size: pageSize,
    total_pages: Math.max(1, totalPages),
  }
}

export function rankAffiliates(
  metrics: AffiliateMetrics[]
): (AffiliateMetrics & { rank: number })[] {
  const sorted = [...metrics].sort(
    (a, b) => b.total_commission_cents - a.total_commission_cents
  )

  let rank = 1
  let previousCommission = -1

  return sorted.map((metric, index) => {
    if (metric.total_commission_cents !== previousCommission) {
      rank = index + 1
      previousCommission = metric.total_commission_cents
    }

    return {
      ...metric,
      rank,
    }
  })
}

export function filterByStatus(
  metrics: AffiliateMetrics[],
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'ALL'
): AffiliateMetrics[] {
  if (status === 'ALL') return metrics
  return metrics.filter((m) => m.status === status)
}

export function sortAffiliates(
  metrics: AffiliateMetrics[],
  sortBy: 'commission' | 'usage_count' | 'name' = 'commission',
  sortOrder: 'ASC' | 'DESC' = 'DESC'
): AffiliateMetrics[] {
  const sorted = [...metrics].sort((a, b) => {
    let aVal: number
    let bVal: number

    if (sortBy === 'commission') {
      aVal = a.total_commission_cents
      bVal = b.total_commission_cents
    } else if (sortBy === 'usage_count') {
      aVal = a.usage_count
      bVal = b.usage_count
    } else {
      return 0
    }

    return sortOrder === 'DESC' ? bVal - aVal : aVal - bVal
  })

  return sorted
}

export function calculateTotalCommission(metrics: AffiliateMetrics[]): number {
  return metrics.reduce((total, m) => total + m.total_commission_cents, 0)
}

export function getAffiliateStatistics(metrics: AffiliateMetrics[]) {
  if (metrics.length === 0) {
    return {
      total_affiliates: 0,
      total_commission_cents: 0,
      avg_commission_per_affiliate_cents: 0,
      active_count: 0,
      inactive_count: 0,
      suspended_count: 0,
    }
  }

  const totalCommission = calculateTotalCommission(metrics)
  const avgCommission = Math.floor(totalCommission / metrics.length)

  const statusCounts = metrics.reduce(
    (acc, m) => {
      acc[m.status] = (acc[m.status] || 0) + 1
      return acc
    },
    { ACTIVE: 0, INACTIVE: 0, SUSPENDED: 0 }
  )

  return {
    total_affiliates: metrics.length,
    total_commission_cents: totalCommission,
    avg_commission_per_affiliate_cents: avgCommission,
    active_count: statusCounts.ACTIVE,
    inactive_count: statusCounts.INACTIVE,
    suspended_count: statusCounts.SUSPENDED,
  }
}

export default {
  calculateAverageCommission,
  calculatePaginationOffset,
  rankAffiliates,
  filterByStatus,
  sortAffiliates,
  calculateTotalCommission,
  getAffiliateStatistics,
}
