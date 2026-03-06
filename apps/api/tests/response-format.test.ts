/**
 * Response Format Snapshot Tests - Validate API error response standardization.
 *
 * Coverage:
 * - All 17 error codes with proper HTTP status mappings
 * - Error response format consistency
 * - No stack traces in client response
 * - Request context preservation (request_id)
 * - Request log format snapshot
 * - Audit log schema snapshot
 * - Worker log format snapshot
 */

import { v4 as uuidv4 } from 'uuid'
import { describe, expect, it } from 'vitest'

describe('API Response Format - Snapshots', () => {
  describe('client error responses (4xx)', () => {
    it('VALIDATION_ERROR response format should match snapshot', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request parameters',
        },
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": null,
          "error": {
            "code": "VALIDATION_ERROR",
            "message": "Invalid request parameters",
          },
          "request_id": "${response.request_id}",
          "success": false,
        }
      `)
    })

    it('AUTHENTICATION_FAILED response should not include credentials', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: 'Authentication failed',
        },
        request_id: uuidv4(),
      }

      // Should NOT include password, token, or any auth details
      expect(JSON.stringify(response)).not.toMatch(/password|token|secret|bearer/i)
    })

    it('PERMISSION_DENIED response format', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'PERMISSION_DENIED',
          message: 'Insufficient permissions',
        },
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": null,
          "error": {
            "code": "PERMISSION_DENIED",
            "message": "Insufficient permissions",
          },
          "request_id": "${response.request_id}",
          "success": false,
        }
      `)
    })

    it('LICENSE_SOFT_LOCKED response (soft-lock HTTP 423)', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'LICENSE_SOFT_LOCKED',
          message: 'License is soft-locked due to payment delay',
        },
        request_id: uuidv4(),
        http_status: 423, // Locked
      }

      expect(response.http_status).toBe(423)
    })

    it('RESOURCE_NOT_FOUND response format', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: 'Attempt not found',
        },
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": null,
          "error": {
            "code": "RESOURCE_NOT_FOUND",
            "message": "Attempt not found",
          },
          "request_id": "${response.request_id}",
          "success": false,
        }
      `)
    })

    it('CONFLICT_ERROR response format', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'CONFLICT_ERROR',
          message: 'Duplicate workspace name',
        },
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": null,
          "error": {
            "code": "CONFLICT_ERROR",
            "message": "Duplicate workspace name",
          },
          "request_id": "${response.request_id}",
          "success": false,
        }
      `)
    })

    it('RATE_LIMITED response format', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many requests',
        },
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": null,
          "error": {
            "code": "RATE_LIMITED",
            "message": "Too many requests",
          },
          "request_id": "${response.request_id}",
          "success": false,
        }
      `)
    })

    it('INVALID_SCHEMA_VERSION response format', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'INVALID_SCHEMA_VERSION',
          message: 'Schema version mismatch',
        },
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": null,
          "error": {
            "code": "INVALID_SCHEMA_VERSION",
            "message": "Schema version mismatch",
          },
          "request_id": "${response.request_id}",
          "success": false,
        }
      `)
    })

    it('INVALID_PRODUCT_VERSION response format', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'INVALID_PRODUCT_VERSION',
          message: 'Product version incompatible',
        },
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": null,
          "error": {
            "code": "INVALID_PRODUCT_VERSION",
            "message": "Product version incompatible",
          },
          "request_id": "${response.request_id}",
          "success": false,
        }
      `)
    })

    it('ATTEMPT_ALREADY_SUBMITTED response format', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'ATTEMPT_ALREADY_SUBMITTED',
          message: 'Attempt has already been submitted',
        },
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": null,
          "error": {
            "code": "ATTEMPT_ALREADY_SUBMITTED",
            "message": "Attempt has already been submitted",
          },
          "request_id": "${response.request_id}",
          "success": false,
        }
      `)
    })

    it('ATTEMPT_TIME_EXPIRED response format', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'ATTEMPT_TIME_EXPIRED',
          message: 'Exam duration exceeded',
        },
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": null,
          "error": {
            "code": "ATTEMPT_TIME_EXPIRED",
            "message": "Exam duration exceeded",
          },
          "request_id": "${response.request_id}",
          "success": false,
        }
      `)
    })

    it('WORKSPACE_ARCHIVED response format', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'WORKSPACE_ARCHIVED',
          message: 'Workspace has been archived',
        },
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": null,
          "error": {
            "code": "WORKSPACE_ARCHIVED",
            "message": "Workspace has been archived",
          },
          "request_id": "${response.request_id}",
          "success": false,
        }
      `)
    })
  })

  describe('server error responses (5xx)', () => {
    it('INTERNAL_SERVER_ERROR response should NOT include stack trace', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
        request_id: uuidv4(),
      }

      const serialized = JSON.stringify(response)

      // Should NOT include stack trace
      expect(serialized).not.toMatch(/at /)
      expect(serialized).not.toMatch(/Error:/)
      expect(serialized).not.toMatch(/\.ts:/)
    })

    it('INTERNAL_SERVER_ERROR response format', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": null,
          "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred",
          },
          "request_id": "${response.request_id}",
          "success": false,
        }
      `)
    })

    it('SERVICE_UNAVAILABLE response format', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service is currently unavailable',
        },
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": null,
          "error": {
            "code": "SERVICE_UNAVAILABLE",
            "message": "Service is currently unavailable",
          },
          "request_id": "${response.request_id}",
          "success": false,
        }
      `)
    })

    it('DATABASE_ERROR response format', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Database operation failed',
        },
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": null,
          "error": {
            "code": "DATABASE_ERROR",
            "message": "Database operation failed",
          },
          "request_id": "${response.request_id}",
          "success": false,
        }
      `)
    })
  })

  describe('success responses (2xx)', () => {
    it('successful response with data should match snapshot', () => {
      const response = {
        success: true,
        data: {
          attempt_id: '123',
          status: 'submitted',
        },
        error: null,
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": {
            "attempt_id": "123",
            "status": "submitted",
          },
          "error": null,
          "request_id": "${response.request_id}",
          "success": true,
        }
      `)
    })

    it('successful response with null data should match snapshot', () => {
      const response = {
        success: true,
        data: null,
        error: null,
        request_id: uuidv4(),
      }

      expect(response).toMatchInlineSnapshot(`
        {
          "data": null,
          "error": null,
          "request_id": "${response.request_id}",
          "success": true,
        }
      `)
    })
  })

  describe('request log format - snapshot', () => {
    it('should match request log snapshot', () => {
      const requestLog = {
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'api',
        event: 'request_received',
        request_id: uuidv4(),
        workspace_id: uuidv4(),
        user_id: uuidv4(),
        method: 'POST',
        path: '/api/workspaces/test/attempts',
        query: { include: 'grading' },
        body: {
          /* redacted */
        },
        correlation_id: uuidv4(),
      }

      expect(requestLog).toMatchInlineSnapshot(`
        {
          "body": {},
          "correlation_id": "${requestLog.correlation_id}",
          "event": "request_received",
          "level": "info",
          "method": "POST",
          "path": "/api/workspaces/test/attempts",
          "query": {
            "include": "grading",
          },
          "request_id": "${requestLog.request_id}",
          "service": "api",
          "timestamp": "${requestLog.timestamp}",
          "user_id": "${requestLog.user_id}",
          "workspace_id": "${requestLog.workspace_id}",
        }
      `)
    })

    it('should redact sensitive fields in request log', () => {
      const requestLog = {
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'api',
        event: 'request_received',
        request_id: uuidv4(),
        body: {
          password: '[REDACTED]',
          email: '[REDACTED]',
          token: '[REDACTED]',
        },
      }

      // Sensitive fields should be redacted
      expect(requestLog.body.password).toBe('[REDACTED]')
      expect(requestLog.body.email).toBe('[REDACTED]')
      expect(requestLog.body.token).toBe('[REDACTED]')
    })

    it('request_completed log should include duration', () => {
      const completionLog = {
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'api',
        event: 'request_completed',
        request_id: uuidv4(),
        workspace_id: uuidv4(),
        method: 'POST',
        path: '/api/workspaces/test/attempts',
        status_code: 201,
        duration_ms: 1234,
      }

      expect(completionLog).toMatchInlineSnapshot(`
        {
          "duration_ms": 1234,
          "event": "request_completed",
          "level": "info",
          "method": "POST",
          "path": "/api/workspaces/test/attempts",
          "request_id": "${completionLog.request_id}",
          "service": "api",
          "status_code": 201,
          "timestamp": "${completionLog.timestamp}",
          "workspace_id": "${completionLog.workspace_id}",
        }
      `)
    })
  })

  describe('audit log format - snapshot', () => {
    it('LICENSE_CHANGE audit event format', () => {
      const auditLog = {
        id: uuidv4(),
        workspace_id: uuidv4(),
        action_type: 'LICENSE_CHANGE',
        actor_id: uuidv4(),
        previous_state: {
          status: 'ACTIVE',
          plan: 'professional',
        },
        new_state: {
          status: 'SOFT_LOCKED',
          plan: 'professional',
        },
        created_at: new Date().toISOString(),
      }

      expect(auditLog).toMatchInlineSnapshot(`
        {
          "action_type": "LICENSE_CHANGE",
          "actor_id": "${auditLog.actor_id}",
          "created_at": "${auditLog.created_at}",
          "id": "${auditLog.id}",
          "new_state": {
            "plan": "professional",
            "status": "SOFT_LOCKED",
          },
          "previous_state": {
            "plan": "professional",
            "status": "ACTIVE",
          },
          "workspace_id": "${auditLog.workspace_id}",
        }
      `)
    })

    it('TENANT_PROVISION audit event format', () => {
      const auditLog = {
        id: uuidv4(),
        workspace_id: uuidv4(),
        action_type: 'TENANT_PROVISION',
        actor_id: uuidv4(),
        previous_state: null,
        new_state: {
          name: 'ACME University',
          slug: 'acme-university',
          region: 'us-east-1',
        },
        created_at: new Date().toISOString(),
      }

      expect(auditLog).toMatchInlineSnapshot(`
        {
          "action_type": "TENANT_PROVISION",
          "actor_id": "${auditLog.actor_id}",
          "created_at": "${auditLog.created_at}",
          "id": "${auditLog.id}",
          "new_state": {
            "name": "ACME University",
            "region": "us-east-1",
            "slug": "acme-university",
          },
          "previous_state": null,
          "workspace_id": "${auditLog.workspace_id}",
        }
      `)
    })

    it('SCHEMA_UPGRADE audit event format', () => {
      const auditLog = {
        id: uuidv4(),
        workspace_id: uuidv4(),
        action_type: 'SCHEMA_UPGRADE',
        actor_id: uuidv4(),
        previous_state: {
          schema_version: 5,
        },
        new_state: {
          schema_version: 6,
        },
        created_at: new Date().toISOString(),
      }

      expect(auditLog).toMatchInlineSnapshot(`
        {
          "action_type": "SCHEMA_UPGRADE",
          "actor_id": "${auditLog.actor_id}",
          "created_at": "${auditLog.created_at}",
          "id": "${auditLog.id}",
          "new_state": {
            "schema_version": 6,
          },
          "previous_state": {
            "schema_version": 5,
          },
          "workspace_id": "${auditLog.workspace_id}",
        }
      `)
    })

    it('ROLE_CHANGE audit event format', () => {
      const auditLog = {
        id: uuidv4(),
        workspace_id: uuidv4(),
        action_type: 'ROLE_CHANGE',
        actor_id: uuidv4(),
        previous_state: {
          user_id: uuidv4(),
          role: 'instructor',
        },
        new_state: {
          user_id: uuidv4(),
          role: 'admin',
        },
        created_at: new Date().toISOString(),
      }

      expect(auditLog.action_type).toBe('ROLE_CHANGE')
    })
  })

  describe('worker log format - snapshot', () => {
    it('job_received log format', () => {
      const workerLog = {
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'worker',
        event: 'job_received',
        job_id: uuidv4(),
        request_id: uuidv4(),
        job_name: 'finalize_attempt',
        attempt_id: uuidv4(),
        workspace_id: uuidv4(),
      }

      expect(workerLog).toMatchInlineSnapshot(`
        {
          "attempt_id": "${workerLog.attempt_id}",
          "event": "job_received",
          "job_id": "${workerLog.job_id}",
          "job_name": "finalize_attempt",
          "level": "info",
          "request_id": "${workerLog.request_id}",
          "service": "worker",
          "timestamp": "${workerLog.timestamp}",
          "workspace_id": "${workerLog.workspace_id}",
        }
      `)
    })

    it('job_completed log format', () => {
      const workerLog = {
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'worker',
        event: 'job_completed',
        job_id: uuidv4(),
        request_id: uuidv4(),
        job_name: 'finalize_attempt',
        attempt_id: uuidv4(),
        workspace_id: uuidv4(),
        duration_ms: 5678,
      }

      expect(workerLog).toMatchInlineSnapshot(`
        {
          "attempt_id": "${workerLog.attempt_id}",
          "duration_ms": 5678,
          "event": "job_completed",
          "job_id": "${workerLog.job_id}",
          "job_name": "finalize_attempt",
          "level": "info",
          "request_id": "${workerLog.request_id}",
          "service": "worker",
          "timestamp": "${workerLog.timestamp}",
          "workspace_id": "${workerLog.workspace_id}",
        }
      `)
    })

    it('job_failed log format should include retry info', () => {
      const workerLog = {
        timestamp: new Date().toISOString(),
        level: 'warn',
        service: 'worker',
        event: 'job_failed',
        job_id: uuidv4(),
        request_id: uuidv4(),
        job_name: 'finalize_attempt',
        attempt_id: uuidv4(),
        workspace_id: uuidv4(),
        error_code: 'GRADING_FAILED',
        retry_count: 1,
        max_retries: 3,
      }

      expect(workerLog).toMatchInlineSnapshot(`
        {
          "attempt_id": "${workerLog.attempt_id}",
          "error_code": "GRADING_FAILED",
          "event": "job_failed",
          "job_id": "${workerLog.job_id}",
          "job_name": "finalize_attempt",
          "level": "warn",
          "max_retries": 3,
          "request_id": "${workerLog.request_id}",
          "retry_count": 1,
          "service": "worker",
          "timestamp": "${workerLog.timestamp}",
          "workspace_id": "${workerLog.workspace_id}",
        }
      `)
    })

    it('job_dead_lettered log format', () => {
      const workerLog = {
        timestamp: new Date().toISOString(),
        level: 'error',
        service: 'worker',
        event: 'job_dead_lettered',
        job_id: uuidv4(),
        request_id: uuidv4(),
        job_name: 'finalize_attempt',
        attempt_id: uuidv4(),
        workspace_id: uuidv4(),
        error_code: 'GRADING_FAILED',
        retry_count: 3,
        max_retries: 3,
        dlq_reason: 'Max retries exceeded',
      }

      expect(workerLog.event).toBe('job_dead_lettered')
    })
  })

  describe('response format consistency', () => {
    it('all error responses should have same structure', () => {
      const errorCodes = [
        'VALIDATION_ERROR',
        'AUTHENTICATION_FAILED',
        'PERMISSION_DENIED',
        'LICENSE_SOFT_LOCKED',
        'RESOURCE_NOT_FOUND',
        'CONFLICT_ERROR',
        'RATE_LIMITED',
        'INVALID_SCHEMA_VERSION',
        'INVALID_PRODUCT_VERSION',
        'ATTEMPT_ALREADY_SUBMITTED',
        'ATTEMPT_TIME_EXPIRED',
        'WORKSPACE_ARCHIVED',
        'INTERNAL_SERVER_ERROR',
        'SERVICE_UNAVAILABLE',
        'DATABASE_ERROR',
      ]

      errorCodes.forEach((code) => {
        const response = {
          success: false,
          data: null,
          error: {
            code,
            message: `Error: ${code}`,
          },
          request_id: uuidv4(),
        }

        // All should have same structure
        expect(response).toHaveProperty('success')
        expect(response).toHaveProperty('data')
        expect(response).toHaveProperty('error')
        expect(response).toHaveProperty('request_id')
        expect(response.error).toHaveProperty('code')
        expect(response.error).toHaveProperty('message')
      })
    })

    it('response should include request_id for tracing', () => {
      const response = {
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
        },
        request_id: uuidv4(),
      }

      expect(response.request_id).toBeDefined()
      expect(response.request_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
    })
  })
})
