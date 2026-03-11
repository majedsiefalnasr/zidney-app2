/**
 * Affiliate Service
 * Stage: STAGE_13_AFFILIATES
 * Task: T021 - Affiliate Validation Service
 * Purpose: Core business logic for affiliate code validation and application
 */

import {
  AffiliateErrorCode,
  AffiliateErrorMessages,
} from '@zidney/domain-core/affiliates/error-codes'
import {
  validateCurrentTimeInRange,
  validateGlobalUsageLimit,
  validatePerClientUsageLimit,
} from '@zidney/domain-core/affiliates/validators'
import { sql } from 'drizzle-orm'
import type { Logger } from 'pino'
import { v4 as uuidv4 } from 'uuid'

type SqlExecutor = {
  execute: <T = Record<string, unknown>>(query: unknown) => Promise<{ rows: T[] }>
}

interface AffiliateRow {
  id: string
  promo_code: string
  discount_percentage: string
  commission_percentage: string
  status: string
  start_date: string | Date
  end_date: string | Date | null
  usage_count: number
  usage_limit_total: number | null
  usage_limit_per_client: number | null
}

interface CountRow {
  count: string
}

interface DiscountRow {
  discount: string
}

interface CommissionRow {
  commission: string
}

interface AffiliateDiscount {
  affiliateId: string
  promoCode: string
  baseAmount: string
  discountPercentage: string
  discountAmount: string
  commissionPercentage: string
  commissionAmount: string
  finalAmount: string
}

interface AffiliateValidationError {
  code: AffiliateErrorCode
  message: string
  httpStatus: number
}

function isAffiliateValidationError(error: unknown): error is AffiliateValidationError {
  return Boolean(error) && typeof error === 'object' && 'code' in error && 'httpStatus' in error
}

export class AffiliateService {
  private logger: Logger

  constructor(logger: Logger) {
    this.logger = logger.child({ service: 'affiliate-service' })
  }

