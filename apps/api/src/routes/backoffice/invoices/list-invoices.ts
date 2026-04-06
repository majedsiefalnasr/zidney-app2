/**
 * List Invoices — GET /invoices
 *
 * File: apps/api/src/routes/backoffice/invoices/list-invoices.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 */

import { listInvoicesService } from '@zidney/domain-core/billing'
import { createLogger } from '@zidney/logger'
import { listInvoicesQuerySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, invoiceErrorResponse } from './helpers'

const logger = createLogger('backoffice-invoices-list')

export async function handleListInvoices(c: Context) {
  try {
    const workspaceId: string = c.get('workspace_id')
    const correlationId: string = c.get('correlation_id')

    const rawQuery = c.req.query()
    const parsed = listInvoicesQuerySchema.safeParse(rawQuery)
    if (!parsed.success) {
      const requestId = (c.get('request_id') as string | undefined) ?? null
      return c.json(
        {
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid query',
          },
          request_id: requestId,
        },
        422
      )
    }

    const db = getDb(c)
    const audit = buildAuditCtx(c)

    logger.debug('List invoices request', {
      workspace_id: workspaceId,
      correlation_id: correlationId,
    })

    const result = await listInvoicesService(db, parsed.data, audit)

    return c.json({ success: true, data: result, error: null }, 200)
  } catch (err) {
    return invoiceErrorResponse(c, err)
  }
}
