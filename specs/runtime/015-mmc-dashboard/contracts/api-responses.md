# API Contracts: MMC Dashboard Request/Response Schemas

**Stage**: STAGE_15_MMC_DASHBOARD  
**Phase**: 02 – Platform MMC  
**Status**: Contract Definitions  
**Date**: February 26, 2026

---

## Overview

This document defines the request/response schemas for all 6 MMC Dashboard endpoints using TypeScript + Zod type definitions.

All schemas follow the standard response format:

```typescript
{
  success: boolean;
  data: TData | null;
  error: { code: string; message: string } | null;
}
```

---

## Common Types & Utilities

### Standard Response Wrapper

```typescript
import { z } from 'zod'

export const StandardResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().nullable(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .nullable(),
})

export type StandardResponse<T = any> = {
  success: boolean
  data: T | null
  error: {
    code: string
    message: string
  } | null
}
```

### Common Error Codes

```typescript
export enum DashboardErrorCode {
  // Authorization Errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  LICENSE_LOCKED = 'LICENSE_LOCKED',

  // Validation Errors
  INVALID_DATE_RANGE = 'INVALID_DATE_RANGE',
  INVALID_LIMIT = 'INVALID_LIMIT',
  INVALID_PAGE_SIZE = 'INVALID_PAGE_SIZE',
  INVALID_SORT_BY = 'INVALID_SORT_BY',

  // Business Logic Errors
  PAYLOAD_TOO_LARGE = 'PAYLOAD_TOO_LARGE',
  SCHEMA_INCOMPATIBLE = 'SCHEMA_INCOMPATIBLE',

  // Server Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
```

### Common Response Headers

All endpoints return these headers:

```typescript
{
  'Content-Type': 'application/json',
  'X-Correlation-ID': string,           // UUID for request tracing
  'X-User-ID': string,                  // User UUID from JWT claims
  'X-Workspace-ID': string,             // Tenant workspace UUID
  'X-Service-Name': 'mmc-dashboard',    // Service identifier
  'X-Request-Timestamp': string,        // ISO 8601 UTC timestamp
  'X-Response-Time': string,            // milliseconds
  'X-Cache': 'HIT' | 'MISS',            // Cache status (if applicable)
  'Cache-Control': 'max-age=300'        // If cacheable
}
```

**Audit Headers Rationale:**

- Required per PROJECT_CONTEXT_PRIMER.md § Logging Rules
- Enable full user traceability for dashboard access
- Support compliance and security audits
- X-User-ID: From JWT subject claim
- X-Workspace-ID: From tenant resolver context
- X-Service-Name: Identifies service for centralized logging
- X-Request-Timestamp: Server-authoritative timestamp (not client time)

---

## Endpoint 1: GET `/api/mmc/dashboard/summary`

### Purpose

Return platform-wide license counts, current month & YTD revenue at a glance.

### Request

```typescript
export const SummaryRequestSchema = z.object({
  // No query parameters
})

export type SummaryRequest = z.infer<typeof SummaryRequestSchema>
```

**Example Request**:

```
GET /api/mmc/dashboard/summary HTTP/1.1
Host: mmc.zidney.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
X-Workspace-Slug: mmc
```

### Response (200 OK)

```typescript
export const SummaryDataSchema = z.object({
  licenses: z.object({
    total: z.number().int().min(0),
    active: z.number().int().min(0),
    soft_locked: z.number().int().min(0),
    archived: z.number().int().min(0),
  }),
  revenue: z.object({
    this_month: z.number().int(), // 2450050 (cents: $24,500.50)
    this_year: z.number().int(), // 28765075 (cents: $287,650.75)
    last_month: z.number().int(), // 2210025 (cents: $22,100.25)
  }),
  snapshot_at: z.string().datetime(), // ISO 8601
})

export type SummaryData = z.infer<typeof SummaryDataSchema>

export const SummaryResponseSchema = StandardResponseSchema.extend({
  data: SummaryDataSchema.nullable(),
})

export type SummaryResponse = z.infer<typeof SummaryResponseSchema>
```

