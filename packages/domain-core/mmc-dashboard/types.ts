/**
 * MMC Dashboard Domain Package - Type Definitions
 *
 * Purpose: Define all TypeScript interfaces and types for dashboard metrics,
 * query results, and API responses
 *
 * File: packages/domain-core/mmc-dashboard/types.ts
 * Task: T003
 * Phase: 0 - Setup & Preparation
 *
 * Constitutional Compliance:
 * ✓ Type-safe business logic (no implicit any)
 * ✓ Interfaces for all data structures
 * ✓ Monetary values as integers (cents, not decimals)
 * ✓ Timestamps as ISO 8601 strings
 *
 * Constraint Verification:
 * ✓ Monetary Format: amounts in cents (e.g., 10000 = $100.00)
 * ✓ Aggregate Rounding: rounding applied at formatter level, not here
 * ✓ Timestamp precision: ISO 8601 with timezone
 */

/**
 * ============================================================================
 * LICENSE DOMAIN TYPES
 * ============================================================================
 */

export type LicenseStatus = 'ACTIVE' | 'SOFT_LOCKED' | 'ARCHIVED'

export interface License {
  id: string
  product_id: string
  workspace_slug: string
  workspace_id: string
  status: LicenseStatus
  student_limit?: number
  staff_limit?: number
  soft_lock_until?: string // ISO 8601 date
  archived_at?: string // ISO 8601 date
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

export interface LicenseCount {
  status: LicenseStatus
  count: number
}

/**
 * ============================================================================
 * PRODUCT DOMAIN TYPES
 * ============================================================================
 */

export interface Product {
  id: string
  name: Record<string, string> // { en: 'Zidney Pro', ar: '...' }
  slug: string
  description?: string
  version: string
  enabled_modules: Record<string, boolean>
  created_at: string
  updated_at: string
}

/**
 * ============================================================================
 * REVENUE DOMAIN TYPES (cents precision)
 * ============================================================================
 */

export interface RevenueRecord {
  id: string
  license_id: string
  product_id: string
  workspace_id: string
  amount_cents: number // Integer cents, NOT decimal. 10000 = $100.00
  currency: string // ISO 4217 code (e.g., 'USD')
  billing_country?: string // ISO 3166-1 alpha-2 country code
  invoice_id?: string
  created_at: string
  updated_at: string
}

export interface RevenueSummary {
  total_revenue_cents: number // Full precision before formatting
  this_month_cents: number
  this_year_cents: number
  last_month_cents: number
  average_per_license_cents: number
}

export interface RevenueByProduct {
  product_id: string
  product_name: string
  total_revenue_cents: number
  license_count: number
  growth_percent: number // Calculated as (current - previous) / previous * 100
  growth_absolute_cents: number
}

export interface GeographicRevenue {
  country_code: string
  country_name: string
  total_revenue_cents: number
  license_count: number
  avg_revenue_per_license_cents: number
}

export interface RevenueTrend {
  period: string // YYYY-MM format for monthly aggregation
  revenue_cents: number
  license_count: number
  growth_rate_percent: number
}

/**
 * ============================================================================
 * AFFILIATE DOMAIN TYPES
 * ============================================================================
 */

export type AffiliateStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'

export interface Affiliate {
  id: string
  name: string
  email: string
  status: AffiliateStatus
  commission_rate: number // Decimal percentage (e.g., 0.15 for 15%)
  total_commission_cents: number
  created_at: string
  updated_at: string
}

export interface AffiliateUsage {
  id: string
  affiliate_id: string
  license_id?: string
  product_id?: string
  usage_type: string // 'REFERRAL', 'COMMISSION', etc.
  amount_cents: number
  created_at: string
}

export interface AffiliateLeader {
  affiliate_id: string
  affiliate_name: string
  total_commission_cents: number
  usage_count: number
  avg_commission_per_usage_cents: number
  status: AffiliateStatus
  rank: number
}

/**
 * ============================================================================
 * QUERY RESULT TYPES
 * ============================================================================
 */

export interface DashboardSummary {
  licenses: LicenseCount[]
  revenue: RevenueSummary
  top_products: RevenueByProduct[]
  cache_hit: boolean
  timestamp: string
}

export interface RevenueBreakdownResult {
  period: string // 'YYYY-MM'
  products: RevenueByProduct[]
  total_revenue_cents: number
  timestamp: string
}

export interface GeographicDistributionResult {
  countries: GeographicRevenue[]
  total_revenue_cents: number
  license_count: number
  timestamp: string
  page: number
  page_size: number
  total_countries: number
}

export interface AffiliateLeaderboardResult {
  affiliates: AffiliateLeader[]
  total_commission_cents: number
  timestamp: string
  page: number
  page_size: number
  total_affiliates: number
}

export interface TrendsResult {
  periods: RevenueTrend[]
  chart_data: {
    labels: string[] // Month labels
    revenue_series: number[] // Revenue in cents
    license_series: number[] // License counts
  }
  summary: {
    total_revenue_cents: number
    total_licenses: number
    avg_growth_percent: number
  }
  timestamp: string
}

export interface ExportData {
  section: 'geographic' | 'revenue' | 'affiliate' | 'product'
  row_count: number
  generated_at: string
  file_url?: string
}

/**
 * ============================================================================
 * API REQUEST/RESPONSE TYPES
 * ============================================================================
 */

export interface DashboardQueryParams {
  sort_by?: 'revenue' | 'license_count' | 'name'
  sort_order?: 'ASC' | 'DESC'
  limit?: number
  offset?: number
  page?: number
  page_size?: number
  date_from?: string // ISO 8601 date
  date_to?: string
  months?: 3 | 6 | 12
  status?: 'ACTIVE' | 'INACTIVE' | 'ALL'
}

export interface StandardAPIResponse<T> {
  success: boolean
  data: T | null
  error?: {
    code: string
    message: string
    details?: Record<string, unknown>
  } | null
}

export interface PaginatedResponse<T> {
  items: T[]
  page: number
  page_size: number
  total_items: number
  total_pages: number
}

/**
 * ============================================================================
 * ERROR TYPES
 * ============================================================================
 */

export class DashboardError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'DashboardError'
  }
}

