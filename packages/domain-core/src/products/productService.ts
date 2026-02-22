/**
 * Product Service - Domain Layer
 *
 * Core business logic for product management.
 * Handles product CRUD operations, versioning, audit logging, and validation.
 *
 * Stage: STAGE_09_PRODUCTS
 * Phase: 3 - Domain Layer – Services & Validation
 * Tasks: T013-T027
 *
 * Key Guarantees:
 * - All operations are atomic (all-or-nothing transactions)
 * - Version history is immutable and append-only
 * - Audit trail is immutable and append-only
 * - Server time is authoritative
 * - Slug is immutable after creation
 */

import { logProductError, logSlowOperation } from '@zidney/logging/products'
import { AppError, ErrorCodes } from '@zidney/types/errors/ErrorCodes'
import {
  AuditAction,
  AuditLogQueryFilters,
  CreateProductInput,
  FieldDiff,
  PaginatedResponse,
  Product,
  ProductAuditLogEntry,
  ProductStatus,
  UpdateProductInput,
} from '@zidney/types/products/Product'
import {
  computeFieldDiff,
  generateChangeSummary,
} from '@zidney/validation/products/productValidation'
import { PoolClient } from 'pg'

/**
 * T013: Create product with initial version 1 and audit log
 *
 * Atomic transaction:
 * 1. Insert product with current_version = 1
 * 2. Insert product_versions record for version 1
 * 3. Insert product_audit_logs record with action=CREATE
 *
 * Returns: Created Product with current_version = 1
 */
export async function createProduct(
  client: PoolClient,
  input: CreateProductInput,
  performedBy: string
): Promise<Product> {
  const startTime = Date.now()

  try {
    await client.query('BEGIN')

    // 1. INSERT product
    const productResult = await client.query(
      `INSERT INTO products (name, slug, description, enabled_modules, status, current_version)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, slug, description, enabled_modules, status, current_version, created_at, updated_at`,
      [
        JSON.stringify(input.name),
        input.slug,
        input.description || null,
        JSON.stringify(input.enabled_modules),
        'ACTIVE',
        1,
      ]
    )

    if (productResult.rows.length === 0) {
      throw new AppError(
        ErrorCodes.INTERNAL_SERVER_ERROR,
        'Failed to create product'
      )
    }

    const product = productResult.rows[0]
    const productId = product.id

    // 2. INSERT product_versions for version 1
    await client.query(
      `INSERT INTO product_versions (product_id, version_number, name, enabled_modules, description, change_summary, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        productId,
        1,
        JSON.stringify(input.name),
        JSON.stringify(input.enabled_modules),
        input.description || null,
        'Initial version',
      ]
    )

    // 3. INSERT product_audit_logs (CREATE action)
    const changedFields: FieldDiff = {
      name: { old: null, new: input.name },
      enabled_modules: { old: null, new: input.enabled_modules },
      slug: { old: null, new: input.slug },
      ...(input.description && {
        description: { old: null, new: input.description },
      }),
    }

    await client.query(
      `INSERT INTO product_audit_logs (product_id, action, previous_version, new_version, changed_fields, performed_by, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        productId,
        AuditAction.CREATE,
        null,
        1,
        JSON.stringify(changedFields),
        performedBy,
      ]
    )

    await client.query('COMMIT')

    // Return product as Product type
    return {
      id: productId,
      name: input.name,
      slug: input.slug,
      description: input.description,
      enabled_modules: input.enabled_modules,
      status: ProductStatus.ACTIVE,
      current_version: 1,
      created_at: new Date(product.created_at),
      updated_at: new Date(product.updated_at),
    }
  } catch (error) {
    await client.query('ROLLBACK')
    if (error instanceof AppError) throw error

    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    if (errorMsg.includes('duplicate')) {
      logProductError(ErrorCodes.DUPLICATE_SLUG, 'Slug already exists', {
        slug: input.slug,
      })
      throw new AppError(
        ErrorCodes.DUPLICATE_SLUG,
        'Product slug already exists'
      )
    }

    logProductError(ErrorCodes.INTERNAL_SERVER_ERROR, errorMsg)
    throw new AppError(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      'Failed to create product'
    )
  } finally {
    const duration = Date.now() - startTime
    logSlowOperation('createProduct', duration)
  }
}

/**
 * T014: Update product with automatic version increment if changes detected
 *
 * Atomic transaction:
 * 1. Fetch current product version
 * 2. Detect if actual changes exist
 * 3. If NO changes: return current product unchanged
 * 4. If changes: insert new version, update product, insert audit log
 *
 * Returns: Updated Product with potentially incremented current_version
 */
