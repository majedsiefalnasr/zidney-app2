/**
 * Geographic Aggregation Functions for MMC Dashboard
 *
 * Purpose: Calculate revenue metrics grouped by country
 * - Group revenue by billing country
 * - Calculate average revenue per license per country
 * - Resolve country codes to names
 * - Handle pagination and sorting
 *
 * File: packages/domain-core/mmc-dashboard/metrics/geographic-aggregator.ts
 * Task: T011 [P]
 * Phase: 1 - Backend Implementation (parallel)
 *
 * Data Constraints:
 * - Country codes: ISO 3166-1 alpha-2 (US, GB, CA, etc.)
 * - Revenue amounts: integer cents
 * - License counts: positive integers
 */

/**
 * Country name mappings (ISO 3166-1)
 * Extends as needed, falls back to country_code if not found
 */
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  JP: 'Japan',
  IN: 'India',
  BR: 'Brazil',
  MX: 'Mexico',
  CN: 'China',
  RU: 'Russia',
  IT: 'Italy',
  ES: 'Spain',
  NL: 'Netherlands',
  SE: 'Sweden',
  CH: 'Switzerland',
  SG: 'Singapore',
  HK: 'Hong Kong',
  NZ: 'New Zealand',
  ZA: 'South Africa',
  KR: 'South Korea',
  NOR: 'Norway',
  DK: 'Denmark',
}

export interface GeographicMetrics {
  country_code: string
  total_revenue_cents: number
  license_count: number
}

export interface GeographicResult extends GeographicMetrics {
  country_name: string
  avg_revenue_per_license_cents: number
}

/**
 * Resolve country code to name
 *
 * Returns: Country name or code if not found
 */
export function getCountryName(countryCode: string): string {
  if (!countryCode) return 'Unknown'
  return COUNTRY_NAMES[countryCode] || countryCode
}

/**
 * Calculate average revenue per license for country
 *
 * Handles: Zero license count (returns 0)
 */
export function calculateAvgRevenuePerLicense(totalCents: number, licenseCount: number): number {
  if (licenseCount === 0) return 0
  return Math.floor(totalCents / licenseCount)
}

/**
 * Enrich geographic metrics with country names and calculations
 */
export function enrichGeographicMetrics(metrics: GeographicMetrics[]): GeographicResult[] {
  return metrics.map((m) => ({
    ...m,
    country_name: getCountryName(m.country_code),
    avg_revenue_per_license_cents: calculateAvgRevenuePerLicense(
      m.total_revenue_cents,
      m.license_count
    ),
  }))
}

/**
 * Sort geographic metrics
 *
 * Options: 'revenue' | 'license_count' | 'avg_revenue_per_license'
 */
export function sortGeographic(
  metrics: GeographicResult[],
  sortBy: 'revenue' | 'license_count' | 'avg_revenue_per_license' = 'revenue',
  sortOrder: 'ASC' | 'DESC' = 'DESC'
): GeographicResult[] {
  const sorted = [...metrics].sort((a, b) => {
    let aVal: number
    let bVal: number

    if (sortBy === 'revenue') {
      aVal = a.total_revenue_cents
      bVal = b.total_revenue_cents
    } else if (sortBy === 'license_count') {
      aVal = a.license_count
      bVal = b.license_count
    } else {
      // 'avg_revenue_per_license'
      aVal = a.avg_revenue_per_license_cents
      bVal = b.avg_revenue_per_license_cents
    }

    return sortOrder === 'DESC' ? bVal - aVal : aVal - bVal
  })

  return sorted
}

/**
 * Apply pagination to results
 */
export function paginate<T>(
  items: T[],
  page: number,
  pageSize: number
): { items: T[]; total: number; totalPages: number } {
  const total = items.length
  const totalPages = Math.ceil(total / pageSize)
  const offset = Math.max(0, (Math.max(1, page) - 1) * pageSize)

  return {
    items: items.slice(offset, offset + pageSize),
    total,
    totalPages: Math.max(1, totalPages),
  }
}

/**
 * Calculate geographic statistics
 */
export function getGeographicStatistics(metrics: GeographicResult[]) {
  if (metrics.length === 0) {
    return {
      total_countries: 0,
      total_revenue_cents: 0,
      total_licenses: 0,
      avg_revenue_per_country_cents: 0,
      top_country: null,
    }
  }

  const totalRevenue = metrics.reduce((sum, m) => sum + m.total_revenue_cents, 0)
  const totalLicenses = metrics.reduce((sum, m) => sum + m.license_count, 0)
  const avgPerCountry = Math.floor(totalRevenue / metrics.length)
  const topCountry = metrics.reduce((prev, current) =>
    current.total_revenue_cents > prev.total_revenue_cents ? current : prev
  )

  return {
    total_countries: metrics.length,
    total_revenue_cents: totalRevenue,
    total_licenses: totalLicenses,
    avg_revenue_per_country_cents: avgPerCountry,
    top_country: {
      code: topCountry.country_code,
      name: topCountry.country_name,
      revenue_cents: topCountry.total_revenue_cents,
    },
  }
}

/**
 * Get top N countries by revenue
 */
export function getTopCountries(
  metrics: GeographicResult[],
  limit: number = 10
): GeographicResult[] {
  const sorted = sortGeographic(metrics, 'revenue', 'DESC')
  return sorted.slice(0, limit)
}

export default {
  getCountryName,
  calculateAvgRevenuePerLicense,
  enrichGeographicMetrics,
  sortGeographic,
  paginate,
  getGeographicStatistics,
  getTopCountries,
}
