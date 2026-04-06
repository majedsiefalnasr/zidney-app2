/**
 * Webhooks Router — Index
 *
 * File: apps/api/src/routes/webhooks/index.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 *
 * Aggregates inbound webhook handlers.
 * Mounted at /api/v1 in app.ts via:
 *   app.route('/api/v1', webhooksRouter)
 *
 * Route table:
 *   POST /api/v1/webhooks/billing/gateway  — gateway payment notification
 *
 * Security model:
 *   - No JWT authentication (webhooks are sent by external systems, not staff browsers)
 *   - HMAC-SHA256 signature verification inside each handler
 *   - Tenant resolver middleware applied (for DB access)
 *   - Rate limiting applied (inherits app-level rate limiter)
 *
 * Constitutional Compliance:
 * ✓ No business logic — delegates to handler functions
 * ✓ No licenseMiddleware — webhooks are platform-level, not workspace-user actions
 */

import { Hono } from 'hono'

import { handleGatewayBillingWebhook } from './gateway-billing'

export const webhooksRouter = new Hono()

// ---------------------------------------------------------------------------
// Payment gateway notification
// ---------------------------------------------------------------------------

webhooksRouter.post('/webhooks/billing/gateway', handleGatewayBillingWebhook)
