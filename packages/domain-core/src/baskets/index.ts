/**
 * Baskets — Public API Barrel
 *
 * File: packages/domain-core/src/baskets/index.ts
 * Stage: STAGE_33_MCQ_BASKETS
 *
 * Exports the public surface of the baskets domain module.
 * Type-only exports are listed explicitly to keep the surface slim
 * and to avoid exposing internal repository / row-mapper types.
 */

export * from './baskets.dependency-registry'
export * from './baskets.errors'
export * from './baskets.service'
export type {
  AuditContext,
  BasketQuestionRow,
  BasketRow,
  BasketStatus,
  BasketType,
  BasketWithCount,
  CreateBasketInput,
  DbClient,
  DeletionGuardResult,
  LinkQuestionInput,
  ListBasketQuestionsInput,
  ListBasketQuestionsResult,
  ListBasketsInput,
  ListBasketsResult,
  UpdateBasketInput,
} from './baskets.types'
export { VALID_BASKET_STATUSES, VALID_BASKET_TYPES } from './baskets.types'
