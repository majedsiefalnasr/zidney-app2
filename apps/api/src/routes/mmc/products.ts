/**
 * Products API Routes
 *
 * All endpoints for product management (CRUD + audit log).
 * Implements stages 5-7 of API layer implementation.
 *
 * Stage: STAGE_09_PRODUCTS
 * Tasks: T033-T039
 *
 * Endpoints:
 * - GET /api/v1/mmc/products (list)
 * - GET /api/v1/mmc/products/:id (get single)
 * - GET /api/v1/mmc/products/:id/audit-log (audit trail)
 * - POST /api/v1/mmc/products (create)
 * - PUT /api/v1/mmc/products/:id (update)
 * - PATCH /api/v1/mmc/products/:id/status (change status)
 * - DELETE /api/v1/mmc/products/:id (delete)
 */

import { createLogger } from '@zidney/logging'
import { AppError, ErrorCodes } from '@zidney/types/errors/ErrorCodes'
import { ProductStatus } from '@zidney/types/products/Product'
import {
  AuditLogQueryFiltersSchema,
  ChangeProductStatusSchema,
  CreateProductSchema,
  ProductQueryFiltersSchema,
  UpdateProductSchema,
} from '@zidney/validation/products/productValidation'
import { Router, type Context } from 'hono'
import * as productService from '@zidney/domain-core/products/productService'
import { auditReadMiddleware } from '../../../middleware/auditReadMiddleware'
import { correlationIdMiddleware } from '../../../middleware/correlationIdMiddleware'
import { licenseMiddleware } from '../../../middleware/licenseMiddleware'
import { asyncHandler, handleError } from '../../../utils/errorHandler'
import {
  sendCreated,
  sendList,
  sendNoContent,
  sendSuccess,
} from '../../../utils/responseWrapper'

const logger = createLogger('api')
const router = new Router()

// ============================================================================
// T033: GET /api/v1/mmc/products - List products
// ============================================================================

router.get(
  '/products',
  correlationIdMiddleware,
  // authMiddleware would come here (already required by framework),
  licenseMiddleware,
  asyncHandler(async (c: Context) => {
    const correlationId = c.get('correlationId')
    const startTime = Date.now()

    try {
      // Parse and validate query parameters
      const query = c.req.query()
      const filters = ProductQueryFiltersSchema.parse({
        status: query.status,
        search: query.search,
        limit: query.limit,
        offset: query.offset,
      })

      // Get database client from context
      const client = c.get('dbClient')
      if (!client) {
        throw new AppError(
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Database context not available'
        )
      }

      // Call domain service
      const result = await productService.listProducts(client, filters)

      // Log successful operation
      logger.info('products_list_success', {
        correlation_id: correlationId,
        workspace_id: c.get('workspaceId'),
        user_id: c.get('userId'),
        count: result.items.length,
        total: result.total,
        duration_ms: Date.now() - startTime,
      })

      // Return paginated response
      return sendList(
        c,
        result.items,
        result.total,
        result.limit,
        result.offset
      )
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
              ErrorCodes.INTERNAL_SERVER_ERROR,
              error instanceof Error ? error.message : 'Unknown error'
            )
      return handleError(c, appError)
    }
  })
)

// ============================================================================
// T034: GET /api/v1/mmc/products/:id - Get single product
// ============================================================================

router.get(
  '/products/:id',
  correlationIdMiddleware,
  licenseMiddleware,
  asyncHandler(async (c: Context) => {
    const correlationId = c.get('correlationId')
    const productId = c.req.param('id')
    const startTime = Date.now()

    try {
      // Get database client
      const client = c.get('dbClient')
      if (!client) {
        throw new AppError(
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Database context not available'
        )
      }

      // Call domain service
      const product = await productService.getProductById(client, productId)

      // Log successful operation
      logger.info('product_get_success', {
        correlation_id: correlationId,
        product_id: productId,
        user_id: c.get('userId'),
        duration_ms: Date.now() - startTime,
      })

      return sendSuccess(c, product)
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
              ErrorCodes.INTERNAL_SERVER_ERROR,
              error instanceof Error ? error.message : 'Unknown error'
            )
      return handleError(c, appError)
    }
  })
)

// ============================================================================
// T035: GET /api/v1/mmc/products/:id/audit-log - Get audit log
// ============================================================================

router.get(
  '/products/:id/audit-log',
  correlationIdMiddleware,
  auditReadMiddleware,
  licenseMiddleware,
  asyncHandler(async (c: Context) => {
    const correlationId = c.get('correlationId')
    const productId = c.req.param('id')
    const startTime = Date.now()

    try {
      // Parse and validate query parameters
      const query = c.req.query()
      const filters = AuditLogQueryFiltersSchema.parse({
        action: query.action,
        from_date: query.from_date,
        to_date: query.to_date,
        limit: query.limit,
        offset: query.offset,
      })

      // Get database client
      const client = c.get('dbClient')
      if (!client) {
        throw new AppError(
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Database context not available'
        )
      }

      // Call domain service
      const result = await productService.getProductAuditLog(
        client,
        productId,
        filters
      )

      // Log successful operation
      logger.info('audit_log_get_success', {
        correlation_id: correlationId,
        product_id: productId,
        user_id: c.get('userId'),
        count: result.items.length,
        duration_ms: Date.now() - startTime,
      })

      return sendList(
        c,
        result.items,
        result.total,
        result.limit,
        result.offset
      )
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
              ErrorCodes.INTERNAL_SERVER_ERROR,
              error instanceof Error ? error.message : 'Unknown error'
            )
      return handleError(c, appError)
    }
  })
)

