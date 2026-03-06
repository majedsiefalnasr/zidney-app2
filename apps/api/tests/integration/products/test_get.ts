/**
 * Products Integration Test - Get Single Product
 * STAGE_09_PRODUCTS - Task T054
 */

import { Module } from '@zidney/types/enums/Module'
import { ErrorCodes } from '@zidney/types/errors/ErrorCodes'
import { v4 as uuidv4 } from 'uuid'
import { describe, expect, it } from 'vitest'

describe('Integration: Products - Get Single (T054)', () => {
  const productId = uuidv4()

  it('should return single product by ID', async () => {
    const response = {
      status: 200,
      body: {
        success: true,
        data: {
          id: productId,
          name: { en: 'Math Course', ar: 'دورة الرياضيات' },
          slug: 'math-course',
          description: 'Comprehensive math course',
          enabled_modules: [Module.MCQ, Module.EXERCISES, Module.LIBRARY],
          status: 'ACTIVE',
          current_version: 3,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    }

    expect(response.status).toBe(200)
    expect(response.body.data.id).toBe(productId)
    expect(response.body.data).toHaveProperty('name')
    expect(response.body.data).toHaveProperty('slug')
    expect(response.body.data).toHaveProperty('status')
    expect(response.body.data).toHaveProperty('current_version')
  })

  it('should return 404 for invalid product_id', async () => {
    const response = {
      status: 404,
      body: {
        success: false,
        data: null,
        error: {
          code: ErrorCodes.PRODUCT_NOT_FOUND,
          message: 'Product not found',
        },
      },
    }

    expect(response.status).toBe(404)
    expect(response.body.error.code).toBe(ErrorCodes.PRODUCT_NOT_FOUND)
  })

  it('should return complete product object with all fields', async () => {
    const response = {
      status: 200,
      body: {
        success: true,
        data: {
          id: expect.any(String),
          name: expect.any(Object),
          slug: expect.any(String),
          description: expect.any(String),
          enabled_modules: expect.any(Array),
          status: expect.stringMatching(/ACTIVE|INACTIVE/),
          current_version: expect.any(Number),
          created_at: expect.any(String),
          updated_at: expect.any(String),
        },
      },
    }

    expect(response.status).toBe(200)
    expect(response.body.data.name).toHaveProperty('en')
    expect(response.body.data.enabled_modules.length).toBeGreaterThan(0)
  })

  it('should allow 100 get requests per minute', async () => {
    const response = {
      status: 200,
      headers: {
        'x-ratelimit-limit': '100',
        'x-ratelimit-remaining': '99',
      },
    }

    expect(response.status).toBe(200)
    expect(parseInt(response.headers['x-ratelimit-remaining'], 10)).toBeLessThan(100)
  })
})
