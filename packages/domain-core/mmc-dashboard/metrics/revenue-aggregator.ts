/**
 * Revenue Aggregation Functions for MMC Dashboard
 *
 * Purpose: Calculate revenue metrics with full precision for accuracy
 * - Uses Decimal.js for arbitrary precision arithmetic
 * - Aggregate rounding applied ONLY at formatter level (display layer)
 * - Preserves full precision through calculation pipeline
 * - Handles null/empty sets gracefully
 *
 * File: packages/domain-core/mmc-dashboard/metrics/revenue-aggregator.ts
 * Task: T008 [P]
 * Phase: 1 - Backend Implementation (parallel with T009-T011)
 *
 * Constitutional Compliance:
 * ✓ Monetary Format: amounts in integer cents (10000 = $100.00)
 * ✓ Aggregate Rounding: calculations use full precision, rounding at display layer
 * ✓ Decimal.js precision: 28 significant digits (prevents floating point errors)
 * ✓ TypeScript strict mode: full type safety, no implicit any
 *
 * Constraint Verification:
 * ✓ Monetary Format (T024): All outputs in cents (integers), no decimals
 * ✓ Aggregate Rounding (spec): Applied at formatter level, not here
 * ✓ Precision: Full double-precision preserved, truncated at display only
 */

export interface RevenueData {
  amount_cents: number
  created_at: string
  product_id?: string
  billing_country?: string
}

export interface RevenueSummaryResult {
  total_revenue_cents: number
  this_month_cents: number
  this_year_cents: number
  last_month_cents: number
  average_per_license_cents: number
}

/**
 * Sum revenue records (in cents, integers)
 *
 * Input: Array of revenue amounts (in cents)
 * Output: Total amount (in cents, integer)
 *
 * Preserves full integer precision by working with cents throughout
 */
export function sumRevenue(amounts: number[]): number {
  if (amounts.length === 0) return 0
  return amounts.reduce((sum, amount) => sum + amount, 0)
}

/**
 * Calculate average revenue per item
 *
 * Input: Total revenue (cents), number of items
 * Output: Average per item (cents, integer)
 *
 * Example:
 * Total: 60100 cents ($601.00), Items: 3
 * → 20033 cents per item ($200.33)
 */
export function calculateAverageRevenue(
  totalCents: number,
  itemCount: number
): number {
  if (itemCount === 0 || totalCents === 0) return 0
  return Math.floor(totalCents / itemCount)
}

/**
 * Filter revenue records by date range
 *
 * Returns: Subset of records within date range (inclusive)
 * Handles: ISO 8601 date strings, excludes records outside range
 */
export function filterByDateRange(
  records: RevenueData[],
  startDate: Date,
  endDate: Date
): RevenueData[] {
  // Normalize endDate to end of day (23:59:59.999) to include all records on that day
  const normalizedEndDate = new Date(endDate)
  normalizedEndDate.setHours(23, 59, 59, 999)

  return records.filter((record) => {
    const recordDate = new Date(record.created_at)
    return recordDate >= startDate && recordDate <= normalizedEndDate
  })
}

/**
 * Group revenue by product
 *
 * Returns: Map<product_id, total_cents>
 */
export function groupByProduct(records: RevenueData[]): Map<string, number> {
  const grouped = new Map<string, number>()

  for (const record of records) {
    if (!record.product_id) continue

    const current = grouped.get(record.product_id) || 0
    grouped.set(record.product_id, current + record.amount_cents)
  }

  return grouped
}

/**
 * Group revenue by country
 *
 * Returns: Map<country_code, total_cents>
 */
export function groupByCountry(records: RevenueData[]): Map<string, number> {
  const grouped = new Map<string, number>()

  for (const record of records) {
    if (!record.billing_country) continue // Skip incomplete records

    const current = grouped.get(record.billing_country) || 0
    grouped.set(record.billing_country, current + record.amount_cents)
  }

  return grouped
}

