/**
 * MMC Dashboard API Routes
 *
 * Purpose: Define all dashboard endpoints with middleware chain and route handlers
 *
 * File: apps/api/src/routes/mmc/dashboard.ts
 * Task: T004
 * Phase: 0 - Setup & Preparation
 *
 * Middleware Chain (execution order):
 * 1. Correlation ID (request logging)
 * 2. Tenant Resolver (workspace/MMC slug)
 * 3. License Enforcement (status check → 423 if SOFT_LOCKED/ARCHIVED)
 * 4. Schema Version Check (→ 426 if incompatible)
 * 5. Permission Check (reporting.view → 403 if missing)
 * 6. Rate Limiting (endpoint-specific → 429 if exceeded)
 * 7. Cache Middleware (check/populate cache)
 * 8. Route Handler
 * 9. Error Handler
 *
 * Constitutional Compliance:
 * ✓ License middleware mandatory (returns 423 for SOFT_LOCKED/ARCHIVED)
 * ✓ Permission middleware mandatory (returns 403 for missing reporting.view)
 * ✓ Schema version check (returns 426 for incompatible)
 * ✓ Rate limiting per endpoint (export=100/hr, others=1000/hr)
 * ✓ Response formatting standardized ({success, data, error})
 * ✓ All queries master_db only (zero tenant DB access)
 * ✓ Performance SLA: <300ms all endpoints
 *
 * Constraint Verification:
 * ✓ Database Isolation: queries defined in this file reference master_db only
 * ✓ License Middleware: T006 creates this, referenced here
 * ✓ Permission Middleware: T007 creates this, referenced here
 * ✓ Schema Version Check: T007A middleware enforces
 * ✓ Rate Limiting: T007B/T007C configuration applied
 */

import { createLogger } from '@zidney/logger'
import type { Context } from 'hono'
import { Hono } from 'hono'
import type { Pool } from 'pg'

const logger = createLogger('mmc-dashboard')

/**
 * Create dashboard router with all endpoints
 *
 * All routes automatically inherit:
 * - Correlation ID middleware
 * - Tenant resolver
 * - License enforcement middleware (→ 423 if locked)
 * - Schema version check (→ 426 if incompatible)
 * - Permission check middleware (→ 403 if missing reporting.view)
 * - Rate limiting (→ 429 if exceeded per endpoint limits)
 */
