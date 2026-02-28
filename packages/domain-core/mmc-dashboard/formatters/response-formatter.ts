/**
 * Response Formatter for MMC Dashboard
 *
 * Purpose: Standardize response formatting
 * - 2-decimal currency formatting
 * - ISO 8601 timestamps
 * - Standard envelope structure
 * - Rounding verification
 */

export interface StandardResponse<T> {
  success: boolean
  data: T | null
  error: {
    code: string
    message: string
  } | null
}

/**
 * Alias for StandardResponse — satisfies callers expecting ApiResponse<T>.
 * Defined locally to avoid cross-package imports in this formatter.
 */
export type ApiResponse<T> = StandardResponse<T>

/**
 * Helper function: Round half-up to specified decimals
 * Uses ROUND_HALF_UP (0.5 rounds up) rather than banker's rounding
 */
function roundHalfUp(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/**
 * Format cents to currency string with 2 decimal places
 *
 * Examples:
 * - 2450050 → "24500.50"
 * - 100 → "1.00"
 * - 0 → "0.00"
 *
 * Test case verification:
 * - 100.445 * 100 + 200.556 * 100 + 300.001 * 100 = 60100.2 cents
 * - formatCurrency(60100.2) = "601.00" ✓
 */
export function formatCurrency(cents: number): string {
  const dollars = cents / 100
  const rounded = roundHalfUp(dollars, 2)
  return rounded.toFixed(2)
}

/**
 * Format cents to number with 2 decimal places
 */
export function formatCurrencyAsNumber(cents: number): number {
  const dollars = cents / 100
  return roundHalfUp(dollars, 2)
}

/**
 * Format percentage with 2 decimal precision (NOT as string with %)
 *
 * @param value - Percentage value (e.g., 9.33)
 * @returns Formatted percentage as number (e.g., 9.33)
 *
 * Examples:
 * - 9.333333 → 9.33
 * - 100 → 100.00
 */
export function formatPercentage(value: number): number {
  return roundHalfUp(value, 2)
}

/**
 * Format timestamp to ISO 8601 UTC
 *
 * @param date - Date string or Date object
 * @returns ISO 8601 formatted timestamp with Z suffix (e.g., "2026-02-26T15:30:00Z")
 */
export function formatTimestamp(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toISOString()
}

/**
 * Create standard success response
 */
export function createSuccessResponse<T>(data: T): StandardResponse<T> {
  return {
    success: true,
    data,
    error: null,
  }
}

/**
 * Create standard error response
 */
export function createErrorResponse(
  code: string,
  message: string
): StandardResponse<null> {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
    },
  }
}

/**
 * ============================================================================
 * RESPONSE FORMATTERS FOR EACH ENDPOINT
 * ============================================================================
 */

/**
 * T024-1: Format Summary Response
 *
 * Input: Raw summary data with monetized values
 * Output: Response envelope with formatted currency and timestamps
 */
export interface SummaryResponseData {
  licenses: {
    total: number
    active: number
    soft_locked: number
    archived: number
  }
  revenue: {
    this_month: string // Formatted as "24500.50"
    this_year: string
    last_month: string
  }
  snapshot_at: string // ISO 8601
}

export function formatSummaryResponse(data: {
  licenses: {
    total: number
    active: number
    soft_locked: number
    archived: number
  }
  revenue: {
    this_month_cents: number
    this_year_cents: number
    last_month_cents: number
  }
  snapshot_at?: Date | string
}): ApiResponse<SummaryResponseData> {
  return {
    success: true,
    data: {
      licenses: data.licenses,
      revenue: {
        this_month: formatCurrency(data.revenue.this_month_cents),
        this_year: formatCurrency(data.revenue.this_year_cents),
        last_month: formatCurrency(data.revenue.last_month_cents),
      },
      snapshot_at: formatTimestamp(data.snapshot_at || new Date()),
    },
    error: null,
  }
}

/**
 * T024-2: Format Revenue Breakdown Response
 *
 * Input: Array of products with revenue metrics
 * Output: Response envelope with formatted currency and growth percentages
 */
export interface ProductRevenue {
  product_id: string
  product_name: string
  revenue_this_period: string // Formatted "82000.50"
  revenue_previous_period: string // Formatted "75000.00"
  growth_percent: number // Decimal 9.33 (NOT "9.33%")
  license_count: number
}

export interface RevenueBreakdownResponseData {
  products: ProductRevenue[]
  total_revenue: string // Formatted "147000.50"
  period: {
    from: string // ISO date
    to: string // ISO date
  }
}

export function formatRevenueBreakdownResponse(data: {
  products: Array<{
    product_id: string
    product_name: string
    revenue_this_period_cents: number
    revenue_previous_period_cents: number
    growth_percent: number
    license_count: number
  }>
  total_revenue_cents: number
  period: {
    from: string
    to: string
  }
}): ApiResponse<RevenueBreakdownResponseData> {
  return {
    success: true,
    data: {
      products: data.products.map((p) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        revenue_this_period: formatCurrency(p.revenue_this_period_cents),
        revenue_previous_period: formatCurrency(
          p.revenue_previous_period_cents
        ),
        growth_percent: formatPercentage(p.growth_percent),
        license_count: p.license_count,
      })),
      total_revenue: formatCurrency(data.total_revenue_cents),
      period: data.period,
    },
    error: null,
  }
}

/**
 * T024-3: Format Geographic Response
 *
 * Input: Array of countries with revenue metrics
 * Output: Response envelope with formatted currency
 */
