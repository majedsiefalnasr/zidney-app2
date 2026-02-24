/**
 * Products Service Logger
 *
 * Specialized logger for products management operations.
 * Used throughout domain layer and API layer for structured logging.
 *
 * Stage: STAGE_09_PRODUCTS
 * Service: Logger configured for 'products' service
 */

import { createLogger, type Logger } from './logger'

/**
 * Create products logger instance
 * Used for all logging in products domain and API operations
 */
export const productsLogger: Logger = createLogger('products')

/**
 * Log product creation
 */
export function logProductCreation(
  productId: string,
  slug: string,
  modules: string[],
  context?: Record<string, unknown>
) {
  productsLogger.info('product_created', {
    product_id: productId,
    slug,
    modules,
    ...context,
  })
}

/**
 * Log product update
 */
export function logProductUpdate(
  productId: string,
  oldVersion: number,
  newVersion: number,
  context?: Record<string, unknown>
) {
  productsLogger.info('product_updated', {
    product_id: productId,
    old_version: oldVersion,
    new_version: newVersion,
    ...context,
  })
}

/**
 * Log product status change
 */
export function logProductStatusChange(
  productId: string,
  oldStatus: string,
  newStatus: string,
  context?: Record<string, unknown>
) {
  productsLogger.info('product_status_changed', {
    product_id: productId,
    old_status: oldStatus,
    new_status: newStatus,
    ...context,
  })
}

/**
 * Log product deletion
 */
export function logProductDeletion(
  productId: string,
  slug: string,
  context?: Record<string, unknown>
) {
  productsLogger.info('product_deleted', {
    product_id: productId,
    slug,
    ...context,
  })
}

/**
 * Log error in products service
 */
export function logProductError(
  errorCode: string,
  message: string,
  context?: Record<string, unknown>
) {
  productsLogger.error('product_error', {
    error_code: errorCode,
    error_message: message,
    ...context,
  })
}

/**
 * Log slow operation
 */
export function logSlowOperation(
  operation: string,
  durationMs: number,
  context?: Record<string, unknown>
) {
  if (durationMs > 500) {
    productsLogger.warn('slow_operation', {
      operation,
      duration_ms: durationMs,
      ...context,
    })
  } else {
    productsLogger.debug('operation_duration', {
      operation,
      duration_ms: durationMs,
      ...context,
    })
  }
}

/**
 * Export logger for direct use
 */
export { Logger } from './logger'
export type { LogContext } from './types'
