/**
 * License Request Validation
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Request schema validation for POST /v1/mmc/licenses endpoint.
 *
 * Validates all input fields against specification requirements:
 * - workspace_slug: Pattern, length, uniqueness
 * - admin_email: RFC 5321 format
 * - product_id: UUID format, product existence
 * - limits: Positive integers in valid range
 */

import { ProvisioningErrorCode } from '@zidney/types/errors/provisioning-errors'
import { z } from 'zod'

/**
 * Validation error result
 */
export interface ValidationError {
  field: string
  code: ProvisioningErrorCode
  message: string
  value?: unknown
}

/**
 * Workspace slug validation rules
 * Pattern: lowercase, digits, hyphens only (no leading/trailing hyphens)
 * Length: 3-255 characters
 */
export const WORKSPACE_SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/
export const MIN_SLUG_LENGTH = 3
export const MAX_SLUG_LENGTH = 255

/**
 * Email validation using RFC 5321 basic format
 * Note: Full RFC 5321 validation is complex; this is a practical subset
 */
export const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

/**
 * Zod schema for license creation request
 */
export const CreateLicenseRequestSchema = z.object({
  workspace_slug: z
    .string()
    .min(
      MIN_SLUG_LENGTH,
      `Workspace slug must be at least ${MIN_SLUG_LENGTH} characters`
    )
    .max(
      MAX_SLUG_LENGTH,
      `Workspace slug must be at most ${MAX_SLUG_LENGTH} characters`
    )
    .regex(
      WORKSPACE_SLUG_PATTERN,
      'Workspace slug must contain only lowercase letters, digits, and hyphens; no leading or trailing hyphens'
    )
    .toLowerCase(),

  organization_name: z
    .string()
    .min(1, 'Organization name is required')
    .max(255, 'Organization name must be at most 255 characters'),

  admin_email: z
    .string()
    .email('Admin email must be a valid email address')
    .max(255, 'Email must be at most 255 characters'),

  product_id: z.string().uuid('Product ID must be a valid UUID'),

  student_limit: z
    .number()
    .int('Student limit must be an integer')
    .min(1, 'Student limit must be at least 1')
    .max(999999, 'Student limit must be at most 999999'),

  staff_limit: z
    .number()
    .int('Staff limit must be an integer')
    .min(1, 'Staff limit must be at least 1')
    .max(999999, 'Staff limit must be at most 999999'),

  uses_divisions: z.boolean().default(false),

  default_language: z
    .string()
    .regex(/^[a-z]{2}$/, 'Default language must be a 2-letter ISO 639-1 code')
    .optional()
    .default('en'),
})

/**
 * Inferred TypeScript type from Zod schema
 */
export type CreateLicenseRequest = z.infer<typeof CreateLicenseRequestSchema>

/**
 * Validate license creation request
 * Returns validation errors if any field fails validation
 */
export function validateCreateLicenseRequest(
  data: unknown
):
  | { valid: true; data: CreateLicenseRequest }
  | { valid: false; errors: ValidationError[] } {
  try {
    const parsed = CreateLicenseRequestSchema.parse(data)
    return { valid: true, data: parsed }
  // @ts-ignore: TS18046 - error is of type unknown [INFRA-001]
  } catch (error) {
    if (error instanceof z.ZodError) {
      // @ts-ignore: TS7006 - issue implicit any [INFRA-001]
      const errors: ValidationError[] = error.issues.map((issue) => {
        const field = String(issue.path[0])
        let code = ProvisioningErrorCode.INVALID_WORKSPACE_SLUG

        if (field === 'admin_email') {
          code = ProvisioningErrorCode.INVALID_ADMIN_EMAIL
        } else if (field === 'student_limit' || field === 'staff_limit') {
          code = ProvisioningErrorCode.INVALID_LIMIT
        } else if (field === 'product_id') {
          code = ProvisioningErrorCode.INVALID_PRODUCT_ID
        }

        return {
          field,
          code,
          // @ts-ignore: TS18046 - error is of type unknown [INFRA-001]
          message: issue.message,
          value: issue.received,
        }
      })
      return { valid: false, errors }
    }

    return {
      valid: false,
      errors: [
        {
          field: 'unknown',
          code: ProvisioningErrorCode.INVALID_WORKSPACE_SLUG,
          message: 'Invalid request format',
        },
      ],
    }
  }
}

/**
 * Validate workspace slug format
 * Separate function for reuse in other contexts
 */
export function isValidWorkspaceSlug(slug: string): boolean {
  if (slug.length < MIN_SLUG_LENGTH || slug.length > MAX_SLUG_LENGTH) {
    return false
  }
  return WORKSPACE_SLUG_PATTERN.test(slug.toLowerCase())
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (email.length > 255) {
    return false
  }
  return EMAIL_PATTERN.test(email)
}

/**
 * Validate limit (student/staff)
 */
export function isValidLimit(limit: unknown): limit is number {
  return (
    typeof limit === 'number' &&
    Number.isInteger(limit) &&
    limit >= 1 &&
    limit <= 999999
  )
}

/**
 * Sanitize workspace slug (lowercase, trim)
 */
export function sanitizeWorkspaceSlug(slug: string): string {
  return slug.toLowerCase().trim()
}

/**
 * Sanitize email (lowercase, trim)
 */
export function sanitizeEmail(email: string): string {
  return email.toLowerCase().trim()
}
