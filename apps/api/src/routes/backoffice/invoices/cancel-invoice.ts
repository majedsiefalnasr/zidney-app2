/**
 * Cancel Invoice — PATCH /invoices/:id/cancel
 *
 * File: apps/api/src/routes/backoffice/invoices/cancel-invoice.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 */

import { cancelInvoice } from '@zidney/domain-core/billing'
import { createLogger } from '@zidney/logger'
import { cancelInvoiceBodySchema, invoiceIdParamsSchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, invoiceErrorResponse } from './helpers'

const logger = createLogger('backoffice-invoices-cancel')

export async function handleCancelInvoice(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const rawParams = c.req.param()
    const parsedParams = invoiceIdParamsSchema.safeParse(rawParams)
    if (!parsedParams.success) {
      const requestId = (c.get('request_id') as string | undefined) ?? null
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsedParams.error.issues[0]?.message ?? 'Invalid invoice ID',
          },
          request_id: requestId,
        },
        422
      )
    }

    const rawBody = await c.req.json()
    const parsedBody = cancelInvoiceBodySchema.safeParse(rawBody)
    if (!parsedBody.success) {
      const requestId = (c.get('request_id') as string | undefined) ?? null
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsedBody.error.issues[0]?.message ?? 'Invalid request body',
          },
          request_id: requestId,
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Cancel invoice request', {
      workspace_id: workspaceId,
      correlation_id: correlationId,
      invoice_id: parsedParams.data.id,
    })

    const invoice = await cancelInvoice(db, parsedParams.data.id, parsedBody.data.reason, audit)

    return c.json({ success: true, data: invoice, error: null }, 200)
  } catch (err) {
    return invoiceErrorResponse(c, err)
  }
}