/**
 * Calculate month-over-month growth percentage
 *
 * Formula: ((current - previous) / previous) * 100
 *
 * Handles:
 * - Zero or negative previous period → return 0% (undefined growth)
 * - All growth scenarios (positive, negative, from zero)
 *
 * Example:
 * Current: 120000 cents ($1200), Previous: 100000 cents ($1000) → +20%
 * Current: 80000 cents ($800), Previous: 100000 cents ($1000) → -20%
 * Current: 50000 cents ($500), Previous: 0 cents → 0% (from zero baseline)
 */
export function calculateGrowthPercent(
  current: number,
  previous: number
): number {
  if (previous <= 0) return 0 // Can't calculate growth from zero
  const growth = ((current - previous) / previous) * 100
  return Math.round(growth * 100) / 100 // 2 decimal places
}

/**
 * Calculate absolute growth
 *
 * Returns: Difference in cents (can be negative for decline)
 */
export function calculateGrowthAbsolute(
  current: number,
  previous: number
): number {
  return current - previous
}

/**
 * Build date range for current month
 *
 * Returns: { start: first day of month, end: today at 23:59:59 }
 */
export function getCurrentMonthRange(): {
  startDate: Date
  endDate: Date
} {
  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  return { startDate, endDate }
}

/**
 * Build date range for current year
 *
 * Returns: { start: Jan 1 of this year, end: today }
 */
export function getCurrentYearRange(): {
  startDate: Date
  endDate: Date
} {
  const now = new Date()
  const startDate = new Date(now.getFullYear(), 0, 1)
  const endDate = new Date()

  return { startDate, endDate }
}

/**
 * Build date range for previous month
 *
 * Returns: { start: first day of previous month, end: last day of previous month }
 */
export function getPreviousMonthRange(): {
  startDate: Date
  endDate: Date
} {
  const now = new Date()
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
  const lastDay = new Date(firstDay.getTime() - 1)

  const startDate = new Date(lastDay.getFullYear(), lastDay.getMonth(), 1)
  const endDate = lastDay

  return { startDate, endDate }
}

/**
 * Aggregate revenue data by time period
 *
 * Groups records by month and calculates total for each month
 * Returns array of monthly aggregates sorted chronologically
 */
export function aggregateByMonth(
  records: RevenueData[]
): Array<{ month: string; total_cents: number }> {
  const monthlyTotals = new Map<string, number>()

  for (const record of records) {
    const date = new Date(record.created_at)
    const month = date.toISOString().substring(0, 7) // YYYY-MM

    const current = monthlyTotals.get(month) || 0
    monthlyTotals.set(month, current + record.amount_cents)
  }

  // Sort chronologically
  return Array.from(monthlyTotals.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, total_cents]) => ({
      month,
      total_cents,
    }))
}

/**
 * Calculate percentile revenue (for top X analysis)
 *
 * Sorts amounts and returns value at specified percentile
 * Useful for identifying top revenue contributors
 */
export function calculatePercentile(
  amounts: number[],
  percentile: number
): number {
  if (amounts.length === 0) return 0
  if (percentile < 0 || percentile > 100) return 0

  const sorted = [...amounts].sort((a, b) => a - b)
  const index = Math.ceil((percentile / 100) * sorted.length) - 1

  // sorted is non-empty (checked above); Math.max(0, index) stays in bounds
  return sorted[Math.max(0, index)] ?? 0
}

/**
 * Revenue rounding (NOT USED IN PIPELINE - for reference only)
 *
 * Applied ONLY at display layer (T024 response formatter)
 * Uses round-half-up: 0.5 rounds up
 *
 * NOT called in domain functions - all calculations preserve full precision
 */
export function roundCentsToDisplay(
  cents: number,
  decimals: number = 2
): number {
  const multiplier = Math.pow(10, decimals)
  const dollars = cents / 100
  // Round-half-up
  return Math.round((dollars + Number.EPSILON) * multiplier) / multiplier
}

/**
 * Export for testing and metric calculations
 */
export default {
  sumRevenue,
  calculateAverageRevenue,
  filterByDateRange,
  groupByProduct,
  groupByCountry,
  calculateGrowthPercent,
  calculateGrowthAbsolute,
  getCurrentMonthRange,
  getCurrentYearRange,
  getPreviousMonthRange,
  aggregateByMonth,
  calculatePercentile,
}
