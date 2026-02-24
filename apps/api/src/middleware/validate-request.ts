/**
 * Request Validation Middleware
 * Stage: STAGE_12_PROVISIONING_TRIGGER
 *
 * Generic middleware for validating and parsing request bodies.
 * Supports Zod schemas and custom validators.
 *
 * Usage:
 *   app.post('/licenses', validateRequest(CreateLicenseRequestSchema), createLicenseHandler)
 */

import {
  ProvisioningErrorCode,
  getErrorDetails,
} from '@zidney/types/errors/provisioning-errors'
import { Context, Next } from 'hono'
import { z } from 'zod'
import { createErrorResponse } from './license-response'

/**
 * Validator function type
 */
export type ValidatorFn<T> = (data: unknown) => {
  valid: boolean
  data?: T
  errors?: Array<{ field: string; message: string }>
}

/**
 * Validation options
 */
export interface ValidationOptions {
  allowUnknownFields?: boolean
  coerce?: boolean
  parseJson?: boolean
}

/**
 * Create validation middleware for Zod schema
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
) {
  return async (c: Context, next: Next) => {
    try {
      // Parse request body
      let data: unknown

      if (options.parseJson !== false) {
        try {
          data = await c.req.json()
        } catch (error) {
          return c.json(
            createErrorResponse(
              'INVALID_REQUEST_BODY',
              'Request body is not valid JSON'
            ),
            { status: 400 }
          )
        }
      } else {
        data = c.req.body
      }

      // Validate schema
      const result = schema.safeParse(data)

      if (!result.success) {
        const errors: Record<string, string> = {}
        for (const issue of result.error.issues) {
          const field = String(issue.path[0] || 'unknown')
          errors[field] = issue.message
        }

        return c.json(
          createErrorResponse(
            'VALIDATION_ERROR',
            'Request validation failed',
            errors
          ),
          { status: 400 }
        )
      }

      // Attach validated data to context
      c.set('validatedData', result.data)
      await next()
    } catch (error) {
      return c.json(
        createErrorResponse('VALIDATION_ERROR', 'Request validation failed'),
        { status: 400 }
      )
    }
  }
}

/**
 * Custom validator middleware factory
 */
export function createCustomValidator<T>(
  validator: ValidatorFn<T>,
  fieldMapping?: Record<string, ProvisioningErrorCode>
) {
  return async (c: Context, next: Next) => {
    try {
      const data = await c.req.json()
      const result = validator(data)

      if (!result.valid) {
        const firstError = result.errors?.[0]
        const errorCode =
          (firstError && fieldMapping?.[firstError.field]) ||
          ProvisioningErrorCode.INVALID_WORKSPACE_SLUG
        const errorDetails = getErrorDetails(errorCode)

        return c.json(
          createErrorResponse(
            errorCode,
            firstError?.message || errorDetails.message,
            result.errors?.reduce(
              (acc, err) => {
                acc[err.field] = err.message
                return acc
              },
              {} as Record<string, string>
            )
          ),
          { status: errorDetails.httpStatus }
        )
      }

      c.set('validatedData', result.data)
      await next()
    } catch (error) {
      return c.json(
        createErrorResponse('VALIDATION_ERROR', 'Request validation failed'),
        { status: 400 }
      )
    }
  }
}

/**
 * Get validated data from context
 */
export function getValidatedData<T>(c: Context): T {
  return c.get('validatedData') as T
}

/**
 * Validate request headers
 */
export function validateHeaders(
  headers: Record<string, string | string[]>,
  required: string[] = []
): { valid: boolean; missing?: string[] } {
  const missing: string[] = []

  for (const headerName of required) {
    const value = headers[headerName.toLowerCase()]
    if (!value) {
      missing.push(headerName)
    }
  }

  return {
    valid: missing.length === 0,
    missing: missing.length > 0 ? missing : undefined,
  }
}

/**
 * Required headers middleware
 */
export function requireHeaders(...headerNames: string[]) {
  return async (c: Context, next: Next) => {
    const headerMap: Record<string, string | string[]> = {}

    for (const [key, value] of Object.entries(c.req.header())) {
      headerMap[key.toLowerCase()] = value
    }

    const validation = validateHeaders(headerMap, headerNames)

    if (!validation.valid) {
      return c.json(
        createErrorResponse(
          'MISSING_HEADERS',
          `Missing required headers: ${validation.missing?.join(', ')}`
        ),
        { status: 400 }
      )
    }

    await next()
  }
}

/**
 * Content-Type validation middleware
 */
export function requireContentType(contentType: string) {
  return async (c: Context, next: Next) => {
    const header = c.req.header('content-type')
    if (!header || !header.includes(contentType)) {
      return c.json(
        createErrorResponse(
          'INVALID_CONTENT_TYPE',
          `Content-Type must be ${contentType}`
        ),
        { status: 400 }
      )
    }
    await next()
  }
}

/**
 * Request size limit middleware
 */
export function limitRequestSize(maxBytes: number) {
  return async (c: Context, next: Next) => {
    const contentLength = c.req.header('content-length')
    if (contentLength && parseInt(contentLength, 10) > maxBytes) {
      return c.json(
        createErrorResponse(
          'PAYLOAD_TOO_LARGE',
          `Request body exceeds maximum size of ${maxBytes} bytes`
        ),
        { status: 413 }
      )
    }
    await next()
  }
}
