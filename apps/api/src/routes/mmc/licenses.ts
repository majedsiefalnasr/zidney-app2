/**
 * License API Routes Module
 *
 * File: apps/api/src/routes/mmc/licenses.ts
 * Task: T005
 *
 * Defines all 10 license management endpoints for MMC admin access.
 * Routes are wired into the main API router with middleware chain.
 */

import { Hono } from 'hono'
import { LicenseController } from '../../controllers/licenses.controller'

export function createLicenseRoutes(controller: LicenseController): Hono {
  const router = new Hono()

  // POST /v1/mmc/licenses - Create new license
  router.post('/licenses', (ctx) => controller.create(ctx as any))

  // GET /v1/mmc/licenses - List licenses with filters
  router.get('/licenses', (ctx) => controller.list(ctx as any))

  // GET /v1/mmc/licenses/:id - Get license details
  router.get('/licenses/:id', (ctx) => controller.getDetail(ctx as any))

  // PATCH /v1/mmc/licenses/:id - Edit license
  router.patch('/licenses/:id', (ctx) => controller.edit(ctx as any))

  // POST /v1/mmc/licenses/:id/soft-lock - Soft lock license
  router.post('/licenses/:id/soft-lock', (ctx) => controller.softLock(ctx as any))

  // POST /v1/mmc/licenses/:id/unlock - Unlock (restore from soft lock)
  router.post('/licenses/:id/unlock', (ctx) => controller.unlock(ctx as any))

  // POST /v1/mmc/licenses/:id/archive - Archive license
  router.post('/licenses/:id/archive', (ctx) => controller.archive(ctx as any))

  // POST /v1/mmc/licenses/:id/restore - Restore from archive
  router.post('/licenses/:id/restore', (ctx) => controller.restore(ctx as any))

  // DELETE /v1/mmc/licenses/:id - Delete license
  router.delete('/licenses/:id', (ctx) => controller.delete(ctx as any))

  // POST /v1/mmc/licenses/:id/retry-provisioning - Retry provisioning
  router.post('/licenses/:id/retry-provisioning', (ctx) =>
    controller.retryProvisioning(ctx as any)
  )

  return router
}

export default createLicenseRoutes
