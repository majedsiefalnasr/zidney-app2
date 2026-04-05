/**
 * Subscription Enforcement Middleware
 *
 * File: apps/api/src/middleware/subscription-enforcement.ts
 * Stage: STAGE_44_PLANS_AND_SUBSCRIPTIONS
 *
 * NOTE: This middleware was created in Stage 44 but is NOT mounted in app.ts.
 * It will be activated and wired into the student-facing routes in Stage 45
 * once the full subscription enforcement flow is designed.
 *
 * Intended behavior (Stage 45+):
 *   - Verify that a student has an ACTIVE subscription before allowing access
 *     to protected frontoffice endpoints.
 *   - Returns 402 SUBSCRIPTION_REQUIRED if no active subscription exists.
 *   - Returns 402 SUBSCRIPTION_EXPIRED if subscription has lapsed.
 *   - Skips enforcement on public routes and backoffice routes.
 */

import type { MiddlewareHandler } from 'hono'

/**
 * Stub middleware — NOT ACTIVE.
 * Mount in app.ts only after Stage 45 implementation is complete.
 */
export const subscriptionEnforcementMiddleware: MiddlewareHandler = async (_c, next) => {
  // Stub — passes through unconditionally until Stage 45 activates enforcement.
  await next()
}
