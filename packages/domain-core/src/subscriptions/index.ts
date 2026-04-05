/**
 * Subscriptions Domain — Public Barrel
 *
 * File: packages/domain-core/src/subscriptions/index.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 */

export type { SubscriptionErrorCode } from './subscriptions.errors'
export { SUBSCRIPTION_ERROR_HTTP, SubscriptionError } from './subscriptions.errors'
export {
  activateSubscription,
  cancelSubscriptionService,
  getSubscriptionById,
  listSubscriptionsService,
} from './subscriptions.service'
export type {
  CreateSubscriptionInput,
  PaymentMethod,
  SubscriptionListQuery,
  SubscriptionListResult,
  SubscriptionRecord,
  SubscriptionRow,
  SubscriptionState,
} from './subscriptions.types'
