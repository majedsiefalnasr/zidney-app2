/**
 * License API Controller
 *
 * File: apps/api/src/controllers/licenses.controller.ts
 * Tasks: T029-T034 (all 10 endpoints)
 *
 * Implements HTTP request/response handling for license endpoints.
 * Delegates business logic to LicenseService.
 * Returns RFC 7807 formatted error responses.
 */

import {
  DEFAULT_PAGE_SIZE,
  HTTP_STATUS_CREATED,
  MAX_PAGE_SIZE,
} from '@zidney/domain-core/licenses/constants'
import { LicenseError } from '@zidney/domain-core/licenses/errors'
import { LicenseService } from '@zidney/domain-core/licenses/service'
import {
  ArchiveRequest,
  CreateLicenseRequest,
  EditLicenseRequest,
  RestoreRequest,
  RetryProvisioningRequest,
  SoftLockRequest,
  UnlockRequest,
} from '@zidney/domain-core/licenses/types'
import { Context } from 'hono'
import { Logger } from 'pino'

interface LicenseContext extends Context {
  license?: any
  user?: any
  correlation_id?: string
}

export class LicenseController {
  constructor(
    private licenseService: LicenseService,
    private logger: Logger
  ) {}

  /**
   * T029: POST /v1/mmc/licenses - Create license
   *
   * Creates new license with status = PENDING_PROVISION.
   * Enqueues provisioning job asynchronously.
   * Response: 201 Created.
   */
  async create(ctx: LicenseContext) {
    try {
      const correlationId = ctx.correlation_id || 'unknown'
      const body = await ctx.req.json()

      // Validate required fields
      if (!body.product_id || !body.workspace_slug || !body.workspace_name) {
        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: 'VALIDATION_ERROR',
              message:
                'Missing required fields: product_id, workspace_slug, workspace_name',
              status: 400,
            },
          },
          400
        )
      }

      const license = await this.licenseService.create(
        body as CreateLicenseRequest,
        correlationId
      )

      return ctx.json(
        {
          success: true,
          data: license,
          error: null,
        },
        HTTP_STATUS_CREATED
      )
    } catch (error: any) {
      return this.handleError(ctx, error)
    }
  }

  /**
   * T030: GET /v1/mmc/licenses - List licenses
   *
   * Lists licenses with optional filters and pagination.
   * Response: 200 OK.
   */
  async list(ctx: LicenseContext) {
    try {
      // Parse query parameters
      const page = parseInt(ctx.req.query('page') || '1')
      const limit = Math.min(
        parseInt(ctx.req.query('limit') || String(DEFAULT_PAGE_SIZE)),
        MAX_PAGE_SIZE
      )
      const status = ctx.req.query('status')
      const product_id = ctx.req.query('product_id')
      const search = ctx.req.query('search')

      // Validate pagination
      if (page < 1 || limit < 1 || limit > MAX_PAGE_SIZE) {
        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: 'VALIDATION_ERROR',
              message: `Page must be >= 1, limit must be 1-${MAX_PAGE_SIZE}`,
              status: 400,
            },
          },
          400
        )
      }

      const result = await this.licenseService.list(
        {
          status: status as any,
          product_id,
          search,
        },
        { page, limit }
      )

      return ctx.json(
        {
          success: true,
          data: {
            licenses: result.items,
            pagination: {
              page: result.page,
              limit: limit,
              total: result.total,
              pages: result.pages,
            },
          },
          error: null,
        },
        200
      )
    } catch (error: any) {
      return this.handleError(ctx, error)
    }
  }

  /**
   * T031: GET /v1/mmc/licenses/:id - Get license details
   *
   * Fetches single license with full details.
   * Response: 200 OK or 404 Not Found.
   */
  async getDetail(ctx: LicenseContext) {
    try {
      const id = ctx.req.param('id')

      if (!id) {
        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'License ID required',
              status: 400,
            },
          },
          400
        )
      }

      const license = await this.licenseService.getById(id)

      return ctx.json(
        {
          success: true,
          data: license,
          error: null,
        },
        200
      )
    } catch (error: any) {
      return this.handleError(ctx, error)
    }
  }

  /**
   * T032: PATCH /v1/mmc/licenses/:id - Edit license
   *
   * Updates mutable fields only (rejects immutable fields).
   * Response: 200 OK or error.
   */
  async edit(ctx: LicenseContext) {
    try {
      const correlationId = ctx.correlation_id || 'unknown'
      const id = ctx.req.param('id')
      const body = await ctx.req.json()

      if (!id) {
        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'License ID required',
              status: 400,
            },
          },
          400
        )
      }

      const license = await this.licenseService.edit(
        id,
        body as EditLicenseRequest,
        correlationId
      )

      return ctx.json(
        {
          success: true,
          data: license,
          error: null,
        },
        200
      )
    } catch (error: any) {
      return this.handleError(ctx, error)
    }
  }

  /**
   * T033: POST /v1/mmc/licenses/:id/soft-lock - Soft lock license
   *
   * Transitions license from ACTIVE to SOFT_LOCKED.
   * Blocks workspace access with grace period.
   * Response: 200 OK or error.
   */
  async softLock(ctx: LicenseContext) {
    try {
      const correlationId = ctx.correlation_id || 'unknown'
      const id = ctx.req.param('id')
      const body = (await ctx.req.json()) || {}

      if (!id) {
        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'License ID required',
              status: 400,
            },
          },
          400
        )
      }

      const license = await this.licenseService.softLock(
        id,
        body as SoftLockRequest,
        correlationId
      )

      return ctx.json(
        {
          success: true,
          data: license,
          error: null,
        },
        200
      )
    } catch (error: any) {
      return this.handleError(ctx, error)
    }
  }

  /**
   * T033: POST /v1/mmc/licenses/:id/unlock - Unlock license
   *
   * Transitions license from SOFT_LOCKED to ACTIVE.
   * Restores workspace access.
   * Response: 200 OK or error.
   */
  async unlock(ctx: LicenseContext) {
    try {
      const correlationId = ctx.correlation_id || 'unknown'
      const id = ctx.req.param('id')
      const body = (await ctx.req.json()) || {}

      if (!id) {
        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'License ID required',
              status: 400,
            },
          },
          400
        )
      }

      const license = await this.licenseService.unlock(
        id,
        body as UnlockRequest,
        correlationId
      )

      return ctx.json(
        {
          success: true,
          data: license,
          error: null,
        },
        200
      )
    } catch (error: any) {
      return this.handleError(ctx, error)
    }
  }

  /**
   * T033: POST /v1/mmc/licenses/:id/archive - Archive license
   *
   * Transitions license from SOFT_LOCKED to ARCHIVED.
   * Triggers database snapshot job.
   * Response: 200 OK or error.
   */
  async archive(ctx: LicenseContext) {
    try {
      const correlationId = ctx.correlation_id || 'unknown'
      const id = ctx.req.param('id')
      const body = (await ctx.req.json()) || {}

      if (!id) {
        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'License ID required',
              status: 400,
            },
          },
          400
        )
      }

      const license = await this.licenseService.archive(
        id,
        body as ArchiveRequest,
        correlationId
      )

      return ctx.json(
        {
          success: true,
          data: license,
          error: null,
        },
        200
      )
    } catch (error: any) {
      return this.handleError(ctx, error)
    }
  }

  /**
   * T033: POST /v1/mmc/licenses/:id/restore - Restore from archive
   *
   * Transitions license from ARCHIVED to ACTIVE.
   * Triggers database restore job.
   * Response: 200 OK or error.
   */
  async restore(ctx: LicenseContext) {
    try {
      const correlationId = ctx.correlation_id || 'unknown'
      const id = ctx.req.param('id')
      const body = (await ctx.req.json()) || {}

      if (!id) {
        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'License ID required',
              status: 400,
            },
          },
          400
        )
      }

      const license = await this.licenseService.restore(
        id,
        body as RestoreRequest,
        correlationId
      )

      return ctx.json(
        {
          success: true,
          data: license,
          error: null,
        },
        200
      )
    } catch (error: any) {
      return this.handleError(ctx, error)
    }
  }

  /**
   * T033: DELETE /v1/mmc/licenses/:id - Delete license (terminal)
   *
   * Transitions license from ARCHIVED to DELETED.
   * Only allowed if license is ARCHIVED.
   * Response: 200 OK or error.
   */
  async delete(ctx: LicenseContext) {
    try {
      const correlationId = ctx.correlation_id || 'unknown'
      const id = ctx.req.param('id')

      if (!id) {
        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'License ID required',
              status: 400,
            },
          },
          400
        )
      }

      const license = await this.licenseService.delete(id, correlationId)

      return ctx.json(
        {
          success: true,
          data: license,
          error: null,
        },
        200
      )
    } catch (error: any) {
      return this.handleError(ctx, error)
    }
  }

  /**
   * T034: POST /v1/mmc/licenses/:id/retry-provisioning - Retry provisioning
   *
   * Retries provisioning for failed licenses.
   * Limited to PROVISION_FAILED status.
   * Enforces exponential backoff.
   * Response: 200 OK or error.
   */
  async retryProvisioning(ctx: LicenseContext) {
    try {
      const correlationId = ctx.correlation_id || 'unknown'
      const id = ctx.req.param('id')
      const body = (await ctx.req.json()) || {}

      if (!id) {
        return ctx.json(
          {
            success: false,
            data: null,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'License ID required',
              status: 400,
            },
          },
          400
        )
      }

      const license = await this.licenseService.retryProvisioning(
        id,
        body as RetryProvisioningRequest,
        correlationId
      )

      return ctx.json(
        {
          success: true,
          data: license,
          error: null,
        },
        200
      )
    } catch (error: any) {
      return this.handleError(ctx, error)
    }
  }

  /**
   * Error handler - converts business errors to RFC 7807 responses
   */
  private handleError(ctx: LicenseContext, error: any): Response {
    if (error instanceof LicenseError) {
      this.logger.warn({
        event: 'license_error',
        error_code: error.code,
        error_message: error.message,
      })

      return ctx.json(
        error.toResponse(),
        error.httpStatus as
          | 400
          | 401
          | 403
          | 404
          | 409
          | 423
          | 426
          | 429
          | 500
          | 503
      )
    }

    // Generic error
    this.logger.error({
      event: 'license_internal_error',
      error_message: error.message,
      error_stack: error.stack,
    })

    return ctx.json(
      {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          status: 500,
        },
      },
      500
    )
  }
}
