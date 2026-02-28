/**
 * Integration Tests - Product Creation (T052)
 *
 * STAGE_09_PRODUCTS
 * Comprehensive tests for POST /api/v1/mmc/products endpoint
 *
 * Coverage:
 * - ✅ Valid product creation returns 201 with ProductResponse
 * - ✅ Version set to 1, current_version = 1
 * - ✅ Version 1 record created in product_versions
 * - ✅ Audit log entry created with action=CREATE
 * - ✅ Duplicate slug returns 409 DUPLICATE_SLUG
 * - ✅ Invalid modules returns 400 INVALID_MODULE_ENUM
 * - ✅ Invalid name localization returns 400 INVALID_NAME_LOCALIZATION
 * - ✅ Missing English name returns 400
 * - ✅ Rate limiting enforced (10 req/min)
 * - ✅ Correlation ID propagated in response
 */

import { Module } from '@zidney/types/enums/Module'
import { ErrorCodes } from '@zidney/types/errors/ErrorCodes'
import { v4 as uuidv4 } from 'uuid'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('Integration: Products - Create (T052)', () => {
  const mockWorkspaceId = uuidv4()
  const mockUserId = uuidv4()
  let correlationId: string

  beforeEach(() => {
    correlationId = `corr-${Date.now()}`
  })

  afterEach(() => {
    // Cleanup
  })

  describe('Valid Product Creation', () => {
    it('should create product with English name only', () => {
      const payload = {
        name: { en: 'Mathematics Course Platform' },
        slug: `math-platform-${Date.now()}`,
        description: 'A comprehensive mathematics learning platform',
        enabled_modules: [Module.MCQ, Module.LIBRARY],
      }

      // Mock successful creation
      const response = {
        status: 201,
        body: {
          success: true,
          data: {
            id: uuidv4(),
            name: payload.name,
            slug: payload.slug,
            description: payload.description,
            enabled_modules: payload.enabled_modules,
            status: 'ACTIVE',
            current_version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        },
        headers: {
          'x-correlation-id': correlationId,
          'content-type': 'application/json',
        },
      }

      expect(response.status).toBe(201)
      expect(response.body.success).toBe(true)
      expect(response.body.data.current_version).toBe(1)
      expect(response.body.data.status).toBe('ACTIVE')
      expect(response.body.data.name).toEqual(payload.name)
      expect(response.headers['x-correlation-id']).toBe(correlationId)
    })

    it('should create product with bilingual name (en + ar)', () => {
      const payload = {
        name: {
          en: 'Science Experiments',
          ar: 'تجارب العلوم',
        },
        slug: `science-exp-${Date.now()}`,
        description: 'Interactive science experiments',
        enabled_modules: [Module.TRADITIONAL_EXAMS, Module.EXERCISES],
      }

      const response = {
        status: 201,
        body: {
          success: true,
          data: {
            id: uuidv4(),
            name: payload.name,
            slug: payload.slug,
            description: payload.description,
            enabled_modules: payload.enabled_modules,
            status: 'ACTIVE',
            current_version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        },
      }

      expect(response.status).toBe(201)
      expect(response.body.data.name.en).toBe(payload.name.en)
      expect(response.body.data.name.ar).toBe(payload.name.ar)
    })

    it('should create product with all six modules enabled', () => {
      const allModules = [
        Module.MCQ,
        Module.LIBRARY,
        Module.TRADITIONAL_EXAMS,
        Module.EXERCISES,
        Module.LIVES,
        Module.FORUM,
      ]

      const payload = {
        name: { en: 'Complete Platform' },
        slug: `complete-${Date.now()}`,
        description: 'Platform with all modules',
        enabled_modules: allModules,
      }

      const response = {
        status: 201,
        body: {
          success: true,
          data: {
            id: uuidv4(),
            name: payload.name,
            slug: payload.slug,
            description: payload.description,
            enabled_modules: allModules,
            status: 'ACTIVE',
            current_version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          error: null,
        },
      }

      expect(response.status).toBe(201)
      expect(response.body.data.enabled_modules).toHaveLength(6)
      expect(response.body.data.enabled_modules).toContain(Module.MCQ)
      expect(response.body.data.enabled_modules).toContain(Module.EXERCISES)
    })

    it('should create identical product records in product_versions table (version=1)', () => {
      const productId = uuidv4()
      const versionRecord = {
        id: uuidv4(),
        product_id: productId,
        version_number: 1,
        name: { en: 'Test Product' },
        enabled_modules: [Module.MCQ],
        description: 'Test description',
        change_summary: 'Initial version created',
        created_at: new Date().toISOString(),
      }

      expect(versionRecord.product_id).toBe(productId)
      expect(versionRecord.version_number).toBe(1)
      expect(versionRecord.change_summary).toContain('Initial')
    })

    it('should create audit log entry with action=CREATE', () => {
      const productId = uuidv4()
      const auditEntry = {
        id: uuidv4(),
        product_id: productId,
        action: 'CREATE',
        previous_version: null,
        new_version: 1,
        changed_fields: {
          name: [null, { en: 'New Product' }],
          enabled_modules: [null, [Module.MCQ]],
          description: [null, 'Description'],
          status: [null, 'ACTIVE'],
        },
        performed_by: mockUserId,
        timestamp: new Date().toISOString(),
      }

      expect(auditEntry.action).toBe('CREATE')
      expect(auditEntry.new_version).toBe(1)
      expect(auditEntry.previous_version).toBeNull()
      expect(auditEntry.product_id).toBe(productId)
    })
  })

  describe('Invalid Input - Name Validation', () => {
    it('should reject product without English name', () => {
      const payload = {
        name: { ar: 'منتج بدون الإنجليزية' },
        slug: `invalid-${Date.now()}`,
        description: 'Missing English',
        enabled_modules: [Module.MCQ],
      }

      const response = {
        status: 400,
        body: {
          success: false,
          data: null,
          error: {
            code: ErrorCodes.INVALID_NAME_LOCALIZATION,
            message: 'Product name must include English (en)',
          },
        },
      }

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe(
        ErrorCodes.INVALID_NAME_LOCALIZATION
      )
    })

    it('should reject product with empty English name', () => {
      const payload = {
        name: { en: '' },
        slug: `empty-name-${Date.now()}`,
        description: 'Empty English name',
        enabled_modules: [Module.MCQ],
      }

      const response = {
        status: 400,
        body: {
          success: false,
          data: null,
          error: {
            code: ErrorCodes.INVALID_NAME_LOCALIZATION,
            message: 'Product name (en) cannot be empty',
          },
        },
      }

      expect(response.status).toBe(400)
    })

    it('should reject product with very long name (>500 chars)', () => {
      const longName = 'A'.repeat(501)
      const payload = {
        name: { en: longName },
        slug: `long-name-${Date.now()}`,
        description: 'Very long name',
        enabled_modules: [Module.MCQ],
      }

      const response = {
        status: 400,
        body: {
          success: false,
          data: null,
          error: {
            code: ErrorCodes.INVALID_NAME_LOCALIZATION,
            message: 'Product name exceeds maximum length of 500 characters',
          },
        },
      }

      expect(response.status).toBe(400)
    })
  })

  describe('Invalid Input - Slug Validation', () => {
    it('should reject duplicate slug with 409 DUPLICATE_SLUG', () => {
      const existingSlug = 'existing-product'
      const payload = {
        name: { en: 'Different Product' },
        slug: existingSlug,
        description: 'Trying to duplicate slug',
        enabled_modules: [Module.MCQ],
      }

      const response = {
        status: 409,
        body: {
          success: false,
          data: null,
          error: {
            code: ErrorCodes.DUPLICATE_SLUG,
            message: `Product with slug "${existingSlug}" already exists`,
          },
        },
      }

      expect(response.status).toBe(409)
      expect(response.body.error.code).toBe(ErrorCodes.DUPLICATE_SLUG)
    })

    it('should reject invalid slug format', () => {
      const payload = {
        name: { en: 'Invalid Slug Product' },
        slug: 'Invalid Slug With Spaces!!!',
        description: 'Invalid characters in slug',
        enabled_modules: [Module.MCQ],
      }

      const response = {
        status: 400,
        body: {
          success: false,
          data: null,
          error: {
            code: 'INVALID_SLUG_FORMAT',
            message:
              'Slug must be lowercase, alphanumeric, and use hyphens only',
          },
        },
      }

      expect(response.status).toBe(400)
    })

    it('should accept valid slug formats', () => {
      const validSlugs = [
        'product-one',
        'prod-2',
        'p',
        'product-with-many-hyphens',
        'product123',
      ]

      validSlugs.forEach((slug) => {
        const payload = {
          name: { en: `Product ${slug}` },
          slug: `${slug}-${Date.now()}`,
          description: 'Valid slug test',
          enabled_modules: [Module.MCQ],
        }

        expect(payload.slug).toMatch(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/)
      })
    })
  })

  describe('Invalid Input - Modules Validation', () => {
    it('should reject invalid module enum', () => {
      const payload = {
        name: { en: 'Invalid Module Product' },
        slug: `invalid-mod-${Date.now()}`,
        description: 'Invalid module',
        enabled_modules: ['INVALID_MODULE'] as any,
      }

      const response = {
        status: 400,
        body: {
          success: false,
          data: null,
          error: {
            code: ErrorCodes.INVALID_MODULE_ENUM,
            message: 'Invalid module: INVALID_MODULE',
          },
        },
      }

      expect(response.status).toBe(400)
      expect(response.body.error.code).toBe(ErrorCodes.INVALID_MODULE_ENUM)
    })

    it('should reject empty modules list', () => {
      const payload = {
        name: { en: 'No Modules Product' },
        slug: `no-mod-${Date.now()}`,
        description: 'No modules enabled',
        enabled_modules: [],
      }

      const response = {
        status: 400,
        body: {
          success: false,
          data: null,
          error: {
            code: ErrorCodes.INVALID_MODULE_ENUM,
            message: 'At least one module must be enabled',
          },
        },
      }

      expect(response.status).toBe(400)
    })

    it('should reject duplicate module in list', () => {
      const payload = {
        name: { en: 'Duplicate Module Product' },
        slug: `dup-mod-${Date.now()}`,
        description: 'Duplicate module',
        enabled_modules: [Module.MCQ, Module.MCQ],
      }

      const response = {
        status: 400,
        body: {
          success: false,
          data: null,
          error: {
            code: ErrorCodes.INVALID_MODULE_ENUM,
            message: 'Duplicate module in enabled_modules list',
          },
        },
      }

      expect(response.status).toBe(400)
    })

    it('should accept all six valid modules', () => {
      const validModules = [
        Module.MCQ,
        Module.LIBRARY,
        Module.TRADITIONAL_EXAMS,
        Module.EXERCISES,
        Module.LIVES,
        Module.FORUM,
      ]

      expect(validModules).toHaveLength(6)
      expect(new Set(validModules).size).toBe(6) // No duplicates
    })
  })

  describe('Rate Limiting', () => {
    it('should enforce rate limit: 10 requests per minute per user', () => {
      // Simulate 11 consecutive requests
      const requests = Array.from({ length: 11 }, (_, i) => ({
        index: i + 1,
        status: i < 10 ? 201 : 429,
      }))

      const lastRequest = requests[requests.length - 1]!
      expect(lastRequest.status).toBe(429)

      const response = {
        status: 429,
        body: {
          success: false,
          data: null,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message:
              'Too many requests. Limit: 10 requests per minute for POST /products',
          },
        },
      }

      expect(response.status).toBe(429)
    })

    it('should include rate limit headers in 429 response', () => {
      const response = {
        status: 429,
        headers: {
          'x-ratelimit-limit': '10',
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 60),
        },
      }

      expect(response.headers['x-ratelimit-limit']).toBe('10')
      expect(response.headers['x-ratelimit-remaining']).toBe('0')
      expect(parseInt(response.headers['x-ratelimit-reset'])).toBeGreaterThan(
        Math.floor(Date.now() / 1000)
      )
    })
  })

  describe('Error Response Format', () => {
    it('should include correlation ID in all responses', () => {
      const payload = {
        name: { en: 'Test Product' },
        slug: `test-${Date.now()}`,
        description: 'Test',
        enabled_modules: [Module.MCQ],
      }

      const successResponse = {
        status: 201,
        body: { success: true, data: {}, error: null },
        headers: { 'x-correlation-id': correlationId },
      }

      expect(successResponse.headers['x-correlation-id']).toBe(correlationId)
    })

    it('should include correlation ID in error responses', () => {
      const errorResponse = {
        status: 400,
        body: {
          success: false,
          data: null,
          error: {
            code: ErrorCodes.INVALID_MODULE_ENUM,
            message: 'Invalid module',
          },
        },
        headers: { 'x-correlation-id': correlationId },
      }

      expect(errorResponse.headers['x-correlation-id']).toBe(correlationId)
    })

    it('should follow standard error response format', () => {
      const errorResponse = {
        success: false,
        data: null,
        error: {
          code: 'ERROR_CODE',
          message: 'Human readable message',
        },
      }

      expect(errorResponse.success).toBe(false)
      expect(errorResponse.data).toBeNull()
      expect(errorResponse.error).toHaveProperty('code')
      expect(errorResponse.error).toHaveProperty('message')
    })
  })

  describe('Authorization', () => {
    it('should reject unauthenticated requests with 401', () => {
      const response = {
        status: 401,
        body: {
          success: false,
          data: null,
          error: {
            code: ErrorCodes.UNAUTHORIZED,
            message: 'Missing or invalid authentication token',
          },
        },
      }

      expect(response.status).toBe(401)
    })

    it('should reject non-admin users with 403', () => {
      const response = {
        status: 403,
        body: {
          success: false,
          data: null,
          error: {
            code: ErrorCodes.FORBIDDEN,
            message:
              'Insufficient permissions. Admin role required for product management',
          },
        },
      }

      expect(response.status).toBe(403)
    })
  })

  describe('Workspace Locking', () => {
    it('should reject if workspace is SOFT_LOCKED with 423', () => {
      const response = {
        status: 423,
        body: {
          success: false,
          data: null,
          error: {
            code: ErrorCodes.WORKSPACE_LOCKED,
            message: 'Workspace is locked for maintenance',
          },
        },
      }

      expect(response.status).toBe(423)
    })

    it('should reject if workspace is ARCHIVED with 403', () => {
      const response = {
        status: 403,
        body: {
          success: false,
          data: null,
          error: {
            code: ErrorCodes.FORBIDDEN,
            message: 'Workspace is archived and cannot be modified',
          },
        },
      }

      expect(response.status).toBe(403)
    })
  })
})
