/**
 * Domain Types: Affiliate System
 * Stage: STAGE_13_AFFILIATES
 * Purpose: Core type definitions for affiliate program
 */

export type AffiliateStatus = 'ACTIVE' | 'INACTIVE'

export interface Affiliate {
  id: string // UUID
  promo_code: string
  discount_percentage: string // NUMERIC(5,2) as string for precision
  commission_percentage: string // NUMERIC(5,2) as string for precision
  allow_with_other_discounts: boolean
  usage_limit_total: number | null
  usage_limit_per_client: number | null
  usage_count: number
  start_date: Date
  end_date: Date
  status: AffiliateStatus
  description?: string
  created_at: Date
  updated_at: Date
}

export interface AffiliateUsage {
  id: string // UUID
  affiliate_id: string // UUID, FK to affiliates
  client_id: string // UUID
  license_id: string // UUID
  base_amount: string // NUMERIC(12,2) as string for precision
  discount_percentage: string // NUMERIC(5,2) as string
  discount_amount: string // NUMERIC(12,2) as string
  commission_percentage: string // NUMERIC(5,2) as string
  commission_amount: string // NUMERIC(12,2) as string
  created_at: Date
}

export interface AffiliateAdminAudit {
  id: string // UUID
  affiliate_id: string // UUID, FK to affiliates
  admin_id: string // UUID
  action: 'CREATE' | 'UPDATE' | 'DISABLE'
  old_values: Record<string, unknown> | null // JSONB
  new_values: Record<string, unknown> | null // JSONB
  ip_address?: string // inet type
  created_at: Date
}

export interface AffiliateDiscount {
  affiliate_id: string
  promo_code: string
  discount_amount: string // NUMERIC(12,2)
  commission_amount: string // NUMERIC(12,2)
  final_amount: string // base_amount - discount_amount
}

export interface AffiliateValidationResult {
  valid: boolean
  error?: string
  errorCode?: string
}
