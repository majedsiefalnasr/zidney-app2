/**
 * Invoices Router — Index
 *
 * File: apps/api/src/routes/backoffice/invoices/index.ts
 * Stage: STAGE_46_BILLING_AND_INVOICES
 *
 * Combines all invoice route handlers into a single Hono router.
 * Mounted at /api/v1/backoffice/workspace in app.ts via:
 *   app.route('/api/v1/backoffice/workspace', invoicesRouter)
 *
 * Middleware chain inherited from the backoffice group (app.ts):
 *   correlationId → tenantResolver → licenseEnforcement → schemaVersion
 *   → rateLimit → authentication
 *
 * Full route table:
 *   GET    /invoices                 list      INVOICES.can_view
 *   POST   /invoices                 create    INVOICES.can_create
 *   GET    /invoices/:id             detail    INVOICES.can_view
 *   POST   /invoices/:id/proof       upload    INVOICES.can_edit
 *   POST   /invoices/:id/approve     approve   INVOICES.can_edit
 *   PATCH  /invoices/:id/cancel      cancel    INVOICES.can_edit
 *
 * Constitutional Compliance:
 * ✓ No business logic — delegates to handler functions
 * ✓ All middleware inherited from backoffice group
 * ✓ Per-route RBAC guards enforce permission checks
 */

import { PermissionModule } from '@zidney/domain-core/rbac'
import { createLogger } from '@zidney/logger'
import { Hono } from 'hono'

import { createPermissionGuard } from '../../../middleware/backoffice-permission-guard-v2'
import type { BackofficeEnv } from '../types'
import { handleApproveInvoice } from './approve-invoice'
import { handleCancelInvoice } from './cancel-invoice'
import { handleCreateInvoice } from './create-invoice'
import { handleGetInvoice } from './get-invoice'
import { handleListInvoices } from './list-invoices'
import { handleUploadProof } from './upload-proof'

const logger = createLogger('backoffice-invoices')

export const invoicesRouter = new Hono<BackofficeEnv>()

// ---------------------------------------------------------------------------
// List invoices
// ---------------------------------------------------------------------------

invoicesRouter.get(
  '/invoices',
  createPermissionGuard(logger, PermissionModule.INVOICES, 'can_view'),
  handleListInvoices
)

// ---------------------------------------------------------------------------
// Create invoice
// ---------------------------------------------------------------------------

invoicesRouter.post(
  '/invoices',
  createPermissionGuard(logger, PermissionModule.INVOICES, 'can_create'),
  handleCreateInvoice
)

// ---------------------------------------------------------------------------
// Get invoice by ID
// ---------------------------------------------------------------------------

invoicesRouter.get(
  '/invoices/:id',
  createPermissionGuard(logger, PermissionModule.INVOICES, 'can_view'),
  handleGetInvoice
)

// ---------------------------------------------------------------------------
// Upload proof of payment (Step 1 of manual approval)
// ---------------------------------------------------------------------------

invoicesRouter.post(
  '/invoices/:id/proof',
  createPermissionGuard(logger, PermissionModule.INVOICES, 'can_edit'),
  handleUploadProof
)

// ---------------------------------------------------------------------------
// Approve invoice (Step 2 of manual approval — CAS PENDING→PAID)
// ---------------------------------------------------------------------------

invoicesRouter.post(
  '/invoices/:id/approve',
  createPermissionGuard(logger, PermissionModule.INVOICES, 'can_edit'),
  handleApproveInvoice
)

// ---------------------------------------------------------------------------
// Cancel invoice
// ---------------------------------------------------------------------------

invoicesRouter.patch(
  '/invoices/:id/cancel',
  createPermissionGuard(logger, PermissionModule.INVOICES, 'can_edit'),
  handleCancelInvoice
)
