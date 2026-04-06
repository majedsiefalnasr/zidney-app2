/**
 * Upload Invoice Proof — POST /invoices/:id/proof
 *
 * File: apps/api/src/routes/backoffice/invoices/upload-proof.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 *
 * Step 1 of two-step manual payment approval:
 *   Upload / set the proof_file_id on a PENDING invoice.
 *   After this, the invoice can be approved via POST /invoices/:id/approve.
 */

import { uploadInvoiceProof } from '@zidney/domain-core/billing'
import { createLogger } from '@zidney/logger'
import { invoiceIdParamsSchema, uploadProofBodySchema } from '@zidney/validation'
import type { Context } from 'hono'

import { buildAuditCtx, getDb, invoiceErrorResponse } from './helpers'

const logger = createLogger('backoffice-invoices-upload-proof')

export async function handleUploadProof(c: Context) {
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
    const parsedBody = uploadProofBodySchema.safeParse(rawBody)
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

    logger.debug('Upload invoice proof request', {
      workspace_id: workspaceId,
      correlation_id: correlationId,
      invoice_id: parsedParams.data.id,
    })

    const invoice = await uploadInvoiceProof(
      db,
      parsedParams.data.id,
      parsedBody.data.proof_file_id,
      audit
    )

    return c.json({ success: true, data: invoice, error: null }, 200)
  } catch (err) {
    return invoiceErrorResponse(c, err)
  }
}
