/**
 * Product Validation Schemas
 *
 * Zod schemas for product validation across API layer
 * Handles: name, slug, modules, status validation
 *
 * Stage: STAGE_09_PRODUCTS
 * Trust Chain: Product → License → Workspace
 */

import { Module } from '@zidney/types/enums/Module'
import { ErrorCodes } from '@zidney/types/errors/ErrorCodes'
import { ProductStatus } from '@zidney/types/products/Product'
import { z } from 'zod'

/**
 * Localized name schema
 * Requires English, Arabic optional
 */
export const LocalizedNameSchema = z.object({
  en: z.string().min(1, 'English name is required').max(255, 'English name too long'),
  ar: z.string().max(255, 'Arabic name too long').optional(),
})

export type LocalizedName = z.infer<typeof LocalizedNameSchema>

/**
 * Slug validation schema
 * Lowercase alphanumeric with dashes
 * Format: ^[a-z0-9]+(-[a-z0-9]+)*$
 * Examples: my-product, product-1, mcq
 */
export const SlugSchema = z
  .string()
  .min(1, 'Slug is required')
  .max(255, 'Slug too long')
  .toLowerCase()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    'Slug must be lowercase alphanumeric with hyphens (no leading/trailing hyphens)'
  )

/**
 * Modules array schema
 * Must contain at least one valid module
 */
export const ModulesArraySchema = z
  .array(
    z.enum([
      Module.MCQ,
      Module.TRADITIONAL_EXAMS,
      Module.EXERCISES,
      Module.LIBRARY,
      Module.LIVES,
      Module.FORUM,
    ])
  )
  .min(1, 'At least one module is required')
  .max(6, 'Maximum 6 modules allowed')

export type ModulesArray = z.infer<typeof ModulesArraySchema>

/**
 * Product status schema
 */
export const ProductStatusSchema = z.enum([ProductStatus.ACTIVE, ProductStatus.INACTIVE])

/**
 * Create product request schema
 */
export const CreateProductSchema = z.object({
  name: LocalizedNameSchema,
  slug: SlugSchema,
  description: z.string().max(1000, 'Description too long').optional(),
  enabled_modules: ModulesArraySchema,
})

export type CreateProductInput = z.infer<typeof CreateProductSchema>

/**
 * Update product request schema
 * All fields optional (except product ID from URL)
 */
export const UpdateProductSchema = z.object({
  name: LocalizedNameSchema.optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  enabled_modules: ModulesArraySchema.optional(),
})

export type UpdateProductInput = z.infer<typeof UpdateProductSchema>

/**
 * Change product status request schema
 */
export const ChangeProductStatusSchema = z.object({
  status: ProductStatusSchema,
})

export type ChangeProductStatusInput = z.infer<typeof ChangeProductStatusSchema>

/**
 * Product query filters schema
 */
export const ProductQueryFiltersSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'all']).optional().default('ACTIVE'),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
})

export type ProductQueryFilters = z.infer<typeof ProductQueryFiltersSchema>

/**
 * Audit log query filters schema
 */
export const AuditLogQueryFiltersSchema = z.object({
  action: z.enum(['CREATE', 'UPDATE', 'STATUS_CHANGE']).optional(),
  from_date: z.coerce.date().optional(),
  to_date: z.coerce.date().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(20),
  offset: z.coerce.number().min(0).optional().default(0),
})

export type AuditLogQueryFilters = z.infer<typeof AuditLogQueryFiltersSchema>

/**
 * Validation function: Product name
 * Returns error if invalid, null if valid
 */
export function validateProductName(name: unknown): string | null {
  const result = LocalizedNameSchema.safeParse(name)
  if (!result.success) {
    return ErrorCodes.INVALID_NAME_LOCALIZATION
  }
  return null
}

/**
 * Validation function: Modules enum array
 * Returns error if invalid, null if valid
 */
export function validateModulesEnum(modules: unknown): string | null {
  const result = ModulesArraySchema.safeParse(modules)
  if (!result.success) {
    return ErrorCodes.INVALID_MODULE_ENUM
  }
  return null
}

/**
 * Validation function: Slug format
 * Returns error if invalid slug format, null if valid
 */
export function validateSlugFormat(slug: unknown): string | null {
  const result = SlugSchema.safeParse(slug)
  if (!result.success) {
    return ErrorCodes.INVALID_NAME_LOCALIZATION // Slug format error
  }
  return null
}

/**
 * Validation function: Slug immutability
 * Used when updating a product - slug cannot change
 */
export function validateSlugImmutable(
  originalSlug: string,
  updatedSlug: string | undefined
): string | null {
  if (updatedSlug && updatedSlug !== originalSlug) {
    return ErrorCodes.SLUG_NOT_MUTABLE
  }
  return null
}

/**
 * Get product name with fallback
 * Fallback from ar to en if ar not available
 */
export function getProductName(name: LocalizedName, lang: 'en' | 'ar' = 'en'): string {
  if (lang === 'ar') {
    return name.ar || name.en
  }
  return name.en
}

/**
 * Compute field diff for audit logging
 * Compares old and new product data, returns fields that changed
 */
export function computeFieldDiff(
  oldData: unknown,
  newData: unknown
): Record<string, { old: unknown; new: unknown }> {
  if (!oldData || !newData || typeof oldData !== 'object' || typeof newData !== 'object') {
    return {}
  }

  const diff: Record<string, { old: unknown; new: unknown }> = {}

  for (const key in newData) {
    if (Object.hasOwn(newData, key)) {
      const newVal = (newData as Record<string, unknown>)[key]
      const oldVal = (oldData as Record<string, unknown>)[key]

      // Skip if values are identical
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        diff[key] = { old: oldVal, new: newVal }
      }
    }
  }

  return diff
}

/**
 * Generate change summary from diff
 * Creates human-readable description of what changed
 */
export function generateChangeSummary(
  diff: Record<string, { old: unknown; new: unknown }>
): string {
  if (Object.keys(diff).length === 0) {
    return 'No changes'
  }

  const changes = Object.keys(diff)
    .map((field) => {
      const newVal = diff[field]?.new

      if (field === 'enabled_modules' && Array.isArray(newVal)) {
        const modules = (newVal as string[]).join(', ')
        return `Modules updated: ${modules}`
      }

      if (field === 'name' && typeof newVal === 'object') {
        const name = (newVal as Record<string, string>).en || JSON.stringify(newVal)
        return `Name updated: ${name}`
      }

      return `${field} updated`
    })
    .join('; ')

  return changes
}