export async function updateProduct(
  client: PoolClient,
  productId: string,
  input: UpdateProductInput,
  performedBy: string
): Promise<Product> {
  const startTime = Date.now()

  try {
    await client.query('BEGIN')

    // Fetch current product
    const currentResult = await client.query(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    )
    if (currentResult.rows.length === 0) {
      throw new AppError(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found')
    }

    const current = currentResult.rows[0]
    const oldVersion = current.current_version

    // Build update data (only provided fields)
    const updateData = {
      name: input.name || current.name,
      description:
        input.description !== undefined
          ? input.description
          : current.description,
      enabled_modules: input.enabled_modules || current.enabled_modules,
    }

    // Compute diff
    const diff = computeFieldDiff(
      {
        name: current.name,
        description: current.description,
        enabled_modules: current.enabled_modules,
      },
      updateData
    )

    // If no changes, return current product unchanged
    if (Object.keys(diff).length === 0) {
      await client.query('COMMIT')
      return {
        id: productId,
        name: current.name,
        slug: current.slug,
        description: current.description,
        enabled_modules: current.enabled_modules,
        status: current.status,
        current_version: current.current_version,
        created_at: new Date(current.created_at),
        updated_at: new Date(current.updated_at),
      }
    }

    // Changes detected: increment version
    const newVersion = oldVersion + 1
    const changeSummary = generateChangeSummary(diff)

    // 1. INSERT new version record
    await client.query(
      `INSERT INTO product_versions (product_id, version_number, name, enabled_modules, description, change_summary, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        productId,
        newVersion,
        JSON.stringify(updateData.name),
        JSON.stringify(updateData.enabled_modules),
        updateData.description || null,
        changeSummary,
      ]
    )

    // 2. UPDATE product
    const updateResult = await client.query(
      `UPDATE products 
       SET name = $1, description = $2, enabled_modules = $3, current_version = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        JSON.stringify(updateData.name),
        updateData.description || null,
        JSON.stringify(updateData.enabled_modules),
        newVersion,
        productId,
      ]
    )

    const updated = updateResult.rows[0]

    // 3. INSERT audit log
    await client.query(
      `INSERT INTO product_audit_logs (product_id, action, previous_version, new_version, changed_fields, performed_by, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        productId,
        AuditAction.UPDATE,
        oldVersion,
        newVersion,
        JSON.stringify(diff),
        performedBy,
      ]
    )

    await client.query('COMMIT')

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      enabled_modules: updated.enabled_modules,
      status: updated.status,
      current_version: updated.current_version,
      created_at: new Date(updated.created_at),
      updated_at: new Date(updated.updated_at),
    }
  } catch (error) {
    await client.query('ROLLBACK')
    if (error instanceof AppError) throw error

    logProductError(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new AppError(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      'Failed to update product'
    )
  } finally {
    const duration = Date.now() - startTime
    logSlowOperation('updateProduct', duration)
  }
}

/**
 * T015: Change product status (ACTIVE ↔ INACTIVE)
 *
 * Atomic transaction:
 * 1. Update product status (does NOT increment version)
 * 2. Insert audit log with action=STATUS_CHANGE (no version numbers)
 *
 * Returns: Updated Product with same current_version
 */
export async function changeProductStatus(
  client: PoolClient,
  productId: string,
  newStatus: ProductStatus,
  performedBy: string
): Promise<Product> {
  const startTime = Date.now()

  try {
    await client.query('BEGIN')

    // Fetch current product
    const currentResult = await client.query(
      'SELECT * FROM products WHERE id = $1',
      [productId]
    )
    if (currentResult.rows.length === 0) {
      throw new AppError(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found')
    }

    const current = currentResult.rows[0]
    const oldStatus = current.status

    // 1. UPDATE product status (no version increment)
    const updateResult = await client.query(
      `UPDATE products 
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [newStatus, productId]
    )

    const updated = updateResult.rows[0]

    // 2. INSERT audit log (STATUS_CHANGE has no version numbers)
    const changedFields: FieldDiff = {
      status: { old: oldStatus, new: newStatus },
    }

    await client.query(
      `INSERT INTO product_audit_logs (product_id, action, previous_version, new_version, changed_fields, performed_by, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [
        productId,
        AuditAction.STATUS_CHANGE,
        null,
        null,
        JSON.stringify(changedFields),
        performedBy,
      ]
    )

    await client.query('COMMIT')

    return {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      description: updated.description,
      enabled_modules: updated.enabled_modules,
      status: updated.status,
      current_version: updated.current_version,
      created_at: new Date(updated.created_at),
      updated_at: new Date(updated.updated_at),
    }
  } catch (error) {
    await client.query('ROLLBACK')
    if (error instanceof AppError) throw error

    logProductError(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new AppError(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      'Failed to change product status'
    )
  } finally {
    const duration = Date.now() - startTime
    logSlowOperation('changeProductStatus', duration)
  }
}

/**
 * T016: Get product by ID
 *
 * Returns: Product or AppError if not found
 */
export async function getProductById(
  client: PoolClient,
  productId: string
): Promise<Product> {
  const result = await client.query('SELECT * FROM products WHERE id = $1', [
    productId,
  ])
  if (result.rows.length === 0) {
    throw new AppError(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found')
  }

  const row = result.rows[0]
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    enabled_modules: row.enabled_modules,
    status: row.status,
    current_version: row.current_version,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }
}

/**
 * T017: Get product by slug
 *
 * Returns: Product or AppError if not found
 */
export async function getProductBySlug(
  client: PoolClient,
  slug: string
): Promise<Product> {
  const result = await client.query('SELECT * FROM products WHERE slug = $1', [
    slug,
  ])
  if (result.rows.length === 0) {
    throw new AppError(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found')
  }

  const row = result.rows[0]
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    enabled_modules: row.enabled_modules,
    status: row.status,
    current_version: row.current_version,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }
}

/**
 * T018: List products with filtering and pagination
 *
 * Filters:
 * - status: 'ACTIVE' (default), 'INACTIVE', or 'all'
 * - search: Search by name (en/ar) and slug
 * - limit: 1-100, default 20
 * - offset: default 0
 *
 * Returns: PaginatedResponse<Product>
 */
export async function listProducts(
  client: PoolClient,
  filters: {
    status?: 'ACTIVE' | 'INACTIVE' | 'all'
    search?: string
    limit?: number
    offset?: number
  } = {}
): Promise<PaginatedResponse<Product>> {
  const status = filters.status || 'ACTIVE'
  const limit = Math.min(filters.limit || 20, 100)
  const offset = filters.offset || 0
  const search = filters.search?.trim() || ''

  // Build WHERE clause
  const conditions: string[] = []
  const params: unknown[] = []

  if (status !== 'all') {
    conditions.push(`status = $${params.length + 1}`)
    params.push(status)
  }

  if (search) {
    const searchTerm = `%${search}%`
    conditions.push(
      `(name->>'en' ILIKE $${params.length + 1} OR name->>'ar' ILIKE $${params.length + 2} OR slug ILIKE $${params.length + 3})`
    )
    params.push(searchTerm, searchTerm, searchTerm)
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM products ${whereClause}`,
    params
  )
  const total = parseInt(countResult.rows[0].total, 10)

  // Get paginated results
  params.push(limit, offset)
  const result = await client.query(
    `SELECT * FROM products ${whereClause} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  const items = result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    enabled_modules: row.enabled_modules,
    status: row.status,
    current_version: row.current_version,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }))

  return {
    items,
    total,
    limit,
    offset,
    has_more: offset + items.length < total,
  }
}

/**
 * T019: Delete product (with cascade)
 *
 * Checks for existing licenses before deletion.
 * If licenses exist: throws 409 PRODUCT_HAS_LICENSES error.
 *
 * Atomic transaction:
 * 1. Check for licenses
 * 2. Delete audit logs
 * 3. Delete versions
 * 4. Delete product
 */
export async function deleteProduct(
  client: PoolClient,
  productId: string
): Promise<void> {
  try {
    await client.query('BEGIN')

    // Check for existing licenses (will be added in Stage 10)
    // For now, we just delete the product
    const result = await client.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [productId]
    )

    if (result.rows.length === 0) {
      throw new AppError(ErrorCodes.PRODUCT_NOT_FOUND, 'Product not found')
    }

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    if (error instanceof AppError) throw error

    logProductError(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      error instanceof Error ? error.message : 'Unknown error'
    )
    throw new AppError(
      ErrorCodes.INTERNAL_SERVER_ERROR,
      'Failed to delete product'
    )
  }
}

/**
 * T020: Get product audit log with pagination and filtering
 *
 * Filters:
 * - action: CREATE, UPDATE, or STATUS_CHANGE
 * - from_date: Filter by start date
 * - to_date: Filter by end date
 * - limit: 1-100, default 20
 * - offset: default 0
 *
 * Returns: PaginatedResponse<ProductAuditLogEntry>
 */
export async function getProductAuditLog(
  client: PoolClient,
  productId: string,
  filters: AuditLogQueryFilters = {}
): Promise<PaginatedResponse<ProductAuditLogEntry>> {
  const limit = Math.min(filters.limit || 20, 100)
  const offset = filters.offset || 0

  // Build WHERE clause
  const conditions = ['product_id = $1']
  const params: unknown[] = [productId]

  if (filters.action) {
    conditions.push(`action = $${params.length + 1}`)
    params.push(filters.action)
  }

  if (filters.from_date) {
    conditions.push(`timestamp >= $${params.length + 1}`)
    params.push(filters.from_date)
  }

  if (filters.to_date) {
    conditions.push(`timestamp <= $${params.length + 1}`)
    params.push(filters.to_date)
  }

  const whereClause = conditions.join(' AND ')

  // Get total count
  const countResult = await client.query(
    `SELECT COUNT(*) as total FROM product_audit_logs WHERE ${whereClause}`,
    params
  )
  const total = parseInt(countResult.rows[0].total, 10)

  // Get paginated results
  params.push(limit, offset)
  const result = await client.query(
    `SELECT * FROM product_audit_logs WHERE ${whereClause} ORDER BY timestamp DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  )

  const items: ProductAuditLogEntry[] = result.rows.map((row) => ({
    id: row.id,
    product_id: row.product_id,
    action: row.action,
    previous_version: row.previous_version,
    new_version: row.new_version,
    changed_fields: row.changed_fields,
    performed_by: row.performed_by,
    timestamp: new Date(row.timestamp),
  }))

  return {
    items,
    total,
    limit,
    offset,
    has_more: offset + items.length < total,
  }
}
