/**
 * License Validation Schemas
 *
 * File: packages/validation/src/licenses/schemas.ts
 * Tasks: T086-T089
 *
 * Zod validation schemas for license domain.
 * Used by API controllers for request validation.
 */

import { z } from 'zod'

/**
 * T086: Workspace slug validation schema
 */
const WorkspaceSlugSchema = z
  .string()
  .min(3, 'Slug must be at least 3 characters')
  .max(64, 'Slug must be at most 64 characters')
  .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and dashes')
  .transform((val: string) => val.toLowerCase())

/**
 * T087: Limit validation schema
 */
const LimitSchema = z
  .union([z.number().int().min(0, 'Limit must be 0 or greater'), z.null()])
  .optional()

/**
 * T088: Language code validation
 */
const LanguageCodeSchema = z
  .enum(['en', 'ar', 'fr', 'de', 'es', 'pt', 'ru', 'zh', 'ja', 'ko'])
  .default('en')

/**
 * T089: Create License Request Schema
 */
export const CreateLicenseRequestSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  workspace_slug: WorkspaceSlugSchema,
  workspace_name: z.string().min(1, 'Workspace name required').max(255, 'Workspace name too long'),
  student_limit: LimitSchema,
  staff_limit: LimitSchema,
  use_zidney_payment: z.boolean().default(false).optional(),
  commission_per_user: z.number().min(0, 'Commission must be non-negative').optional(),
  default_language: LanguageCodeSchema.optional(),
  uses_divisions: z.boolean().default(false).optional(),
})

export type CreateLicenseRequestType = z.infer<typeof CreateLicenseRequestSchema>

/**
 * T089: Edit License Request Schema
 */
export const EditLicenseRequestSchema = z.object({
  student_limit: LimitSchema,
  staff_limit: LimitSchema,
  commission_per_user: z.number().min(0, 'Commission must be non-negative').optional(),
  use_zidney_payment: z.boolean().optional(),
  default_language: LanguageCodeSchema.optional(),
  uses_divisions: z.boolean().optional(),
})

export type EditLicenseRequestType = z.infer<typeof EditLicenseRequestSchema>

/**
 * T089: Soft Lock Request Schema
 */
export const SoftLockRequestSchema = z.object({
  grace_period_days: z
    .number()
    .int()
    .min(1, 'Grace period must be at least 1 day')
    .max(365, 'Grace period must be at most 365 days')
    .default(90)
    .optional(),
  reason: z.string().optional(),
})

export type SoftLockRequestType = z.infer<typeof SoftLockRequestSchema>

/**
 * T089: Unlock Request Schema
 */
export const UnlockRequestSchema = z.object({
  reason: z.string().optional(),
})

export type UnlockRequestType = z.infer<typeof UnlockRequestSchema>

/**
 * T089: Archive Request Schema
 */
export const ArchiveRequestSchema = z.object({
  reason: z.string().optional(),
})

export type ArchiveRequestType = z.infer<typeof ArchiveRequestSchema>

/**
 * T089: Restore Request Schema
 */
export const RestoreRequestSchema = z.object({
  reason: z.string().optional(),
})

export type RestoreRequestType = z.infer<typeof RestoreRequestSchema>

/**
 * T089: Delete Request Schema
 */
export const DeleteRequestSchema = z.object({
  reason: z.string().optional(),
})

export type DeleteRequestType = z.infer<typeof DeleteRequestSchema>

/**
 * T089: Retry Provisioning Request Schema
 */
export const RetryProvisioningRequestSchema = z.object({
  reason: z.string().optional(),
})

export type RetryProvisioningRequestType = z.infer<typeof RetryProvisioningRequestSchema>

/**
 * T090: RFC 7807 Error Response Formatter
 */
export interface RFC7807Error {
  type: string // Error code
  title: string // Short description
  status: number // HTTP status
  detail: string // Detailed message
  instance?: string // Correlation ID
  code?: string // Additional code
}

export function createErrorResponse(
  code: string,
  title: string,
  status: number,
  detail: string,
  instance?: string
): {
  success: false
  data: null
  error: RFC7807Error
} {
  return {
    success: false,
    data: null,
    error: {
      type: code,
      title,
      status,
      detail,
      instance,
      code,
    },
  }
}

/**
 * Validate request with schema and throw formatted error
 */
export async function validateRequest<T>(
  schema: { parse(data: unknown): T },
  data: unknown
): Promise<T> {
  try {
    return schema.parse(data)
  } catch (error: unknown) {
    // Duck-type ZodError: has issues array (avoids named import across Zod versions)
    if (
      error !== null &&
      typeof error === 'object' &&
      Array.isArray((error as Record<string, unknown>).issues)
    ) {
      const zodErr = error as {
        issues: Array<{ path: (string | number)[]; message: string }>
      }
      const issues = zodErr.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }))

      throw new ValidationError('Request validation failed', 400, issues)
    }
    throw error
  }
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown[]
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}
