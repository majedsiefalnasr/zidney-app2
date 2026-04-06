/**
 * Gateway Billing Webhook Handler — POST /webhooks/billing/gateway
 *
 * File: apps/api/src/routes/webhooks/gateway-billing.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 *
 * Receives inbound payment gateway notifications.
 * Security: HMAC-SHA256 signature verification (X-Gateway-Signature header).
 * No JWT authentication — signature is the sole authorization mechanism.
 *
 * Constitutional Compliance:
 * ✓ No business logic — delegates to confirmGatewayPayment service
 * ✓ Idempotent — re-delivery of the same event returns 200 (already processed)
 * ✓ Signature verified before ANY body parsing or DB access
 * ✓ Raw body read as Buffer to preserve exact bytes signed by gateway
 * ✓ WEBHOOK_ALREADY_PROCESSED returns 200 — not an error
 */

import {
  BillingError,
  confirmGatewayPayment,
  verifyGatewaySignature,
} from '@zidney/domain-core/billing'
import { createLogger } from '@zidney/logger'
import { gatewayWebhookBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

const logger = createLogger('webhooks-gateway-billing')

export async function handleGatewayBillingWebhook(c: Context) {
  const correlationId: string = (c.get('correlation_id') as string | undefined) ?? 'webhook'

  // -------------------------------------------------------------------------
  // 1. Read raw body for signature verification
  // -------------------------------------------------------------------------
  const rawBody = await c.req.raw.arrayBuffer()
  const rawBuffer = Buffer.from(rawBody)

  // -------------------------------------------------------------------------
  // 2. Verify HMAC-SHA256 signature
  // -------------------------------------------------------------------------
  const signature = c.req.header('x-gateway-signature') ?? ''
  const secret = process.env.GATEWAY_WEBHOOK_SECRET ?? ''

  if (!secret) {
    logger.error('GATEWAY_WEBHOOK_SECRET is not configured', { correlation_id: correlationId })
    return c.json(
      {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'Webhook processing unavailable' },
      },
      503
    )
  }

  if (!verifyGatewaySignature(rawBuffer, signature, secret)) {
    logger.warn('Invalid gateway webhook signature', { correlation_id: correlationId })
    return c.json(
      {
        success: false,
        data: null,
        error: { code: 'INVALID_WEBHOOK_SIGNATURE', message: 'Signature verification failed' },
      },
      401
    )
  }

  // -------------------------------------------------------------------------
  // 3. Parse body
  // -------------------------------------------------------------------------
  let bodyJson: unknown
  try {
    bodyJson = JSON.parse(rawBuffer.toString('utf8'))
  } catch {
    return c.json(
      {
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' },
      },
      400
    )
  }

  const parsed = gatewayWebhookBodySchema.safeParse(bodyJson)
  if (!parsed.success) {
    return c.json(
      {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid webhook payload',
        },
      },
      422
    )
  }

  // -------------------------------------------------------------------------
  // 4. Build system audit context (no JWT user for webhooks)
  // -------------------------------------------------------------------------
  const tenant = c.get('tenant') as { pool: unknown; id?: string; slug?: string } | undefined
  if (!tenant?.pool) {
    logger.error('Tenant pool unavailable for webhook', { correlation_id: correlationId })
    return c.json(
      {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'Tenant context unavailable' },
      },
      503
    )
  }

  const audit = {
    user_id: null,
    workspace_id: tenant.id ?? null,
    workspace_slug: tenant.slug ?? null,
    correlation_id: correlationId,
  }
  const db = tenant.pool as Parameters<typeof confirmGatewayPayment>[0]

  // -------------------------------------------------------------------------
  // 5. Process gateway event
  // -------------------------------------------------------------------------
  try {
    logger.info('Processing gateway webhook', {
      event: parsed.data.event,
      invoice_id: parsed.data.invoice_id,
      correlation_id: correlationId,
    })

    await confirmGatewayPayment(
      db,
      {
        invoice_id: parsed.data.invoice_id,
        payment_reference: parsed.data.payment_reference,
        gateway_metadata: parsed.data.metadata,
      },
      audit
    )

    return c.json({ success: true, data: { already_processed: false }, error: null }, 200)
  } catch (err) {
    if (err instanceof BillingError) {
      // WEBHOOK_ALREADY_PROCESSED is a 200 — idempotent re-delivery
      if (err.code === 'WEBHOOK_ALREADY_PROCESSED') {
        return c.json({ success: true, data: { already_processed: true }, error: null }, 200)
      }

      logger.warn('Billing error processing webhook', {
        code: err.code,
        invoice_id: parsed.data.invoice_id,
        correlation_id: correlationId,
      })
      return c.json(
        { success: false, data: null, error: { code: err.code, message: err.message } },
        err.httpStatus as 200 | 400 | 401 | 404 | 409 | 422 | 500
      )
    }

    logger.error('Unexpected error processing gateway webhook', {
      error: err instanceof Error ? err.message : String(err),
      invoice_id: parsed.data.invoice_id,
      correlation_id: correlationId,
    })
    return c.json(
      {
        success: false,
        data: null,
        error: { code: 'INTERNAL_ERROR', message: 'Webhook processing failed' },
      },
      500
    )
  }
}
