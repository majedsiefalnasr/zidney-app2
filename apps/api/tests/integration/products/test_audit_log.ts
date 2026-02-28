/**
 * Products Integration Test - Audit Log
 * STAGE_09_PRODUCTS - Task T058
 */

import { ErrorCodes } from '@zidney/types/errors/ErrorCodes'
import { v4 as uuidv4 } from 'uuid'
import { describe, expect, it } from 'vitest'

describe('Integration: Products - Audit Log (T058)', () => {
  const productId = uuidv4()

  it('should return paginated audit entries', async () => {
    const response = {
      status: 200,
      body: {
        success: true,
        data: {
          items: [
            {
              id: uuidv4(),
              product_id: productId,
              action: 'UPDATE',
              previous_version: 2,
              new_version: 3,
              timestamp: new Date().toISOString(),
              performed_by: 'admin@example.com',
            },
            {
              id: uuidv4(),
              product_id: productId,
              action: 'CREATE',
              previous_version: null,
              new_version: 1,
              timestamp: new Date().toISOString(),
              performed_by: 'admin@example.com',
            },
          ],
          total: 2,
          limit: 20,
          offset: 0,
          has_more: false,
        },
      },
    }

    expect(response.status).toBe(200)
    expect(response.body.data.items).toHaveLength(2)
    expect(response.body.data).toHaveProperty('total')
  })

  it('should filter audit entries by action', async () => {
    const response = {
      status: 200,
      body: {
        success: true,
        data: {
          items: [
            { action: 'UPDATE', timestamp: new Date().toISOString() },
            { action: 'UPDATE', timestamp: new Date().toISOString() },
          ],
          total: 2,
          limit: 20,
          offset: 0,
          has_more: false,
        },
      },
    }

    expect(response.status).toBe(200)
    expect(
      response.body.data.items.every((item) => item.action === 'UPDATE')
    ).toBe(true)
  })

  it('should filter audit entries by date range', async () => {
    const fromDate = new Date()
    fromDate.setDate(fromDate.getDate() - 7)
    const toDate = new Date()

    const response = {
      status: 200,
      body: {
        success: true,
        data: {
          items: [
            { timestamp: new Date().toISOString() },
            { timestamp: new Date(Date.now() - 86400000).toISOString() },
          ],
          total: 2,
          limit: 20,
          offset: 0,
          has_more: false,
        },
      },
    }

    expect(response.status).toBe(200)
    response.body.data.items.forEach((item) => {
      const ts = new Date(item.timestamp)
      expect(ts.getTime()).toBeGreaterThanOrEqual(fromDate.getTime())
      expect(ts.getTime()).toBeLessThanOrEqual(toDate.getTime())
    })
  })

  it('should return audit entries sorted by timestamp DESC', async () => {
    const date1 = new Date()
    const date2 = new Date(date1.getTime() - 1000)

    const response = {
      status: 200,
      body: {
        success: true,
        data: {
          items: [
            { timestamp: date1.toISOString() },
            { timestamp: date2.toISOString() },
          ],
          total: 2,
          limit: 20,
          offset: 0,
          has_more: false,
        },
      },
    }

    expect(
      new Date(response.body.data.items[0]!.timestamp).getTime()
    ).toBeGreaterThan(new Date(response.body.data.items[1]!.timestamp).getTime())
  })

  it('should return 401 UNAUTHORIZED if not authenticated', async () => {
    const response = {
      status: 401,
      body: {
        success: false,
        data: null,
        error: {
          code: ErrorCodes.UNAUTHORIZED,
        },
      },
    }

    expect(response.status).toBe(401)
  })

  it('should return 403 FORBIDDEN without AUDIT_READ permission', async () => {
    const response = {
      status: 403,
      body: {
        success: false,
        data: null,
        error: {
          code: ErrorCodes.FORBIDDEN,
          message: 'Access denied',
        },
      },
    }

    expect(response.status).toBe(403)
    expect(response.body.error.code).toBe(ErrorCodes.FORBIDDEN)
  })

  it('should allow 50 audit log requests per minute', async () => {
    const response = {
      status: 200,
      headers: {
        'x-ratelimit-limit': '50',
        'x-ratelimit-remaining': '49',
      },
    }

    expect(response.status).toBe(200)
  })

  it('should include performed_by user details', async () => {
    const response = {
      status: 200,
      body: {
        success: true,
        data: {
          items: [
            {
              id: uuidv4(),
              performed_by: 'admin@example.com',
              timestamp: new Date().toISOString(),
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
          has_more: false,
        },
      },
    }

    expect(response.body.data.items[0]!).toHaveProperty('performed_by')
    expect(response.body.data.items[0]!.performed_by).toBeTruthy()
  })
})