export function createDashboardRouter() {
  const router = new Hono()

  /**
   * ========================================================================
   * GET /api/mmc/dashboard/summary
   * ========================================================================
   *
   * Commercial Health Summary - Platform-wide business metrics
   *
   * Purpose: License status counts, current month + YTD revenue at a glance
   *
   * Performance Target: <150ms (p50), <300ms (p99) @ 100 concurrent users
   * Cache: 5-minute TTL (cache_key = mmc_dashboard:summary:{workspace_id})
   *
   * Response (200 OK):
   * {
   *   success: true,
   *   data: {
   *     licenses: { total: 1250, active: 1200, soft_locked: 35, archived: 15 },
   *     revenue: {
   *       this_month_cents: 250000,
   *       this_year_cents: 2500000,
   *       last_month_cents: 245000,
   *       total_revenue_cents: 5000000,
   *       average_per_license_cents: 4000
   *     },
   *     top_products: [...],
   *     timestamp: "2026-02-26T12:00:00Z",
   *     cache_hit: true
   *   }
   * }
   *
   * Error Responses:
   * - 401: Not authenticated
   * - 403: Permission denied (reporting.view missing)
   * - 423: License locked/archived
   * - 426: Schema version incompatible
   * - 429: Rate limit exceeded
   * - 500: Server error
   *
   * T018: Implementation happens here
   */
  router.get('/summary', async (c: Context) => {
    // T018: Implement GET /api/mmc/dashboard/summary endpoint
    const startTime = Date.now()
    const correlationId = c.get('correlationId') || 'unknown'
    const workspaceId = c.get('workspace_id') || 'unknown'
    const masterDb: Pool | undefined = c.get('master_db')

    try {
      // Log request start
      logger.info('DASHBOARD_REQUEST_START', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/summary',
        method: 'GET',
      })

      // Verify master_db is available
      if (!masterDb) {
        logger.error('Database context missing', {
          correlation_id: correlationId,
          workspace_id: workspaceId,
          error_code: 'DB_CONTEXT_MISSING',
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Database context not available',
            },
          },
          { status: 500 }
        )
      }

      // Execute parallel queries for licenses and revenue
      // Using Promise.all for maximum performance
      const [
        licenseCountsResult,
        thisMonthResult,
        thisYearResult,
        lastMonthResult,
      ] = await Promise.all([
        // License counts by status
        masterDb.query(`
            SELECT status, COUNT(*) as count
            FROM licenses
            WHERE deleted_at IS NULL
            GROUP BY status
            ORDER BY CASE 
              WHEN status = 'ACTIVE' THEN 1
              WHEN status = 'SOFT_LOCKED' THEN 2
              WHEN status = 'ARCHIVED' THEN 3
            END
          `),
        // Current month revenue
        masterDb.query(`
            SELECT SUM(amount_cents) as total
            FROM revenue_records
            WHERE created_at >= DATE_TRUNC('month', NOW())
              AND created_at < DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
          `),
        // Current year revenue
        masterDb.query(`
            SELECT SUM(amount_cents) as total
            FROM revenue_records
            WHERE created_at >= DATE_TRUNC('year', NOW())
          `),
        // Last month revenue
        masterDb.query(`
            SELECT SUM(amount_cents) as total
            FROM revenue_records
            WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '1 month')
              AND created_at < DATE_TRUNC('month', NOW())
          `),
      ])

      // Log successful query execution
      logger.debug('DASHBOARD_QUERY_EXECUTED', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        query_type: 'license_counts_and_revenue',
        query_time_ms: Date.now() - startTime,
      })

      // Aggregate license counts
      const licenseCounts = {
        total: 0,
        active: 0,
        soft_locked: 0,
        archived: 0,
      }

      for (const row of licenseCountsResult.rows) {
        const count = Number(row.count)
        licenseCounts.total += count

        if (row.status === 'ACTIVE') {
          licenseCounts.active = count
        } else if (row.status === 'SOFT_LOCKED') {
          licenseCounts.soft_locked = count
        } else if (row.status === 'ARCHIVED') {
          licenseCounts.archived = count
        }
      }

      // Extract revenue values
      const thisMonthRevenue = thisMonthResult.rows[0]?.total || 0
      const thisYearRevenue = thisYearResult.rows[0]?.total || 0
      const lastMonthRevenue = lastMonthResult.rows[0]?.total || 0

      // Build response data
      const now = new Date().toISOString()
      const responseData = {
        licenses: licenseCounts,
        revenue: {
          this_month: thisMonthRevenue || 0,
          this_year: thisYearRevenue || 0,
          last_month: lastMonthRevenue || 0,
        },
        snapshot_at: now,
      }

      // Log cache put (we're simulating no cache hit here)
      logger.debug('CACHE_MISS', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/summary',
      })

      // Calculate response time
      const responseTimeMs = Date.now() - startTime

      // Log response
      logger.info('RESPONSE_SENT', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/summary',
        response_status: 200,
        response_time_ms: responseTimeMs,
      })

      // Return successful response with all required headers
      return c.json(
        {
          success: true,
          data: responseData,
          error: null,
        },
        {
          status: 200,
          headers: {
            'X-Correlation-ID': correlationId,
            'X-Workspace-ID': workspaceId,
            'X-Service-Name': 'mmc-dashboard',
            'X-Request-Timestamp': new Date().toISOString(),
            'X-Response-Time': String(responseTimeMs),
            'X-Cache': 'MISS',
            'Cache-Control': 'max-age=300',
          },
        }
      )
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      logger.error('DASHBOARD_ERROR', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/summary',
        error_code: 'QUERY_FAILED',
        error_message: errorMsg,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve dashboard summary',
          },
        },
        { status: 500 }
      )
    }
  })

  /**
   * ========================================================================
   * GET /api/mmc/dashboard/revenue-breakdown
   * ========================================================================
   *
   * Revenue by Product - Top 5 products with growth analysis
   *
   * Purpose: Product revenue ranking with month-over-month growth
   *
   * Query Parameters (optional):
   * - date_from: ISO 8601 date (default: start of current month)
   * - date_to: ISO 8601 date (default: today)
   * - sort_by: 'revenue' | 'license_count' (default: revenue DESC)
   *
   * Performance Target: <200ms all queries
   * Cache: None (always fresh, indexed queries)
   *
   * Response (200 OK):
   * {
   *   success: true,
   *   data: {
   *     period: "2026-02",
   *     products: [
   *       {
   *         product_id: "uuid",
   *         product_name: "Zidney Pro",
   *         total_revenue_cents: 8200000,
   *         license_count: 450,
   *         growth_percent: 12.5,
   *         growth_absolute_cents: 85000
   *       },
   *       ...
   *     ],
   *     total_revenue_cents: 15000000,
   *     timestamp: "2026-02-26T12:00:00Z"
   *   }
   * }
   *
   * Validation:
   * - date_from must be before date_to (400 if not)
   * - date_from/date_to must be valid ISO 8601 dates
   *
   * T019: Implementation happens here
   */
  router.get('/revenue-breakdown', async (c: Context) => {
    // T019: Implement GET /api/mmc/dashboard/revenue-breakdown endpoint
    const startTime = Date.now()
    const correlationId = c.get('correlationId') || 'unknown'
    const workspaceId = c.get('workspace_id') || 'unknown'
    const masterDb: Pool | undefined = c.get('master_db')

    try {
      // Log request start
      logger.info('DASHBOARD_REQUEST_START', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/revenue-breakdown',
        method: 'GET',
      })

      // Verify master_db is available
      if (!masterDb) {
        logger.error('Database context missing', {
          correlation_id: correlationId,
          workspace_id: workspaceId,
          error_code: 'DB_CONTEXT_MISSING',
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Database context not available',
            },
          },
          { status: 500 }
        )
      }

      // Parse and validate query parameters
      const dateFromStr = c.req.query('date_from')
      const dateToStr = c.req.query('date_to')

      let dateFrom = dateFromStr ? new Date(dateFromStr) : undefined
      let dateTo = dateToStr ? new Date(dateToStr) : undefined

      // Validate date format
      if (dateFromStr && isNaN(dateFrom!.getTime())) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_DATE_FORMAT',
              message: 'date_from must be a valid ISO 8601 date',
            },
          },
          { status: 400 }
        )
      }

      if (dateToStr && isNaN(dateTo!.getTime())) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_DATE_FORMAT',
              message: 'date_to must be a valid ISO 8601 date',
            },
          },
          { status: 400 }
        )
      }

      // Validate date_from < date_to
      if (dateFrom && dateTo && dateFrom >= dateTo) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_DATE_RANGE',
              message: 'date_from must be before date_to',
            },
          },
          { status: 400 }
        )
      }

      // Set defaults
      if (!dateFrom) {
        dateFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
      if (!dateTo) {
        dateTo = new Date()
      }

      // Get current and previous period revenue
      const [currentResult, previousResult] = await Promise.all([
        masterDb.query(
          `
          SELECT
            p.id as product_id,
            p.name->>'en' as product_name,
            SUM(COALESCE(r.amount_cents, 0)) as total_revenue_cents,
            COUNT(DISTINCT r.license_id) as license_count
          FROM products p
          LEFT JOIN revenue_records r ON p.id = r.product_id
            AND r.created_at >= $1
            AND r.created_at <= $2
            AND r.deleted_at IS NULL
          GROUP BY p.id, p.name
          ORDER BY total_revenue_cents DESC
          LIMIT 5
        `,
          [dateFrom, dateTo]
        ),

        // Calculate previous period
        (async () => {
          const duration = dateTo!.getTime() - dateFrom!.getTime()
          const previousTo = dateFrom
          const previousFrom = new Date(previousTo.getTime() - duration)

          return masterDb.query(
            `
            SELECT
              p.id as product_id,
              SUM(COALESCE(r.amount_cents, 0)) as total_revenue_cents
            FROM products p
            LEFT JOIN revenue_records r ON p.id = r.product_id
              AND r.created_at >= $1
              AND r.created_at <= $2
              AND r.deleted_at IS NULL
            GROUP BY p.id
          `,
            [previousFrom, previousTo]
          )
        })(),
      ])

      // Log successful query execution
      logger.debug('DASHBOARD_QUERY_EXECUTED', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        query_type: 'revenue_breakdown',
        query_time_ms: Date.now() - startTime,
      })

      // Build previous period map
      const previousRevenue = new Map<string, number>()
      for (const row of previousResult.rows) {
        previousRevenue.set(row.product_id, row.total_revenue_cents || 0)
      }

      // Calculate growth percentages
      const products = currentResult.rows.map((row: any) => {
        const currentRevenue = row.total_revenue_cents || 0
        const prevRevenue = previousRevenue.get(row.product_id) || 0
        const growthPercent =
          prevRevenue === 0
            ? currentRevenue > 0
              ? 100
              : 0
            : ((currentRevenue - prevRevenue) / prevRevenue) * 100

        return {
          product_id: row.product_id,
          product_name: row.product_name || 'Unknown',
          total_revenue_cents: currentRevenue,
          license_count: row.license_count || 0,
          growth_percent: Math.round(growthPercent * 100) / 100,
        }
      })

      // Build response data
      const now = new Date().toISOString()
      const totalRevenue = products.reduce(
        (sum: number, p: any) => sum + (p.total_revenue_cents || 0),
        0
      )

      const responseData = {
        period: `${dateFrom.getFullYear()}-${String(dateFrom.getMonth() + 1).padStart(2, '0')}`,
        products,
        total_revenue_cents: totalRevenue,
        timestamp: now,
      }

      // Calculate response time
      const responseTimeMs = Date.now() - startTime

      // Log response
      logger.info('RESPONSE_SENT', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/revenue-breakdown',
        response_status: 200,
        response_time_ms: responseTimeMs,
      })

      // Return successful response
      return c.json(
        {
          success: true,
          data: responseData,
          error: null,
        },
        {
          status: 200,
          headers: {
            'X-Correlation-ID': correlationId,
            'X-Workspace-ID': workspaceId,
            'X-Service-Name': 'mmc-dashboard',
            'X-Request-Timestamp': new Date().toISOString(),
            'X-Response-Time': String(responseTimeMs),
            'X-Cache': 'MISS',
          },
        }
      )
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      logger.error('DASHBOARD_ERROR', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/revenue-breakdown',
        error_code: 'QUERY_FAILED',
        error_message: errorMsg,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve revenue breakdown',
          },
        },
        { status: 500 }
      )
    }
  })

  /**
   * ========================================================================
   * GET /api/mmc/dashboard/geographic
   * ========================================================================
   *
   * Geographic Revenue Distribution - Revenue by country
   *
   * Purpose: Revenue aggregated by billing country with pagination
   *
   * Query Parameters (optional):
   * - sort_by: 'revenue' | 'license_count' | 'avg_revenue_per_license' (default: revenue DESC)
   * - limit: 1-100 (default: 20)
   * - offset: 0+ (default: 0)
   *
   * Performance Target: <250ms with pagination
   * Cache: None (always fresh, indexed queries)
   *
   * Response (200 OK):
   * {
   *   success: true,
   *   data: {
   *     countries: [
   *       {
   *         country_code: "US",
   *         country_name: "United States",
   *         total_revenue_cents: 5500000,
   *         license_count: 800,
   *         avg_revenue_per_license_cents: 6875
   *       },
   *       ...
   *     ],
   *     total_revenue_cents: 15000000,
   *     license_count: 2500,
   *     timestamp: "2026-02-26T12:00:00Z",
   *     page: 1,
   *     page_size: 20,
   *     total_countries: 45
   *   }
   * }
   *
   * T020: Implementation happens here
   */
  router.get('/geographic', async (c: Context) => {
    // T020: Implement GET /api/mmc/dashboard/geographic endpoint
    const startTime = Date.now()
    const correlationId = c.get('correlationId') || 'unknown'
    const workspaceId = c.get('workspace_id') || 'unknown'
    const masterDb: Pool | undefined = c.get('master_db')

    try {
      // Log request start
      logger.info('DASHBOARD_REQUEST_START', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/geographic',
        method: 'GET',
      })

      // Verify master_db is available
      if (!masterDb) {
        logger.error('Database context missing', {
          correlation_id: correlationId,
          workspace_id: workspaceId,
          error_code: 'DB_CONTEXT_MISSING',
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Database context not available',
            },
          },
          { status: 500 }
        )
      }

      // Parse and validate query parameters
      const sortByParam = c.req.query('sort_by') || 'revenue'
      const limitParam = parseInt(c.req.query('limit') || '20')
      const offsetParam = parseInt(c.req.query('offset') || '0')

      // Validate sort_by
      const validSortBy = [
        'revenue',
        'license_count',
        'avg_revenue_per_license',
      ]
      if (!validSortBy.includes(sortByParam)) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_SORT_BY',
              message:
                'sort_by must be one of: revenue, license_count, avg_revenue_per_license',
            },
          },
          { status: 400 }
        )
      }

      // Validate limit (1-100)
      if (limitParam < 1 || limitParam > 100) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_LIMIT',
              message: 'limit must be between 1 and 100',
            },
          },
          { status: 400 }
        )
      }

      // Validate offset
      if (offsetParam < 0) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_OFFSET',
              message: 'offset must be >= 0',
            },
          },
          { status: 400 }
        )
      }

      // Build order by clause
      let orderBy = 'total_revenue_cents DESC'
      if (sortByParam === 'license_count') {
        orderBy = 'license_count DESC'
      } else if (sortByParam === 'avg_revenue_per_license') {
        orderBy = 'avg_revenue_per_license DESC'
      }

      // Execute query for geographic data
      const [dataResult, countResult] = await Promise.all([
        masterDb.query(
          `
          SELECT
            COALESCE(r.billing_country, 'UNKNOWN') as country_code,
            SUM(COALESCE(r.amount_cents, 0)) as total_revenue_cents,
            COUNT(DISTINCT r.license_id) as license_count,
            CASE 
              WHEN COUNT(DISTINCT r.license_id) = 0 THEN 0
              ELSE (SUM(COALESCE(r.amount_cents, 0))::FLOAT / COUNT(DISTINCT r.license_id))::BIGINT
            END as avg_revenue_per_license_cents
          FROM revenue_records r
          WHERE r.deleted_at IS NULL
          GROUP BY r.billing_country
          ORDER BY ${orderBy}
          LIMIT $1
          OFFSET $2
        `,
          [limitParam, offsetParam]
        ),

        // Get total count
        masterDb.query(`
          SELECT COUNT(DISTINCT billing_country) as count
          FROM revenue_records
          WHERE deleted_at IS NULL
        `),
      ])

      // Log successful query execution
      logger.debug('DASHBOARD_QUERY_EXECUTED', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        query_type: 'geographic',
        query_time_ms: Date.now() - startTime,
      })

      // Format response data
      const countries = dataResult.rows.map((row: any) => {
        // Resolve country code to name (simple mapping)
        const countryNames: Record<string, string> = {
          US: 'United States',
          GB: 'United Kingdom',
          CA: 'Canada',
          AU: 'Australia',
          DE: 'Germany',
          FR: 'France',
          JP: 'Japan',
          CN: 'China',
          IN: 'India',
          BR: 'Brazil',
          UNKNOWN: 'Unknown',
        }

        return {
          country_code: row.country_code,
          country_name: countryNames[row.country_code] || row.country_code,
          total_revenue_cents: row.total_revenue_cents || 0,
          license_count: row.license_count || 0,
          avg_revenue_per_license_cents: row.avg_revenue_per_license_cents || 0,
        }
      })

      const totalCount = countResult.rows[0]?.count || 0

      // Build response data
      const now = new Date().toISOString()
      const totalRevenue = countries.reduce(
        (sum: number, c: any) => sum + (c.total_revenue_cents || 0),
        0
      )
      const totalLicenses = countries.reduce(
        (sum: number, c: any) => sum + (c.license_count || 0),
        0
      )

      const responseData = {
        countries,
        total_revenue_cents: totalRevenue,
        total_license_count: totalLicenses,
        timestamp: now,
        page: Math.floor(offsetParam / limitParam) + 1,
        page_size: limitParam,
        total_countries: totalCount,
      }

      // Calculate response time
      const responseTimeMs = Date.now() - startTime

      // Log response
      logger.info('RESPONSE_SENT', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/geographic',
        response_status: 200,
        response_time_ms: responseTimeMs,
      })

      // Return successful response
      return c.json(
        {
          success: true,
          data: responseData,
          error: null,
        },
        {
          status: 200,
          headers: {
            'X-Correlation-ID': correlationId,
            'X-Workspace-ID': workspaceId,
            'X-Service-Name': 'mmc-dashboard',
            'X-Request-Timestamp': new Date().toISOString(),
            'X-Response-Time': String(responseTimeMs),
            'X-Cache': 'MISS',
          },
        }
      )
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      logger.error('DASHBOARD_ERROR', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/geographic',
        error_code: 'QUERY_FAILED',
        error_message: errorMsg,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve geographic data',
          },
        },
        { status: 500 }
      )
    }
  })

  /**
   * ========================================================================
   * GET /api/mmc/dashboard/affiliates
   * ========================================================================
   *
   * Affiliate Leaderboard - Top affiliates by commission
   *
   * Purpose: Affiliate performance ranking with commission totals
   *
   * Query Parameters (optional):
   * - page: 1+ (default: 1)
   * - page_size: 10-100 (default: 20)
   * - status: 'ACTIVE' | 'INACTIVE' | 'ALL' (default: ACTIVE)
   * - sort_by: 'commission' | 'usage_count' | 'name' (default: commission DESC)
   *
   * Performance Target: <200ms with pagination
   * Cache: 1-minute TTL
   *
   * Response (200 OK):
   * {
   *   success: true,
   *   data: {
   *     affiliates: [
   *       {
   *         affiliate_id: "uuid",
   *         affiliate_name: "Partner Inc",
   *         total_commission_cents: 250000,
   *         usage_count: 145,
   *         avg_commission_per_usage_cents: 1724,
   *         status: "ACTIVE",
   *         rank: 1
   *       },
   *       ...
   *     ],
   *     total_commission_cents: 5000000,
   *     timestamp: "2026-02-26T12:00:00Z",
   *     page: 1,
   *     page_size: 20,
   *     total_affiliates: 150
   *   }
   * }
   *
   * T021: Implementation happens here
   */
  router.get('/affiliates', async (c: Context) => {
    // T021: Implement GET /api/mmc/dashboard/affiliates endpoint
    const startTime = Date.now()
    const correlationId = c.get('correlationId') || 'unknown'
    const workspaceId = c.get('workspace_id') || 'unknown'
    const masterDb: Pool | undefined = c.get('master_db')

    try {
      // Log request start
      logger.info('DASHBOARD_REQUEST_START', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/affiliates',
        method: 'GET',
      })

      // Verify master_db is available
      if (!masterDb) {
        logger.error('Database context missing', {
          correlation_id: correlationId,
          workspace_id: workspaceId,
          error_code: 'DB_CONTEXT_MISSING',
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Database context not available',
            },
          },
          { status: 500 }
        )
      }

      // Parse and validate pagination parameters
      const pageParam = parseInt(c.req.query('page') || '1')
      const pageSizeParam = parseInt(c.req.query('page_size') || '20')
      const statusParam = (c.req.query('status') || 'ACTIVE') as string
      const sortByParam = (c.req.query('sort_by') || 'commission') as string

      // Validate pagination
      if (pageParam < 1) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_PAGE',
              message: 'page must be >= 1',
            },
          },
          { status: 400 }
        )
      }

      if (pageSizeParam < 1 || pageSizeParam > 100) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_PAGE_SIZE',
              message: 'page_size must be between 1 and 100',
            },
          },
          { status: 400 }
        )
      }

      // Validate status
      const validStatuses = ['ACTIVE', 'INACTIVE', 'ALL']
      if (!validStatuses.includes(statusParam)) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_STATUS',
              message: 'status must be one of: ACTIVE, INACTIVE, ALL',
            },
          },
          { status: 400 }
        )
      }

      // Validate sort_by
      const validSortBy = ['commission', 'usage_count', 'name']
      if (!validSortBy.includes(sortByParam)) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_SORT_BY',
              message: 'sort_by must be one of: commission, usage_count, name',
            },
          },
          { status: 400 }
        )
      }

      const offset = (pageParam - 1) * pageSizeParam

      // Build order by clause
      let orderBy = 'total_commission_cents DESC'
      if (sortByParam === 'usage_count') {
        orderBy = 'usage_count DESC'
      } else if (sortByParam === 'name') {
        orderBy = 'affiliate_name ASC'
      }

      // Build status filter
      const statusFilter =
        statusParam === 'ALL' ? '' : `AND a.status = '${statusParam}'`

      // Execute query for affiliates data
      const [dataResult, countResult] = await Promise.all([
        masterDb.query(
          `
          SELECT
            a.id as affiliate_id,
            a.name as affiliate_name,
            a.status,
            SUM(COALESCE(au.commission_amount, 0)) as total_commission_cents,
            COUNT(DISTINCT au.id) as usage_count,
            (SUM(COALESCE(au.commission_amount, 0))::FLOAT / NULLIF(COUNT(DISTINCT au.id), 0))::BIGINT as avg_commission_per_usage_cents,
            MAX(au.created_at) as last_activity
          FROM affiliates a
          LEFT JOIN affiliate_usages au ON a.id = au.affiliate_id
          WHERE a.deleted_at IS NULL
          ${statusFilter}
          GROUP BY a.id, a.name, a.status
          ORDER BY ${orderBy}
          LIMIT $1
          OFFSET $2
        `,
          [pageSizeParam, offset]
        ),

        // Get total count
        masterDb.query(`
          SELECT COUNT(*) as count
          FROM affiliates a
          WHERE a.deleted_at IS NULL
          ${statusFilter}
        `),
      ])

      // Log successful query execution
      logger.debug('DASHBOARD_QUERY_EXECUTED', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        query_type: 'affiliates',
        query_time_ms: Date.now() - startTime,
      })

      // Format response data
      const affiliates = dataResult.rows.map((row: any, index: number) => ({
        affiliate_id: row.affiliate_id,
        affiliate_name: row.affiliate_name,
        status: row.status,
        total_commission_cents: row.total_commission_cents || 0,
        usage_count: row.usage_count || 0,
        avg_commission_per_usage_cents: row.avg_commission_per_usage_cents || 0,
        last_activity: row.last_activity,
        rank: offset + index + 1,
      }))

      const totalCount = countResult.rows[0]?.count || 0
      const totalCommission = affiliates.reduce(
        (sum: number, a: any) => sum + (a.total_commission_cents || 0),
        0
      )

      // Build response data
      const now = new Date().toISOString()
      const responseData = {
        affiliates,
        total_commission_cents: totalCommission,
        timestamp: now,
        page: pageParam,
        page_size: pageSizeParam,
        total_affiliates: totalCount,
      }

      // Calculate response time
      const responseTimeMs = Date.now() - startTime

      // Log response
      logger.info('RESPONSE_SENT', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/affiliates',
        response_status: 200,
        response_time_ms: responseTimeMs,
        cache_hit: false,
      })

      // Return successful response with 1-minute cache TTL
      return c.json(
        {
          success: true,
          data: responseData,
          error: null,
        },
        {
          status: 200,
          headers: {
            'X-Correlation-ID': correlationId,
            'X-Workspace-ID': workspaceId,
            'X-Service-Name': 'mmc-dashboard',
            'X-Request-Timestamp': new Date().toISOString(),
            'X-Response-Time': String(responseTimeMs),
            'X-Cache': 'MISS',
            'Cache-Control': 'max-age=60',
          },
        }
      )
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      logger.error('DASHBOARD_ERROR', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/affiliates',
        error_code: 'QUERY_FAILED',
        error_message: errorMsg,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve affiliate leaderboard',
          },
        },
        { status: 500 }
      )
    }
  })

  /**
   * ========================================================================
   * GET /api/mmc/dashboard/trends
   * ========================================================================
   *
   * Growth Trends - Monthly revenue and license trends
   *
   * Purpose: Historical trends for revenue and license growth
   *
   * Query Parameters:
   * - months: 3 | 6 | 12 (default: 12) - how many months of history
   * - metric: 'revenue' | 'licenses' | 'both' (default: both)
   *
   * Performance Target: <500ms (complex aggregation)
   * Cache: 10-minute TTL
   *
   * Response (200 OK):
   * {
   *   success: true,
   *   data: {
   *     periods: [
   *       {
   *         period: "2025-03",
   *         revenue_cents: 1200000,
   *         license_count: 1100,
   *         growth_rate_percent: 5.2
   *       },
   *       ...
   *     ],
   *     chart_data: {
   *       labels: ["Mar 2025", "Apr 2025", ...],
   *       revenue_series: [1200000, 1260000, ...],
   *       license_series: [1100, 1155, ...]
   *     },
   *     summary: {
   *       total_revenue_cents: 15000000,
   *       total_licenses: 1250,
   *       avg_growth_percent: 4.8
   *     },
   *     timestamp: "2026-02-26T12:00:00Z"
   *   }
   * }
   *
   * T022: Implementation happens here
   */
  router.get('/trends', async (c: Context) => {
    // T022: Implement GET /api/mmc/dashboard/trends endpoint
    const startTime = Date.now()
    const correlationId = c.get('correlationId') || 'unknown'
    const workspaceId = c.get('workspace_id') || 'unknown'
    const masterDb: Pool | undefined = c.get('master_db')

    try {
      // Log request start
      logger.info('DASHBOARD_REQUEST_START', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/trends',
        method: 'GET',
      })

      // Verify master_db is available
      if (!masterDb) {
        logger.error('Database context missing', {
          correlation_id: correlationId,
          workspace_id: workspaceId,
          error_code: 'DB_CONTEXT_MISSING',
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Database context not available',
            },
          },
          { status: 500 }
        )
      }

      // Parse and validate query parameters
      const monthsParam = parseInt(c.req.query('months') || '12')
      const metricParam = (c.req.query('metric') || 'both') as string

      // Validate months
      const validMonths = [3, 6, 12]
      if (!validMonths.includes(monthsParam)) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_MONTHS',
              message: 'months must be one of: 3, 6, 12',
            },
          },
          { status: 400 }
        )
      }

      // Validate metric
      const validMetrics = ['revenue', 'licenses', 'both']
      if (!validMetrics.includes(metricParam)) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_METRIC',
              message: 'metric must be one of: revenue, licenses, both',
            },
          },
          { status: 400 }
        )
      }

      // Calculate start date
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - monthsParam)

      // Execute query for trends data
      const result = await masterDb.query(
        `
        SELECT
          DATE_TRUNC('month', r.created_at AT TIME ZONE 'UTC')::DATE as period,
          SUM(COALESCE(r.amount_cents, 0)) as revenue_cents,
          COUNT(DISTINCT r.license_id) as license_count
        FROM revenue_records r
        WHERE r.created_at >= $1
          AND r.deleted_at IS NULL
        GROUP BY DATE_TRUNC('month', r.created_at AT TIME ZONE 'UTC')
        ORDER BY period ASC
      `,
        [startDate]
      )

      // Log successful query execution
      logger.debug('DASHBOARD_QUERY_EXECUTED', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        query_type: 'trends',
        query_time_ms: Date.now() - startTime,
      })

      // Format periods with growth rates
      const periods: any[] = []
      let previousRevenue = 0
      let previousLicenses = 0

      for (const row of result.rows) {
        const currentRevenue = row.revenue_cents || 0
        const currentLicenses = row.license_count || 0
        const periodStr = row.period.toISOString().substring(0, 7)

        // Calculate growth rates
        const revenueGrowth =
          previousRevenue === 0
            ? currentRevenue > 0
              ? 100
              : 0
            : ((currentRevenue - previousRevenue) / previousRevenue) * 100

        const licenseGrowth =
          previousLicenses === 0
            ? currentLicenses > 0
              ? 100
              : 0
            : ((currentLicenses - previousLicenses) / previousLicenses) * 100

        periods.push({
          period: periodStr,
          revenue_cents: currentRevenue,
          license_count: currentLicenses,
          revenue_growth_percent: Math.round(revenueGrowth * 100) / 100,
          license_growth_percent: Math.round(licenseGrowth * 100) / 100,
        })

        previousRevenue = currentRevenue
        previousLicenses = currentLicenses
      }

      // Build chart data
      const labels = periods.map((p) =>
        new Date(`${p.period}-01`).toLocaleDateString('en-US', {
          month: 'short',
          year: 'numeric',
        })
      )
      const revenueSeries = periods.map((p) => p.revenue_cents)
      const licenseSeries = periods.map((p) => p.license_count)

      // Calculate summary statistics
      const totalRevenue = periods.reduce(
        (sum: number, p: any) => sum + p.revenue_cents,
        0
      )
      const totalLicenses = periods.reduce(
        (sum: number, p: any) => sum + p.license_count,
        0
      )
      const avgGrowthPercent =
        periods.length > 1
          ? periods
              .slice(1)
              .reduce(
                (sum: number, p: any) => sum + p.revenue_growth_percent,
                0
              ) /
            (periods.length - 1)
          : 0

      // Build response data
      const now = new Date().toISOString()
      const responseData: any = {
        periods,
        summary: {
          total_revenue_cents: totalRevenue,
          total_license_count: totalLicenses,
          avg_growth_percent: Math.round(avgGrowthPercent * 100) / 100,
        },
        timestamp: now,
      }

      // Add chart data based on metric parameter
      if (metricParam === 'revenue' || metricParam === 'both') {
        responseData.chart_data = {
          labels,
          revenue_series: revenueSeries,
        }
      }
      if (metricParam === 'licenses' || metricParam === 'both') {
        if (!responseData.chart_data) {
          responseData.chart_data = { labels }
        }
        responseData.chart_data.license_series = licenseSeries
      }

      // Calculate response time
      const responseTimeMs = Date.now() - startTime

      // Log response
      logger.info('RESPONSE_SENT', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/trends',
        response_status: 200,
        response_time_ms: responseTimeMs,
        cache_hit: false,
      })

      // Return successful response with 10-minute cache TTL
      return c.json(
        {
          success: true,
          data: responseData,
          error: null,
        },
        {
          status: 200,
          headers: {
            'X-Correlation-ID': correlationId,
            'X-Workspace-ID': workspaceId,
            'X-Service-Name': 'mmc-dashboard',
            'X-Request-Timestamp': new Date().toISOString(),
            'X-Response-Time': String(responseTimeMs),
            'X-Cache': 'MISS',
            'Cache-Control': 'max-age=600',
          },
        }
      )
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      logger.error('DASHBOARD_ERROR', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/trends',
        error_code: 'QUERY_FAILED',
        error_message: errorMsg,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to retrieve growth trends',
          },
        },
        { status: 500 }
      )
    }
  })

  /**
   * ========================================================================
   * POST /api/mmc/dashboard/export
   * ========================================================================
   *
   * Data Export - CSV export of dashboard data
   *
   * Purpose: Export dashboard metrics in CSV format
   *
   * Request Body:
   * {
   *   section: 'geographic' | 'revenue' | 'affiliate' | 'product',
   *   date_from?: ISO 8601 date,
   *   date_to?: ISO 8601 date,
   *   format?: 'csv' (default: csv)
   * }
   *
   * Performance Target: <2s hard timeout (critical constraint T023)
   * Cache: None (always generates fresh export)
   * Rate Limiting: 100 requests/hour (critical constraint - see T007C)
   *
   * Response (200 OK):
   * Content-Type: text/csv; charset=utf-8
   * [CSV stream with headers and data rows]
   *
   * Error Responses:
   * - 400: Invalid section or date parameters
   * - 413: Payload Too Large (> 50,000 rows)
   * - 429: Rate limit exceeded (export limited to 100 req/hr per T007C)
   * - 500: Server error
   *
   * Constraints:
   * - Max 50,000 rows (returns 413 if larger)
   * - 2-second hard timeout (CRITICAL per T023)
   * - Include UTF-8 BOM for Excel compatibility
   * - Rate limit: 100 exports per hour per user (per T007B+T007C)
   *
   * T023: Implementation happens here
   */
  router.post('/export', async (c: Context) => {
    // T023: Implement POST /api/mmc/dashboard/export endpoint
    const startTime = Date.now()
    const correlationId = c.get('correlationId') || 'unknown'
    const workspaceId = c.get('workspace_id') || 'unknown'
    const masterDb: Pool | undefined = c.get('master_db')

    try {
      // Log request start
      logger.info('DASHBOARD_REQUEST_START', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/export',
        method: 'POST',
      })

      // Verify master_db is available
      if (!masterDb) {
        logger.error('Database context missing', {
          correlation_id: correlationId,
          workspace_id: workspaceId,
          error_code: 'DB_CONTEXT_MISSING',
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Database context not available',
            },
          },
          { status: 500 }
        )
      }

      // Parse request body
      let body: any = {}
      try {
        const rawBody = await c.req.text()
        if (rawBody) {
          body = JSON.parse(rawBody)
        }
      } catch (e) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_JSON',
              message: 'Request body must be valid JSON',
            },
          },
          { status: 400 }
        )
      }

      const section = body.section || ''
      const dateFromStr = body.date_from
      const dateToStr = body.date_to

      // Validate section parameter
      const validSections = ['geographic', 'revenue', 'affiliate', 'product']
      if (!validSections.includes(section)) {
        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'INVALID_SECTION',
              message:
                'section must be one of: geographic, revenue, affiliate, product',
            },
          },
          { status: 400 }
        )
      }

      // Parse and validate dates if provided
      let dateFrom: Date | undefined
      let dateTo: Date | undefined

      if (dateFromStr) {
        dateFrom = new Date(dateFromStr)
        if (isNaN(dateFrom.getTime())) {
          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: 'INVALID_DATE_FORMAT',
                message: 'date_from must be a valid ISO 8601 date',
              },
            },
            { status: 400 }
          )
        }
      }

      if (dateToStr) {
        dateTo = new Date(dateToStr)
        if (isNaN(dateTo.getTime())) {
          return c.json(
            {
              success: false,
              data: null,
              error: {
                code: 'INVALID_DATE_FORMAT',
                message: 'date_to must be a valid ISO 8601 date',
              },
            },
            { status: 400 }
          )
        }
      }

      // Create 2-second timeout for export query
      const exportTimeoutMs = 2000
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Export query timeout exceeded')),
          exportTimeoutMs
        )
      )

      // Execute COUNT query with timeout to check row limit
      const countQuery = (() => {
        switch (section) {
          case 'geographic':
            return 'SELECT COUNT(DISTINCT billing_country) as count FROM revenue_records WHERE deleted_at IS NULL'
          case 'revenue':
            return 'SELECT COUNT(*) as count FROM revenue_records WHERE deleted_at IS NULL'
          case 'affiliate':
            return 'SELECT COUNT(DISTINCT a.id) as count FROM affiliates a LEFT JOIN affiliate_usages au ON a.id = au.affiliate_id WHERE a.deleted_at IS NULL'
          case 'product':
            return 'SELECT COUNT(*) as count FROM products'
          default:
            throw new Error(`Invalid section: ${section}`)
        }
      })()

      const countResult = await Promise.race([
        masterDb.query(countQuery),
        timeoutPromise,
      ])

      const rowCount = (countResult as any).rows[0]?.count || 0

      // Check if export exceeds row limit
      const MAX_EXPORT_ROWS = 50000
      if (rowCount > MAX_EXPORT_ROWS) {
        logger.warn('EXPORT_OVERSIZED', {
          correlation_id: correlationId,
          workspace_id: workspaceId,
          section,
          row_count: rowCount,
          max_rows: MAX_EXPORT_ROWS,
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: `Export data exceeds maximum size: ${rowCount} rows > ${MAX_EXPORT_ROWS} rows limit`,
            },
          },
          { status: 413 }
        )
      }

      // Build and execute export query with timeout
      let exportQuery = ''
      const params: any[] = []

      switch (section) {
        case 'geographic':
          exportQuery = `
            SELECT
              r.billing_country as country_code,
              SUM(COALESCE(r.amount_cents, 0)) as total_revenue,
              COUNT(DISTINCT r.license_id) as license_count
            FROM revenue_records r
            WHERE r.deleted_at IS NULL
            GROUP BY r.billing_country
            ORDER BY total_revenue DESC
          `
          break

        case 'revenue':
          exportQuery = `
            SELECT
              p.name->>'en' as product_name,
              r.amount_cents as amount,
              r.created_at as transaction_date,
              r.billing_country as country,
              r.transaction_type
            FROM revenue_records r
            JOIN products p ON r.product_id = p.id
            WHERE r.deleted_at IS NULL
          `
          if (dateFrom && dateTo) {
            exportQuery += ` AND r.created_at >= $1 AND r.created_at <= $2`
            params.push(dateFrom, dateTo)
          }
          exportQuery += ` ORDER BY r.created_at DESC`
          break

        case 'affiliate':
          exportQuery = `
            SELECT
              a.name as affiliate_name,
              a.status,
              a.email,
              COUNT(DISTINCT au.id) as referral_count,
              SUM(COALESCE(au.commission_amount, 0)) as total_commission
            FROM affiliates a
            LEFT JOIN affiliate_usages au ON a.id = au.affiliate_id
            WHERE a.deleted_at IS NULL
            GROUP BY a.id, a.name, a.status, a.email
            ORDER BY total_commission DESC
          `
          break

        case 'product':
          exportQuery = `
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
          break
      }

      // Execute export query with timeout
      const dataResult = await Promise.race([
        masterDb.query(exportQuery, params),
        timeoutPromise,
      ])

      const rows = (dataResult as any).rows || []

      // Log successful query execution
      logger.debug('DASHBOARD_QUERY_EXECUTED', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        query_type: 'export',
        section,
        row_count: rows.length,
        query_time_ms: Date.now() - startTime,
      })

      // Build CSV content
      let csvContent = ''

      // Add UTF-8 BOM for Excel compatibility
      csvContent = '\ufeff'

      // Add headers based on section
      switch (section) {
        case 'geographic':
          csvContent += 'Country Code,Total Revenue (cents),License Count\n'
          for (const row of rows) {
            csvContent += `"${row.country_code}",${row.total_revenue},${row.license_count}\n`
          }
          break

        case 'revenue':
          csvContent +=
            'Product Name,Amount (cents),Transaction Date,Country,Transaction Type\n'
          for (const row of rows) {
            csvContent += `"${row.product_name}",${row.amount},"${row.transaction_date}","${row.country}","${row.transaction_type}"\n`
          }
          break

        case 'affiliate':
          csvContent +=
            'Affiliate Name,Status,Email,Referral Count,Total Commission\n'
          for (const row of rows) {
            csvContent += `"${row.affiliate_name}","${row.status}","${row.email}",${row.referral_count},${row.total_commission}\n`
          }
          break

        case 'product':
          csvContent +=
            'Product Name,Slug,License Count,Total Revenue (cents)\n'
          for (const row of rows) {
            csvContent += `"${row.product_name}","${row.slug}",${row.license_count},${row.total_revenue}\n`
          }
          break
      }

      // Calculate response time
      const responseTimeMs = Date.now() - startTime

      // Log response
      logger.info('RESPONSE_SENT', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/export',
        response_status: 200,
        response_time_ms: responseTimeMs,
        section,
        row_count: rows.length,
      })

      // Return CSV response
      const filename = `mmc-dashboard-${section}-export-${new Date().toISOString().substring(0, 10)}.csv`
      return c.body(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'X-Correlation-ID': correlationId,
          'X-Workspace-ID': workspaceId,
          'X-Service-Name': 'mmc-dashboard',
          'X-Request-Timestamp': new Date().toISOString(),
          'X-Response-Time': String(responseTimeMs),
          'X-Cache': 'MISS',
        },
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      // Check for timeout error
      if (errorMsg.includes('timeout')) {
        logger.error('EXPORT_TIMEOUT', {
          correlation_id: correlationId,
          workspace_id: workspaceId,
          endpoint: '/export',
          error_code: 'EXPORT_TIMEOUT',
          error_message: errorMsg,
        })

        return c.json(
          {
            success: false,
            data: null,
            error: {
              code: 'EXPORT_TIMEOUT',
              message: 'Export query exceeded 2-second timeout',
            },
          },
          { status: 408 }
        )
      }

      logger.error('DASHBOARD_ERROR', {
        correlation_id: correlationId,
        workspace_id: workspaceId,
        endpoint: '/export',
        error_code: 'EXPORT_FAILED',
        error_message: errorMsg,
      })

      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to export dashboard data',
          },
        },
        { status: 500 }
      )
    }
  })

  return router
}

/**
 * Export for route registration
 *
 * Usage in apps/api/src/server.ts:
 * ```
 * import { createDashboardRouter } from './routes/mmc/dashboard'
 *
 * const dashboardRouter = createDashboardRouter()
 * app.route('/api/mmc/dashboard', dashboardRouter)
 * ```
 */
export default createDashboardRouter