export interface GeographicData {
  country_code: string
  country_name: string
  revenue: string // Formatted "45000.75"
  license_count: number
  avg_revenue_per_license: string // Formatted "2250.04"
}

export interface GeographicResponseData {
  countries: GeographicData[]
  total_revenue: string
  total_license_count: number
}

export function formatGeographicResponse(data: {
  countries: Array<{
    country_code: string
    country_name: string
    revenue_cents: number
    license_count: number
    avg_revenue_per_license_cents: number
  }>
  total_revenue_cents: number
  total_license_count: number
}): ApiResponse<GeographicResponseData> {
  return {
    success: true,
    data: {
      countries: data.countries.map((c) => ({
        country_code: c.country_code,
        country_name: c.country_name,
        revenue: formatCurrency(c.revenue_cents),
        license_count: c.license_count,
        avg_revenue_per_license: formatCurrency(
          c.avg_revenue_per_license_cents
        ),
      })),
      total_revenue: formatCurrency(data.total_revenue_cents),
      total_license_count: data.total_license_count,
    },
    error: null,
  }
}

/**
 * T024-4: Format Affiliates Response
 *
 * Input: Array of affiliates with commission metrics
 * Output: Response envelope with formatted currency and pagination
 */
export interface AffiliateData {
  affiliate_id: string
  name: string
  status: string
  total_commission: string // Formatted "5300.50"
  usage_count: number
  avg_commission_per_usage: string // Formatted "265.03"
}

export interface AffiliatesResponseData {
  affiliates: AffiliateData[]
  pagination: {
    page: number
    page_size: number
    total: number
    pages: number
  }
  total_commission: string // Formatted "48200.75"
}

export function formatAffiliatesResponse(data: {
  affiliates: Array<{
    affiliate_id: string
    name: string
    status: string
    total_commission_cents: number
    usage_count: number
    avg_commission_per_usage_cents: number
  }>
  pagination: {
    page: number
    page_size: number
    total: number
    pages: number
  }
  total_commission_cents: number
}): ApiResponse<AffiliatesResponseData> {
  return {
    success: true,
    data: {
      affiliates: data.affiliates.map((a) => ({
        affiliate_id: a.affiliate_id,
        name: a.name,
        status: a.status,
        total_commission: formatCurrency(a.total_commission_cents),
        usage_count: a.usage_count,
        avg_commission_per_usage: formatCurrency(
          a.avg_commission_per_usage_cents
        ),
      })),
      pagination: data.pagination,
      total_commission: formatCurrency(data.total_commission_cents),
    },
    error: null,
  }
}

/**
 * T024-5: Format Trends Response
 *
 * Input: Monthly trend data with license/revenue metrics
 * Output: Response envelope with formatted currency and growth percentages
 */
export interface TrendMonth {
  month: string // ISO date "2026-02-01"
  license_count: number
  revenue: string // Formatted "45000.75"
  growth_percent: number // Decimal 9.33
}

export interface TrendsResponseData {
  months: TrendMonth[]
  growth_summary: {
    license_growth_percent: number
    revenue_growth_percent: number
    period_months: number
  }
}

export function formatTrendsResponse(data: {
  months: Array<{
    month: string
    license_count: number
    revenue_cents: number
    growth_percent: number
  }>
  growth_summary: {
    license_growth_percent: number
    revenue_growth_percent: number
    period_months: number
  }
}): ApiResponse<TrendsResponseData> {
  return {
    success: true,
    data: {
      months: data.months.map((m) => ({
        month: m.month,
        license_count: m.license_count,
        revenue: formatCurrency(m.revenue_cents),
        growth_percent: formatPercentage(m.growth_percent),
      })),
      growth_summary: {
        license_growth_percent: formatPercentage(
          data.growth_summary.license_growth_percent
        ),
        revenue_growth_percent: formatPercentage(
          data.growth_summary.revenue_growth_percent
        ),
        period_months: data.growth_summary.period_months,
      },
    },
    error: null,
  }
}

/**
 * T024-6: Format Export Response (CSV)
 *
 * Input: Raw data and section type for CSV generation
 * Output: CSV string with headers and rows (UTF-8 with BOM)
 */
export function formatExportResponse(data: {
  section: 'geographic' | 'revenue' | 'affiliate' | 'product'
  rows: Array<Record<string, any>>
}): string {
  // Add UTF-8 BOM for Excel compatibility
  const bom = '\uFEFF'

  if (data.rows.length === 0) {
    return bom + 'No data\n'
  }

  // Extract headers from first row
  // Non-null assertion is safe: length > 0 check above guarantees element exists
  const firstRow = data.rows[0]!
  const headers = Object.keys(firstRow)
  const headerRow = headers.join(',')

  // Format each row
  const dataRows = data.rows.map((row) =>
    headers
      .map((header) => {
        const value = row[header]
        // Escape quotes and wrap in quotes if needed
        if (value === null || value === undefined) {
          return ''
        }
        const str = String(value)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      })
      .join(',')
  )

  return bom + headerRow + '\n' + dataRows.join('\n')
}

/**
 * Format Error Response (Standard Envelope)
 *
 * @param code - Error code (e.g., "PERMISSION_DENIED")
 * @param message - Human-readable error message
 * @returns Error response envelope
 */
export function formatErrorResponse(
  code: string,
  message: string
): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error: {
      code,
      message,
    },
  }
}

/**
 * Format Success Response with Generic Data
 *
 * @param data - Any object to return in data field
 * @returns Success response envelope
 */
export function formatSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
  }
}