**Example Response**:

```json
{
  "success": true,
  "data": {
    "licenses": {
      "total": 1250,
      "active": 1200,
      "soft_locked": 35,
      "archived": 15
    },
    "revenue": {
      "this_month": 2450050,
      "this_year": 28765075,
      "last_month": 2210025
    },
    "snapshot_at": "2026-02-26T15:30:00Z"
  },
  "error": null
}
```

### Error Responses

**403 Forbidden** (Missing permission):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "reporting.view permission required to access dashboard"
  }
}
```

**423 Locked** (License not active):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "LICENSE_LOCKED",
    "message": "MMC workspace license is not active"
  }
}
```

**License State Machine** (per AGENTS.md § License Enforcement):

- `ACTIVE` → All operations allowed
- `SOFT_LOCKED` → Read-only access; no mutations; operator notified
- `SOFT_LOCKED` (expired, not renewed) → Auto-transitions to `ARCHIVED` after grace period
- `ARCHIVED` → No access; 403 Forbidden returned (not 423)

Dashboard behavior:

- `ACTIVE`: All endpoints return 200 OK
- `SOFT_LOCKED`: All endpoints return 423 LICENSE_LOCKED
- `ARCHIVED`: 403 Forbidden (not 423; archived state is different from locked)

Client should treat 423 as temporary (soft-lock window) and 403 as permanent (archived).

---

## Endpoint 2: GET `/api/mmc/dashboard/revenue-breakdown`

### Purpose

Return top 5 products by revenue with growth metrics.

### Request

```typescript
export const RevenueBreakdownQuerySchema = z.object({
  date_from: z.string().date().optional(), // ISO date "2025-02-26"
  date_to: z.string().date().optional(),
})

export type RevenueBreakdownQuery = z.infer<typeof RevenueBreakdownQuerySchema>

// Validation: date_to >= date_from
export const validateRevenueBreakdownQuery = (
  query: RevenueBreakdownQuery
): boolean => {
  if (query.date_from && query.date_to) {
    return new Date(query.date_to) >= new Date(query.date_from)
  }
  return true
}
```

**Example Request**:

```
GET /api/mmc/dashboard/revenue-breakdown?date_from=2025-02-26&date_to=2026-02-26 HTTP/1.1
Host: mmc.zidney.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response (200 OK)

```typescript
export const ProductRevenueSchema = z.object({
  product_id: z.string().uuid(),
  product_name: z.string(),
  revenue_this_period: z.number().int(), // 8200050 (cents: $82,000.50)
  revenue_previous_period: z.number().int(), // 7500000 (cents: $75,000.00)
  growth_percent: z.number(), // 9.33 (percent as decimal 9.33)
  license_count: z.number().int().min(0),
})

export const RevenueBreakdownDataSchema = z.object({
  products: z.array(ProductRevenueSchema),
  total_revenue: z.number().int(), // 14700050 (cents: $147,000.50)
  period: z.object({
    from: z.string().date(),
    to: z.string().date(),
  }),
})

export type RevenueBreakdownData = z.infer<typeof RevenueBreakdownDataSchema>

export const RevenueBreakdownResponseSchema = StandardResponseSchema.extend({
  data: RevenueBreakdownDataSchema.nullable(),
})

export type RevenueBreakdownResponse = z.infer<
  typeof RevenueBreakdownResponseSchema