export class PermissionDeniedError extends DashboardError {
  constructor(message = 'Permission denied: reporting.view required') {
    super('PERMISSION_DENIED', message, 403)
  }
}

export class LicenseLockedError extends DashboardError {
  constructor(message = 'License is locked or archived') {
    super('LICENSE_LOCKED', message, 423)
  }
}

export class SchemaIncompatibleError extends DashboardError {
  constructor(required: string, current: string) {
    super(
      'SCHEMA_INCOMPATIBLE',
      `Schema version ${current} incompatible with required version ${required}`,
      426
    )
  }
}

export class RateLimitExceededError extends DashboardError {
  constructor(public readonly retryAfter: number) {
    super('RATE_LIMIT_EXCEEDED', 'Too many requests', 429, { retryAfter })
  }
}

export class ExportSizeExceededError extends DashboardError {
  constructor(rowCount: number, maxRows: number) {
    super(
      'EXPORT_SIZE_EXCEEDED',
      `Export size (${rowCount} rows) exceeds maximum (${maxRows} rows)`,
      413,
      { rowCount, maxRows }
    )
  }
}

/**
 * ============================================================================
 * LOGGING CONTEXT TYPES
 * ============================================================================
 */

export interface DashboardLoggingContext {
  correlation_id: string
  user_id: string
  workspace_id: string
  workspace_slug: string
  endpoint: string
  method: 'GET' | 'POST'
  response_status: number
  response_time_ms: number
  cache_hit?: boolean
  error_code?: string
  query_params?: Record<string, unknown>
}

export interface DashboardMetrics {
  request_total: number
  request_duration_ms: number
  cache_hit_rate: number
  authorization_failures: number
  rate_limit_violations: number
}

export default {
  LicenseStatus,
  License,
  Product,
  RevenueRecord,
  RevenueSummary,
  Affiliate,
  AffiliateLeader,
  DashboardSummary,
  StandardAPIResponse,
  DashboardError,
}
