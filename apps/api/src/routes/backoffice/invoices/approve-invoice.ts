/**
 * Approve Invoice — POST /invoices/:id/approve
 *
 * File: apps/api/src/routes/backoffice/invoices/approve-invoice.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 *
 * Step 2 of two-step manual payment approval:
 *   Approve a PENDING invoice whose proof_file_id is already set.
 *   CAS PENDING→PAID, activate subscription, append audit log.
 */

import { verifyManualPayment } from '@zidney/domain-core/billing'
import { createLogger } from '@zidney/logger'
import { invoiceIdParamsSchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, invoiceErrorResponse } from './helpers'

const logger = createLogger('backoffice-invoices-approve')

export async function handleApproveInvoice(c: Context) {
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

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('Approve invoice request', {
      workspace_id: workspaceId,
      correlation_id: correlationId,
      invoice_id: parsedParams.data.id,
    })

    const invoice = await verifyManualPayment(db, parsedParams.data.id, audit)

    return c.json({ success: true, data: invoice, error: null }, 200)
  } catch (err) {
    return invoiceErrorResponse(c, err)
  }
}