>
```

**Example Response**:

```json
{
  "success": true,
  "data": {
    "products": [
      {
        "product_id": "uuid-pro-123",
        "product_name": "Zidney Pro",
        "revenue_this_period": 8200050,
        "revenue_previous_period": 7500000,
        "growth_percent": 9.33,
        "license_count": 450
      },
      {
        "product_id": "uuid-ent-456",
        "product_name": "Zidney Enterprise",
        "revenue_this_period": 6500000,
        "revenue_previous_period": 6000000,
        "growth_percent": 8.33,
        "license_count": 120
      }
    ],
    "total_revenue": 14700050,
    "period": {
      "from": "2025-02-26",
      "to": "2026-02-26"
    }
  },
  "error": null
}
```

### Error Responses

**400 Bad Request** (Invalid date range):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_DATE_RANGE",
    "message": "date_to must be >= date_from"
  }
}
```

---

## Endpoint 3: GET `/api/mmc/dashboard/geographic`

### Purpose

Return revenue and license counts grouped by billing country.

### Request

```typescript
export const GeographicQuerySchema = z.object({
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  sort_by: z.enum(['revenue', 'license_count']).optional(), // default: 'revenue'
  limit: z.number().int().min(1).max(100).optional(), // default: 50
})

export type GeographicQuery = z.infer<typeof GeographicQuerySchema>
```

**Example Request**:

```
GET /api/mmc/dashboard/geographic?date_from=2025-02-26&sort_by=revenue&limit=30 HTTP/1.1
Host: mmc.zidney.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response (200 OK)

```typescript
export const CountryRevenueSchema = z.object({
  country_code: z.string().length(2), // ISO 3166-1 alpha-2
  country_name: z.string(),
  revenue: z.number().int(), // 9500050 (cents: $95,000.50)
  license_count: z.number().int().min(0),
  avg_revenue_per_license: z.number().multipleOf(0.01), // 146.15 (USD per license)
})

export const GeographicDataSchema = z.object({
  countries: z.array(CountryRevenueSchema),
  total_revenue: z.number().int(), // cents
  total_countries: z.number().int().min(0),
  queried_countries: z.number().int().min(0),
})

export type GeographicData = z.infer<typeof GeographicDataSchema>

export const GeographicResponseSchema = StandardResponseSchema.extend({
  data: GeographicDataSchema.nullable(),
})

export type GeographicResponse = z.infer<typeof GeographicResponseSchema>
```

**Example Response**:

```json
{
  "success": true,
  "data": {
    "countries": [
      {
        "country_code": "US",
        "country_name": "United States",
        "revenue": 9500050,
        "license_count": 650,
        "avg_revenue_per_license": 146.15
      },
      {
        "country_code": "GB",
        "country_name": "United Kingdom",
        "revenue": 3200025,
        "license_count": 180,
        "avg_revenue_per_license": 177.78
      }
    ],
    "total_revenue": 12700075,
    "total_countries": 28,
    "queried_countries": 50
  },
  "error": null
}
```

### Error Responses

**400 Bad Request** (Invalid limit):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_LIMIT",
    "message": "limit must be between 1 and 100"
  }
}
```

---

## Endpoint 4: GET `/api/mmc/dashboard/affiliates`

### Purpose

Return top affiliates by commission with usage metrics and pagination.

### Request

```typescript
export const AffiliatesQuerySchema = z.object({
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  sort_by: z.enum(['commission', 'usage_count', 'name']).optional(), // default: 'commission'
  status: z.enum(['ACTIVE', 'INACTIVE', 'ALL']).optional(), // default: 'ACTIVE'
  page: z.number().int().min(1).optional(), // default: 1
  page_size: z.number().int().min(1).max(100).optional(), // default: 50
})

export type AffiliatesQuery = z.infer<typeof AffiliatesQuerySchema>
```

**Example Request**:

