/**
 * Financial Calculations: Affiliate System
 * Stage: STAGE_13_AFFILIATES
 * Purpose: Deterministic NUMERIC-based discount and commission calculations
 *
 * All calculations use database-side SQL ROUND() function to ensure
 * consistency across all systems. NEVER use floating-point math in production.
 *
 * Formula:
 *   amount = ROUND(base_amount * percentage / 100, 2)
 */

/**
 * Calculate discount amount given base amount and discount percentage
 * Note: Actual calculation happens in SQL with ROUND() function
 * This is for validation/preview only
 *
 * @param baseAmount Base purchase amount as number
 * @param discountPercentage Discount percentage as number (0-100)
 * @returns Discount amount rounded to 2 decimal places
 */
export function calculateDiscountPreview(baseAmount: number, discountPercentage: number): string {
  if (baseAmount === 0) {
    return '0.00'
  }

  // Simple floating point for preview only
  const discount = (baseAmount * discountPercentage) / 100
  return discount.toFixed(2)
}

/**
 * Calculate commission amount given base amount and commission percentage
 * Note: Actual calculation happens in SQL with ROUND() function
 *
 * @param baseAmount Base purchase amount as number
 * @param commissionPercentage Commission percentage as number (0-100)
 * @returns Commission amount rounded to 2 decimal places
 */
export function calculateCommissionPreview(
  baseAmount: number,
  commissionPercentage: number
): string {
  if (baseAmount === 0) {
    return '0.00'
  }

  // Simple floating point for preview only
  const commission = (baseAmount * commissionPercentage) / 100
  return commission.toFixed(2)
}

/**
 * Calculate final amount after applying discount
 *
 * @param baseAmount Base purchase amount as number
 * @param discountAmount Discount amount as number
 * @returns Final amount as string with 2 decimal places
 */
export function calculateFinalAmount(baseAmount: number, discountAmount: number): string {
  const final = baseAmount - discountAmount
  return final.toFixed(2)
}