// ============================================================================
// T036: POST /api/v1/mmc/products - Create product
// ============================================================================

router.post(
  '/products',
  correlationIdMiddleware,
  licenseMiddleware,
  asyncHandler(async (c: Context) => {
    const correlationId = c.get('correlationId')
    const startTime = Date.now()

    try {
      // Parse and validate request body
      const body = await c.req.json()
      const input = CreateProductSchema.parse(body)

      // Get database client and user ID
      const client = c.get('dbClient')
      const userId = c.get('userId')

      if (!client || !userId) {
        throw new AppError(
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Context not available'
        )
      }

      // Call domain service
      const product = await productService.createProduct(client, input, userId)

      // Log successful creation
      logger.info('product_created_success', {
        correlation_id: correlationId,
        product_id: product.id,
        slug: product.slug,
        modules: product.enabled_modules,
        user_id: userId,
        workspace_id: c.get('workspaceId'),
        duration_ms: Date.now() - startTime,
      })

      return sendCreated(c, product)
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
              ErrorCodes.INTERNAL_SERVER_ERROR,
              error instanceof Error ? error.message : 'Unknown error'
            )
      return handleError(c, appError)
    }
  })
)

// ============================================================================
// T037: PUT /api/v1/mmc/products/:id - Update product
// ============================================================================

router.put(
  '/products/:id',
  correlationIdMiddleware,
  licenseMiddleware,
  asyncHandler(async (c: Context) => {
    const correlationId = c.get('correlationId')
    const productId = c.req.param('id')
    const startTime = Date.now()

    try {
      // Parse and validate request body
      const body = await c.req.json()
      const input = UpdateProductSchema.parse(body)

      // Get database client and user ID
      const client = c.get('dbClient')
      const userId = c.get('userId')

      if (!client || !userId) {
        throw new AppError(
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Context not available'
        )
      }

      // Call domain service
      const product = await productService.updateProduct(
        client,
        productId,
        input,
        userId
      )

      // Log successful update
      logger.info('product_updated_success', {
        correlation_id: correlationId,
        product_id: productId,
        version: product.current_version,
        user_id: userId,
        duration_ms: Date.now() - startTime,
      })

      return sendSuccess(c, product)
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
              ErrorCodes.INTERNAL_SERVER_ERROR,
              error instanceof Error ? error.message : 'Unknown error'
            )
      return handleError(c, appError)
    }
  })
)

// ============================================================================
// T038: PATCH /api/v1/mmc/products/:id/status - Change product status
// ============================================================================

router.patch(
  '/products/:id/status',
  correlationIdMiddleware,
  licenseMiddleware,
  asyncHandler(async (c: Context) => {
    const correlationId = c.get('correlationId')
    const productId = c.req.param('id')
    const startTime = Date.now()

    try {
      // Parse and validate request body
      const body = await c.req.json()
      const input = ChangeProductStatusSchema.parse(body)

      // Get database client and user ID
      const client = c.get('dbClient')
      const userId = c.get('userId')

      if (!client || !userId) {
        throw new AppError(
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Context not available'
        )
      }

      // Call domain service
      const product = await productService.changeProductStatus(
        client,
        productId,
        input.status as ProductStatus,
        userId
      )

      // Log successful status change
      logger.info('product_status_changed_success', {
        correlation_id: correlationId,
        product_id: productId,
        new_status: input.status,
        user_id: userId,
        duration_ms: Date.now() - startTime,
      })

      return sendSuccess(c, product)
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
              ErrorCodes.INTERNAL_SERVER_ERROR,
              error instanceof Error ? error.message : 'Unknown error'
            )
      return handleError(c, appError)
    }
  })
)

// ============================================================================
// T039: DELETE /api/v1/mmc/products/:id - Delete product
// ============================================================================

router.delete(
  '/products/:id',
  correlationIdMiddleware,
  licenseMiddleware,
  asyncHandler(async (c: Context) => {
    const correlationId = c.get('correlationId')
    const productId = c.req.param('id')
    const startTime = Date.now()

    try {
      // Get database client and user ID
      const client = c.get('dbClient')
      const userId = c.get('userId')

      if (!client || !userId) {
        throw new AppError(
          ErrorCodes.INTERNAL_SERVER_ERROR,
          'Context not available'
        )
      }

      // Call domain service to delete
      await productService.deleteProduct(client, productId)

      // Log successful deletion
      logger.info('product_deleted_success', {
        correlation_id: correlationId,
        product_id: productId,
        user_id: userId,
        duration_ms: Date.now() - startTime,
      })

      return sendNoContent(c)
    } catch (error) {
      const appError =
        error instanceof AppError
          ? error
          : new AppError(
              ErrorCodes.INTERNAL_SERVER_ERROR,
              error instanceof Error ? error.message : 'Unknown error'
            )
      return handleError(c, appError)
    }
  })
)

export { router as productsRouter }