```
GET /api/mmc/dashboard/affiliates?page=1&page_size=50&sort_by=commission&status=ACTIVE HTTP/1.1
Host: mmc.zidney.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response (200 OK)

```typescript
export const AffiliateMetricsSchema = z.object({
  affiliate_id: z.string().uuid(),
  name: z.string(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  total_commission: z.number().int(), // 1550050 (cents: $15,500.50)
  usage_count: z.number().int().min(0),
  avg_commission_per_usage: z.number().multipleOf(0.01), // 44.29 (USD per usage)
  last_activity: z.string().datetime(),
})

export const PaginationSchema = z.object({
  page: z.number().int().min(1),
  page_size: z.number().int().min(1).max(100),
  total_affiliates: z.number().int().min(0),
  total_pages: z.number().int().min(0),
})

export const AffiliatesDataSchema = z.object({
  affiliates: z.array(AffiliateMetricsSchema),
  pagination: PaginationSchema,
})

export type AffiliatesData = z.infer<typeof AffiliatesDataSchema>

export const AffiliatesResponseSchema = StandardResponseSchema.extend({
  data: AffiliatesDataSchema.nullable(),
})

export type AffiliatesResponse = z.infer<typeof AffiliatesResponseSchema>
```

**Example Response**:

```json
{
  "success": true,
  "data": {
    "affiliates": [
      {
        "affiliate_id": "uuid-affiliate-1",
        "name": "Top Partner Inc",
        "status": "ACTIVE",
        "total_commission": 1550050,
        "usage_count": 350,
        "avg_commission_per_usage": 44.29,
        "last_activity": "2026-02-26T10:30:00Z"
      },
      {
        "affiliate_id": "uuid-affiliate-2",
        "name": "Secondary Partners",
        "status": "ACTIVE",
        "total_commission": 800000,
        "usage_count": 200,
        "avg_commission_per_usage": 40.0,
        "last_activity": "2026-02-25T14:20:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "page_size": 50,
      "total_affiliates": 87,
      "total_pages": 2
    }
  },
  "error": null
}
```

### Error Responses

**400 Bad Request** (Invalid page size):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "INVALID_PAGE_SIZE",
    "message": "page_size must be between 1 and 100"
  }
}
```

---

## Endpoint 5: GET `/api/mmc/dashboard/trends`

### Purpose

Return monthly license and revenue trends for 12-month growth visualization.

### Request

```typescript
export const TrendsQuerySchema = z.object({
  months: z.number().int().min(1).max(12).optional(), // default: 12
  metric: z.enum(['license_count', 'revenue', 'both']).optional(), // default: 'both'
})

export type TrendsQuery = z.infer<typeof TrendsQuerySchema>
```

**Example Request**:

```
GET /api/mmc/dashboard/trends?months=12&metric=both HTTP/1.1
Host: mmc.zidney.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response (200 OK)

```typescript
export const MonthlyTrendSchema = z.object({
  month: z.string().date(), // "2025-02-26"
  license_count: z.number().int().min(0),
  revenue: z.number().int(), // 22000000 (cents: $220,000.00)
  mrr: z.number().int(), // 22000000 (cents: MRR $220,000.00)
})

export const TrendsSummarySchema = z.object({
  total_license_growth: z.number().int(), // net increase
  total_license_growth_percent: z.number(), // 13.64 (percent as decimal)
  total_revenue_growth: z.number().int(), // 6765075 (cents: $67,650.75)
  total_revenue_growth_percent: z.number(), // 30.72 (percent as decimal)
})

export const TrendsDataSchema = z.object({
  trends: z.array(MonthlyTrendSchema),
  summary: TrendsSummarySchema,
  period_months: z.number().int().min(1).max(12),
})

export type TrendsData = z.infer<typeof TrendsDataSchema>

export const TrendsResponseSchema = StandardResponseSchema.extend({
  data: TrendsDataSchema.nullable(),
})

export type TrendsResponse = z.infer<typeof TrendsResponseSchema>
```

**Example Response**:

```json
{
  "success": true,
  "data": {
    "trends": [
      {
        "month": "2025-02-26",
        "license_count": 1100,
        "revenue": 22000000,
        "mrr": 22000000
      },
      {
        "month": "2025-03-26",
        "license_count": 1120,
        "revenue": 23000000,
        "mrr": 23000000
      }
    ],
    "summary": {
      "total_license_growth": 150,
      "total_license_growth_percent": 13.64,
      "total_revenue_growth": 6765075,
      "total_revenue_growth_percent": 30.72
    },
    "period_months": 12
  },
  "error": null
}
```

---

## Endpoint 6: POST `/api/mmc/dashboard/export`

### Purpose

Export dashboard metrics as CSV file (subject to 50,000 row limit).

### Request

```typescript
export const ExportRequestSchema = z.object({
  section: z.enum(['geographic', 'affiliates', 'revenue_breakdown']),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  format: z.enum(['csv']).optional(), // default: 'csv'
})

export type ExportRequest = z.infer<typeof ExportRequestSchema>
```

**Example Request**:

```
POST /api/mmc/dashboard/export HTTP/1.1
Host: mmc.zidney.com
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "section": "geographic",
  "date_from": "2025-02-26",
  "date_to": "2026-02-26",
  "format": "csv"
}
```

### Response (200 OK – CSV Stream)

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="mmc-dashboard-export-2026-02-26.csv"
Content-Length: 52431

Country Code,Country Name,Revenue,License Count,Avg Revenue Per License
US,United States,95000.50,650,146.15
GB,United Kingdom,32000.25,180,177.78
CA,Canada,28500.00,145,196.55
...
```

### Response Format (Zod Schema Type)

```typescript
export const ExportResponseSchema = z.object({
  // Response is binary stream, not JSON
  // Headers indicate content-type and filename
})

export type ExportResponse = Blob // Binary stream
```

### Error Response (413 Payload Too Large)

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "Export request would return 185,000 rows. Maximum 50,000 rows allowed. Please filter by date range, country, or product."
  }
}
```

---

## Response Header Specifications

### All Endpoints

```
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
X-Correlation-ID: f47ac10b-58cc-4372-a567-0e02b2c3d479
X-Response-Time: 45
```

### Cacheable Endpoints

**/summary** (5-minute cache):

```
Cache-Control: max-age=300, public
X-Cache: HIT
ETag: "abc123def456"
```

**/trends** (10-minute cache):

```
Cache-Control: max-age=600, public
X-Cache: MISS  (first request) or HIT (subsequent)
```

**/affiliates** (1-minute cache):

```
Cache-Control: max-age=60, public
X-Cache: MISS
```

### Non-Cacheable Endpoints

**/revenue-breakdown, /geographic, /export**:

```
Cache-Control: no-cache, no-store, must-revalidate
X-Cache: MISS
```

---

## Error Response Format

All error responses follow:

```typescript
export const ErrorResponseSchema = StandardResponseSchema.extend({
  data: z.null(),
  success: z.literal(false),
  error: z.object({
    code: z.enum([
      'UNAUTHORIZED',
      'PERMISSION_DENIED',
      'LICENSE_LOCKED',
      'INVALID_DATE_RANGE',
      'INVALID_LIMIT',
      'INVALID_PAGE_SIZE',
      'PAYLOAD_TOO_LARGE',
      'SCHEMA_INCOMPATIBLE',
      'INTERNAL_ERROR',
    ]),
    message: z.string().min(1),
  }),
})

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
```

**HTTP Status Mapping**:

| Code | Status                | Error Code                                           |
| ---- | --------------------- | ---------------------------------------------------- |
| 200  | OK                    | N/A                                                  |
| 400  | Bad Request           | INVALID_DATE_RANGE, INVALID_LIMIT, INVALID_PAGE_SIZE |
| 401  | Unauthorized          | UNAUTHORIZED                                         |
| 403  | Forbidden             | PERMISSION_DENIED                                    |
| 404  | Not Found             | (license not found)                                  |
| 413  | Payload Too Large     | PAYLOAD_TOO_LARGE                                    |
| 423  | Locked                | LICENSE_LOCKED                                       |
| 426  | Upgrade Required      | SCHEMA_INCOMPATIBLE                                  |
| 500  | Internal Server Error | INTERNAL_ERROR                                       |

---

## Concurrency & Session Limits

**Connection Pool Configuration**:

- Min pool size: 5 connections
- Max pool size: 20 connections
- Idle timeout: 30 seconds
- Query timeout: 5 seconds
- Retry strategy: Exponential backoff (1s, 2s, 4s max)

**Concurrent Session Limits**:

- Max concurrent sessions per workspace: 100 active browser/socket sessions
- Max concurrent requests per user: 10 simultaneous API calls
- Max concurrent dashboard sessions across platform: 1000+
- Enforcement: Hard limit; requests exceeding capacity return 503 Service Unavailable

**Performance SLA**:

- Target latency: <300ms per endpoint under 100 concurrent users (hard guarantee)
- Cache hit ratio: >80% for cached endpoints (summary, trends, affiliates, export)
- P95 latency: <350ms
- P99 latency: <500ms

---

## Rate Limiting Headers

All endpoints include rate limit headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1645881600
```

