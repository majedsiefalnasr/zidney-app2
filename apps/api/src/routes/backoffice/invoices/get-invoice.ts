/**
 * Get Invoice — GET /invoices/:id
 *
 * File: apps/api/src/routes/backoffice/invoices/get-invoice.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 */

import { getInvoiceByIdService } from '@zidney/domain-core/billing'
import { createLogger } from '@zidney/logger'
import { invoiceIdParamsSchema } from '@zidney/validation'
import type { Context } from 'hono'

import { getDb, invoiceErrorResponse } from './helpers'

const logger = createLogger('backoffice-invoices-get')

export async function handleGetInvoice(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const rawParams = c.req.param()
    const parsed = invoiceIdParamsSchema.safeParse(rawParams)
    if (!parsed.success) {
      const requestId = (c.get('request_id') as string | undefined) ?? null
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid invoice ID',
          },
          request_id: requestId,
        },
        422
      )
    }

    const db = getDb(c)

    logger.debug('Get invoice request', {
      workspace_id: workspaceId,
      correlation_id: correlationId,
      invoice_id: parsed.data.id,
    })

    const invoice = await getInvoiceByIdService(db, parsed.data.id)

    return c.json({ success: true, data: invoice, error: null }, 200)
  } catch (err) {
    return invoiceErrorResponse(c, err)
  }
}
