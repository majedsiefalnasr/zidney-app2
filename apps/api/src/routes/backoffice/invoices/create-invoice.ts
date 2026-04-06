/**
 * Create Invoice — POST /invoices
 *
 * File: apps/api/src/routes/backoffice/invoices/create-invoice.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 */

import { createInvoiceForSubscription } from '@zidney/domain-core/billing'
import { createLogger } from '@zidney/logger'
import { createInvoiceBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, invoiceErrorResponse } from './helpers'

const logger = createLogger('backoffice-invoices-create')

export async function handleCreateInvoice(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const rawBody = await c.req.json()
    const parsed = createInvoiceBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      const requestId = (c.get('request_id') as string | undefined) ?? null
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid request body',
          },
          request_id: requestId,
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Create invoice request', {
      workspace_id: workspaceId,
      correlation_id: correlationId,
      subscriber_id: parsed.data.subscriber_id,
    })

    const invoice = await createInvoiceForSubscription(db, parsed.data, audit)

    return c.json({ success: true, data: invoice, error: null }, 201)
  } catch (err) {
    return invoiceErrorResponse(c, err)
  }
}