**Limits**:

- Summary endpoint: 1000 req/hour per user
- Revenue breakdown endpoint: 1000 req/hour per user
- Geographic endpoint: 1000 req/hour per user
- Affiliates endpoint: 1000 req/hour per user
- Trends endpoint: 1000 req/hour per user (cached, low resource)
- Export endpoint: 100 req/hour per user (more restrictive due to resource intensity & 50k row streaming)

**Export Endpoint Rate Limit Headers**:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1645881600
```

Other endpoints:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1645881600
```

---

## Authentication & Authorization Headers

**Required Request Headers**:

```
Authorization: Bearer <JWT_TOKEN>
X-Workspace-Slug: mmc  (optional, inferred from MMC context)
```

**Missing Authorization** (401):

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authorization token"
  }
}
```

---

## TypeScript Implementation Guide

### Server-Side (Backend)

```typescript
// Route handler: apps/api/src/routes/mmc/dashboard/summary.ts

import { Hono } from 'hono'
import {
  SummaryResponseSchema,
  type SummaryResponse,
} from '@zidney/dashboard-contracts'

export const summaryRoute = new Hono<{ Bindings: AppBindings }>()

summaryRoute.get('/summary', async (ctx) => {
  try {
    // Fetch data
    const data = await fetchSummary(masterDb)

    // Validate response schema
    const validated = SummaryResponseSchema.safeParse({
      success: true,
      data,
      error: null,
    })

    if (!validated.success) {
      throw new Error(
        `Response schema validation failed: ${JSON.stringify(validated.error)}`
      )
    }

    return ctx.json(validated.data)
  } catch (error) {
    return ctx.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve dashboard summary',
        },
      },
      500
    )
  }
})
```

### Client-Side (Frontend)

```typescript
// Dashboard API client: apps/mmc/src/services/dashboard-api.ts

import {
  SummaryResponse,
  RevenueBreakdownResponse,
} from '@zidney/dashboard-contracts'

export const dashboardApi = {
  async getSummary(): Promise<SummaryResponse> {
    const response = await fetch('/api/mmc/dashboard/summary', {
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
    })

    const data: SummaryResponse = await response.json()

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to fetch summary')
    }

    return data
  },

  async getRevenueBreakdown(
    dateFrom?: string,
    dateTo?: string
  ): Promise<RevenueBreakdownResponse> {
    const params = new URLSearchParams()
    if (dateFrom) params.append('date_from', dateFrom)
    if (dateTo) params.append('date_to', dateTo)

    const response = await fetch(
      `/api/mmc/dashboard/revenue-breakdown?${params}`,
      {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const data: RevenueBreakdownResponse = await response.json()

    if (!response.ok) {
      throw new Error(
        data.error?.message || 'Failed to fetch revenue breakdown'
      )
    }

    return data
  },
}
```

---

END OF API-RESPONSES.MD