  /**
   * Validate and apply affiliate code to license purchase
   * T021: Core function for license purchase integration
   *
   * Executes atomically within provided transaction:
   * 1. SELECT affiliate FOR UPDATE (row-level lock)
   * 2. Validate status, temporal range, global limit, per-client limit
   * 3. Calculate discount and commission
   * 4. INSERT usage record (immutable)
   * 5. UPDATE usage counter
   *
   * @param affiliateCode - Promo code to validate
   * @param clientId - Client UUID applying the code
   * @param baseAmount - Raw purchase amount
   * @param tx - PostgreSQL transaction context
   * @returns AffiliateDiscount on success, throws AffiliateValidationError on failure
   */
  async validateAndApplyAffiliateCode(
    affiliateCode: string,
    clientId: string,
    baseAmount: string,
    licenseId: string,
    tx: SqlExecutor,
    correlationId: string
  ): Promise<AffiliateDiscount> {
    try {
      // 1. SELECT affiliate WITH ROW LOCK
      const affiliateResult = await tx.execute(
        sql`
          SELECT 
            id,
            promo_code,
            discount_percentage,
            commission_percentage,
            status,
            start_date,
            end_date,
            usage_count,
            usage_limit_total,
            usage_limit_per_client
          FROM affiliates
          WHERE promo_code = ${affiliateCode}
          FOR UPDATE
        `
      )

      if (!affiliateResult.rows || affiliateResult.rows.length === 0) {
        this.logger.warn(
          {
            correlationId,
            promoCode: affiliateCode,
            clientId,
            errorCode: AffiliateErrorCode.AFFILIATE_CODE_NOT_FOUND,
          },
          'Affiliate code not found'
        )
        throw {
          code: AffiliateErrorCode.AFFILIATE_CODE_NOT_FOUND,
          message: AffiliateErrorMessages[AffiliateErrorCode.AFFILIATE_CODE_NOT_FOUND],
          httpStatus: 400,
        } as AffiliateValidationError
      }

      const affiliate = affiliateResult.rows[0] as AffiliateRow
      const affiliateId = affiliate.id

      // 2. VALIDATE STATUS
      if (affiliate.status !== 'ACTIVE') {
        this.logger.warn(
          {
            correlationId,
            affiliateId,
            promoCode: affiliateCode,
            status: affiliate.status,
            errorCode: AffiliateErrorCode.AFFILIATE_CODE_INACTIVE,
          },
          'Affiliate code is not active'
        )
        throw {
          code: AffiliateErrorCode.AFFILIATE_CODE_INACTIVE,
          message: AffiliateErrorMessages[AffiliateErrorCode.AFFILIATE_CODE_INACTIVE],
          httpStatus: 400,
        } as AffiliateValidationError
      }

      // 3. VALIDATE TEMPORAL RANGE
      const now = new Date()
      if (!validateCurrentTimeInRange(affiliate.start_date, affiliate.end_date, now)) {
        this.logger.warn(
          {
            correlationId,
            affiliateId,
            promoCode: affiliateCode,
            now: now.toISOString(),
            startDate: affiliate.start_date,
            endDate: affiliate.end_date,
            errorCode: AffiliateErrorCode.AFFILIATE_CODE_EXPIRED,
          },
          'Affiliate code is outside valid temporal range'
        )
        throw {
          code: AffiliateErrorCode.AFFILIATE_CODE_EXPIRED,
          message: AffiliateErrorMessages[AffiliateErrorCode.AFFILIATE_CODE_EXPIRED],
          httpStatus: 400,
        } as AffiliateValidationError
      }

      // 4. VALIDATE GLOBAL USAGE LIMIT
      if (!validateGlobalUsageLimit(affiliate.usage_count, affiliate.usage_limit_total)) {
        this.logger.warn(
          {
            correlationId,
            affiliateId,
            promoCode: affiliateCode,
            usageCount: affiliate.usage_count,
            usageLimitTotal: affiliate.usage_limit_total,
            errorCode: AffiliateErrorCode.AFFILIATE_USAGE_LIMIT_EXCEEDED,
          },
          'Affiliate code global usage limit exceeded'
        )
        throw {
          code: AffiliateErrorCode.AFFILIATE_USAGE_LIMIT_EXCEEDED,
          message: AffiliateErrorMessages[AffiliateErrorCode.AFFILIATE_USAGE_LIMIT_EXCEEDED],
          httpStatus: 400,
        } as AffiliateValidationError
      }

      // 5. VALIDATE PER-CLIENT USAGE LIMIT
      const perClientCount = await this.countPerClientUsage(tx, affiliateId, clientId)
      if (!validatePerClientUsageLimit(perClientCount, affiliate.usage_limit_per_client)) {
        this.logger.warn(
          {
            correlationId,
            affiliateId,
            promoCode: affiliateCode,
            clientId,
            perClientCount,
            usageLimitPerClient: affiliate.usage_limit_per_client,
            errorCode: AffiliateErrorCode.AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED,
          },
          'Affiliate code per-client usage limit exceeded'
        )
        throw {
          code: AffiliateErrorCode.AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED,
          message:
            AffiliateErrorMessages[AffiliateErrorCode.AFFILIATE_USAGE_LIMIT_PER_CLIENT_EXCEEDED],
          httpStatus: 400,
        } as AffiliateValidationError
      }

      // 6. CALCULATE DISCOUNT AND COMMISSION (NUMERIC precision in database)
      const discountAmount = await this.calculateDiscount(
        tx,
        baseAmount,
        affiliate.discount_percentage
      )
      const commissionAmount = await this.calculateCommission(
        tx,
        baseAmount,
        affiliate.commission_percentage
      )

      // Calculate final amount: baseAmount - discountAmount
      const baseNum = parseFloat(String(baseAmount))
      const discountNum = parseFloat(String(discountAmount))
      const finalAmount = (baseNum - discountNum).toFixed(2)

      // 7. INSERT USAGE RECORD (immutable audit trail)
      const usageId = uuidv4()
      await tx.execute(
        sql`
          INSERT INTO affiliate_usages (
            id,
            affiliate_id,
            client_id,
            license_id,
            base_amount,
            discount_percentage,
            discount_amount,
            commission_percentage,
            commission_amount,
            created_at
          ) VALUES (
            ${usageId},
            ${affiliateId},
            ${clientId},
            ${licenseId},
            ${baseAmount},
            ${affiliate.discount_percentage},
            ${discountAmount},
            ${affiliate.commission_percentage},
            ${commissionAmount},
            NOW()
          )
        `
      )

      // 8. UPDATE USAGE COUNTER (atomically within lock)
      await tx.execute(
        sql`
          UPDATE affiliates
          SET usage_count = usage_count + 1
          WHERE id = ${affiliateId}
        `
      )

      // 9. LOG SUCCESS
      this.logger.info(
        {
          correlationId,
          affiliateId,
          promoCode: affiliateCode,
          clientId,
          licenseId,
          baseAmount,
          discountAmount,
          commissionAmount,
          finalAmount,
          event: 'affiliate_code_applied',
        },
        'Affiliate code successfully applied to license purchase'
      )

      return {
        affiliateId,
        promoCode: affiliateCode,
        baseAmount,
        discountPercentage: affiliate.discount_percentage,
        discountAmount,
        commissionPercentage: affiliate.commission_percentage,
        commissionAmount,
        finalAmount,
      }
    } catch (error) {
      if (isAffiliateValidationError(error)) {
        throw error
      }
      this.logger.error(
        {
          correlationId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        'Unexpected error in affiliate validation'
      )
      throw {
        code: 'AFFILIATE_VALIDATION_ERROR',
        message: 'An error occurred while validating affiliate code',
        httpStatus: 500,
      }
    }
  }

  /**
   * Count current usage for specific client and affiliate
   * @private
   */
  private async countPerClientUsage(
    tx: SqlExecutor,
    affiliateId: string,
    clientId: string
  ): Promise<number> {
    const result = await tx.execute<CountRow>(
      sql`
        SELECT COUNT(*) as count
        FROM affiliate_usages
        WHERE affiliate_id = ${affiliateId}
          AND client_id = ${clientId}
      `
    )
    return parseInt(result.rows[0].count, 10)
  }

  /**
   * Calculate discount amount using PostgreSQL NUMERIC precision
   * @private
   */
  private async calculateDiscount(
    tx: SqlExecutor,
    baseAmount: string,
    discountPercentage: string
  ): Promise<string> {
    const result = await tx.execute<DiscountRow>(
      sql`
        SELECT ROUND(${baseAmount}::NUMERIC * ${discountPercentage}::NUMERIC / 100, 2) as discount
      `
    )
    return result.rows[0].discount
  }

  /**
   * Calculate commission amount using PostgreSQL NUMERIC precision
   * @private
   */
  private async calculateCommission(
    tx: SqlExecutor,
    baseAmount: string,
    commissionPercentage: string
  ): Promise<string> {
    const result = await tx.execute<CommissionRow>(
      sql`
        SELECT ROUND(${baseAmount}::NUMERIC * ${commissionPercentage}::NUMERIC / 100, 2) as commission
      `
    )
    return result.rows[0].commission
  }

  /**
   * Get affiliate usage history with aggregations
   * T030: Usage reporting endpoint support
   */
  async getAffiliateUsageHistory(
    affiliateId: string,
    page: number = 1,
    limit: number = 20,
    tx: SqlExecutor
  ) {
    const offset = (page - 1) * limit

    // Get usage records
    const usagesResult = await tx.execute(
      sql`
        SELECT 
          id,
          affiliate_id,
          client_id,
          license_id,
          base_amount,
          discount_percentage,
          discount_amount,
          commission_percentage,
          commission_amount,
          created_at
        FROM affiliate_usages
        WHERE affiliate_id = ${affiliateId}
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
    )

    // Get aggregate statistics
    const statsResult = await tx.execute(
      sql`
        SELECT 
          COUNT(*) as total_count,
          SUM(base_amount::NUMERIC) as total_base_amount,
          SUM(discount_amount::NUMERIC) as total_discount_amount,
          SUM(commission_amount::NUMERIC) as total_commission_amount
        FROM affiliate_usages
        WHERE affiliate_id = ${affiliateId}
      `
    )

    const stats = statsResult.rows[0]

    return {
      usages: usagesResult.rows,
      stats: {
        totalCount: parseInt(stats.total_count, 10),
        totalBaseAmount: stats.total_base_amount || '0.00',
        totalDiscountAmount: stats.total_discount_amount || '0.00',
        totalCommissionAmount: stats.total_commission_amount || '0.00',
      },
      pagination: {
        page,
        limit,
        totalRecords: parseInt(stats.total_count, 10),
        totalPages: Math.ceil(parseInt(stats.total_count, 10) / limit),
      },
    }
  }
}
