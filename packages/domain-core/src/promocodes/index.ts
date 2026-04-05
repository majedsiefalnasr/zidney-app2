/**
 * Promocodes Domain Module — Public Exports
 *
 * File: packages/domain-core/src/promocodes/index.ts
 * Stage: STAGE_45_PROMOCODES
 */

export type { PromocodeErrorCode } from './promocodes.errors'
export { PROMOCODE_ERROR_HTTP, PromocodeError } from './promocodes.errors'
export { PromocodeService, promocodeService } from './promocodes.service'
export type {
  AnalyticsFilter,
  AuditContext,
  DbClient,
  DiscountResult,
  ListPromocodesFilter,
  NewPromocodeUsageInput,
  PromocodeAnalytics,
  PromocodeInput,
  PromocodeRow,
  PromocodeType,
  PromocodeUsageRow,
  PromocodeValidationContext,
  SinglePromocodeAnalytics,
  TransactionClient,
  ValidatorResult,
} from './promocodes.types'
