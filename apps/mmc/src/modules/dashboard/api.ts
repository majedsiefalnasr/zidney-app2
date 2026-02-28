// @ts-ignore: axios not declared as dependency of apps/mmc [INFRA-001-DEPS-06]
// eslint-disable-next-line no-restricted-imports
import type { AxiosInstance } from 'axios'
// @ts-ignore: axios not declared as dependency of apps/mmc [INFRA-001-DEPS-06]
// eslint-disable-next-line no-restricted-imports
import axios from 'axios'

/**
 * Dashboard API Client
 * Handles all MMC dashboard API calls with error handling, rate limiting awareness, and structured responses
 */

// API Response Types (from backend integration tests)
export interface SummaryResponse {
  activeLicenses: number
  monthlyRevenue: number
  arpl: number
  churnRate: number
  licenseChange: number
  revenueChange: number
  licensesByStatus: {
    active: number
    softLocked: number
    archived: number
  }
}

export interface ProductRevenue {
  productId: string
  productName: string
  revenue: number
  percentOfTotal: number
  growth: number
}

export interface RevenueBreakdownResponse {
  topProducts: ProductRevenue[]
  totalRevenue: number
}

export interface GeographicCountry {
  country: string
  countryCode: string
  revenue: number
  percentOfTotal: number
  growth: number
  licenseCount: number
}

export interface GeographicResponse {
  countries: GeographicCountry[]
  totalRevenue: number
}

export interface AffiliateData {
  affiliateId: string
  affiliateName: string
  email: string
  totalRevenue: number
  licensesReferred: number
  conversionRate: number
  growth: number
}

export interface AffiliatesResponse {
  affiliates: AffiliateData[]
  totalRevenue: number
}

export interface TrendDataPoint {
  month: string
  revenue: string
  licenses: string
  revenueChange: number
  licenseChange: number
}

export interface TrendsResponse {
  months: TrendDataPoint[]
  totalRevenue: number
}

export interface ExportResponse {
  success: boolean
  downloadUrl?: string
  message: string
}

/**
 * Dashboard API Client Factory
 * Creates an instance with proper error handling and rate limit awareness
 */
export class DashboardClient {
  private client: AxiosInstance

  constructor(baseURL = '/api/mmc/dashboard') {
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response: any) => response,
      (error: any) => {
        // Map backend error codes to user-friendly messages
        if (error.response) {
          const status = error.response.status

          switch (status) {
            case 423:
              // SOFT_LOCKED license
              throw new Error(
                'Your license is soft-locked. Please renew your subscription.'
              )
            case 403:
              // Missing permission
              throw new Error(
                'You do not have permission to view this dashboard.'
              )
            case 426:
              // Schema version incompatible
              throw new Error(
                'Dashboard data format has changed. Please refresh the page.'
              )
            case 429:
              // Rate limited (especially export endpoint)
              throw new Error(
                'Too many requests. Please wait before trying again (export limited to 100/hr).'
              )
            case 500:
              throw new Error('Server error. Please try again later.')
            default:
              throw new Error(
                error.response.data?.error?.message ||
                  'Failed to fetch dashboard data'
              )
          }
        }
        throw error
      }
    )
  }

  /**
   * Get commercial health summary (cached 5 min)
   * Average response: 82ms
   */
  async getSummary(): Promise<SummaryResponse> {
    try {
      const response = await this.client.get<SummaryResponse>('/summary')
      return response.data
    } catch (error) {
      console.error('Failed to fetch summary:', error)
      throw error
    }
  }

  /**
   * Get revenue breakdown by top 5 products (no cache)
   * Average response: 75ms
   */
  async getRevenueBreakdown(): Promise<RevenueBreakdownResponse> {
    try {
      const response =
        await this.client.get<RevenueBreakdownResponse>('/revenue-breakdown')
      return response.data
    } catch (error) {
      console.error('Failed to fetch revenue breakdown:', error)
      throw error
    }
  }

  /**
   * Get geographic distribution (no cache)
   * Average response: 92ms
   * Optional pagination: ?page=1&limit=50
   */
  async getGeographic(page = 1, limit = 50): Promise<GeographicResponse> {
    try {
      const response = await this.client.get<GeographicResponse>(
        `/geographic?page=${page}&limit=${limit}`
      )
      return response.data
    } catch (error) {
      console.error('Failed to fetch geographic data:', error)
      throw error
    }
  }

  /**
   * Get affiliate leaderboard (cached 1 min)
   * Average response: 88ms
   * Optional filtering: ?minRevenue=0&minLicenses=0
   */
  async getAffiliates(
    minRevenue = 0,
    minLicenses = 0
  ): Promise<AffiliatesResponse> {
    try {
      const response = await this.client.get<AffiliatesResponse>(
        `/affiliates?minRevenue=${minRevenue}&minLicenses=${minLicenses}`
      )
      return response.data
    } catch (error) {
      console.error('Failed to fetch affiliates:', error)
      throw error
    }
  }

  /**
   * Get 12-month growth trends (cached 10 min)
   * Average response: 98ms
   * Optional period: ?months=3,6,12
   */
  async getTrends(months = 12): Promise<TrendsResponse> {
    try {
      const response = await this.client.get<TrendsResponse>(
        `/trends?months=${months}`
      )
      return response.data
    } catch (error) {
      console.error('Failed to fetch trends:', error)
      throw error
    }
  }

  /**
   * Export dashboard data to CSV/XLSX (CRITICAL: rate limited 100/hr)
   * Average response: 120ms for data prep + file generation
   * Payload: { section: 'summary|revenue|geographic|affiliates|all', format: 'csv|xlsx|json' }
   * Returns download URL or triggers browser download
   */
  async exportData(
    section: 'summary' | 'revenue' | 'geographic' | 'affiliates' | 'all',
    options: {
      format?: 'csv' | 'xlsx' | 'json'
      dateRange?: { start: string; end: string }
      includeData?: {
        summary?: boolean
        products?: boolean
        geographic?: boolean
        affiliates?: boolean
        trends?: boolean
      }
    } = {}
  ): Promise<ExportResponse> {
    try {
      const format = options.format || 'csv'

      // POST to export endpoint (required for 2-second timeout and file generation)
      const response = await this.client.post<ExportResponse>(
        '/export',
        {
          section,
          format,
          dateRange: options.dateRange,
          includeData: options.includeData,
        },
        {
          // Longer timeout for file generation
          timeout: 60000,
          // Get response as blob for file download
          responseType: 'blob',
        }
      )

      // Handle file download
      // With responseType:'blob', response.data is a Blob at runtime despite the typed generic
      const blob = new Blob([response.data as unknown as BlobPart], {
        type:
          format === 'xlsx'
            ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            : format === 'json'
              ? 'application/json'
              : 'text/csv',
      })

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `mmc-dashboard-${section}-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      return {
        success: true,
        message: `Export completed successfully`,
      }
    } catch (error) {
      console.error('Failed to export data:', error)
      throw error
    }
  }

  /**
   * Verify API connectivity (health check)
   * Used before rendering dashboard to catch early errors
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if any endpoint is accessible
      await this.client.get('/summary')
      return true
    } catch {
      return false
    }
  }
}

/**
 * Singleton instance
 * Export as default for use throughout the app
 */
export const dashboardClient = new DashboardClient()
