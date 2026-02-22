/**
 * License Service Integration Tests
 *
 * File: tests/integration/domain/licenses/license.service.test.ts
 * Task: T066
 *
 * Comprehensive tests for LicenseService business logic.
 * Covers create, edit, state transitions, retry logic.
 */

import Database from 'better-sqlite3'
import { Logger } from 'pino'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  InvalidStateTransitionError,
  LicenseValidationError,
  ProvisioningError,
} from '../../../packages/domain-core/src/licenses/errors'
import { LicenseRepository } from '../../../packages/domain-core/src/licenses/repository'
import { LicenseService } from '../../../packages/domain-core/src/licenses/service'
import {
  CreateLicenseRequest,
  LicenseStatus,
} from '../../../packages/domain-core/src/licenses/types'

describe('LicenseService', () => {
  let db: Database.Database
  let repository: LicenseRepository
  let service: LicenseService
  let mockQueueService: any
  let mockLogger: Logger

  beforeEach(() => {
    // Initialize test database (in-memory)
    db = new Database(':memory:')

    // Create tables
    db.exec(`
      CREATE TABLE licenses (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        workspace_slug TEXT UNIQUE NOT NULL,
        workspace_name TEXT NOT NULL,
        student_limit INTEGER,
        staff_limit INTEGER,
        use_zidney_payment BOOLEAN DEFAULT 0,
        commission_per_user NUMERIC,
        default_language TEXT DEFAULT 'en',
        uses_divisions BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'PENDING_PROVISION',
        soft_lock_until TIMESTAMP,
        archived_at TIMESTAMP,
        deleted_at TIMESTAMP,
        schema_version INTEGER NOT NULL,
        product_version INTEGER NOT NULL,
        provisioning_error TEXT,
        provisioning_retries INTEGER DEFAULT 0,
        provisioning_last_attempt_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE schema_versions (
        version INTEGER PRIMARY KEY,
        checksum TEXT
      );

      INSERT INTO schema_versions (version, checksum) VALUES (7, 'test');
    `)

    repository = new LicenseRepository(db)

    mockQueueService = {
      enqueueProvisioningJob: vi.fn().mockResolvedValue(undefined),
    }

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as any

    service = new LicenseService(repository, mockQueueService, mockLogger)
  })

  afterEach(() => {
    db.close()
  })

  describe('create()', () => {
    it('should create a license with PENDING_PROVISION status', async () => {
      const input: CreateLicenseRequest = {
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        workspace_slug: 'acme-corp',
        workspace_name: 'ACME Corporation',
        student_limit: 1000,
        staff_limit: 50,
      }

      const license = await service.create(input, 'correlation-123')

      expect(license.workspace_slug).toBe('acme-corp')
      expect(license.status).toBe(LicenseStatus.PENDING_PROVISION)
      expect(license.student_limit).toBe(1000)
      expect(license.staff_limit).toBe(50)
      expect(mockQueueService.enqueueProvisioningJob).toHaveBeenCalled()
    })

    it('should reject invalid slug format', async () => {
      const input: CreateLicenseRequest = {
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        workspace_slug: 'INVALID_SLUG', // uppercase, underscore
        workspace_name: 'Test',
      }

      await expect(service.create(input, 'correlation-123')).rejects.toThrow(
        LicenseValidationError
      )
    })

    it('should reject slug that is too short', async () => {
      const input: CreateLicenseRequest = {
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        workspace_slug: 'ab', // Only 2 chars
        workspace_name: 'Test',
      }

      await expect(service.create(input, 'correlation-123')).rejects.toThrow(
        LicenseValidationError
      )
    })

    it('should enforce slug uniqueness', async () => {
      const input: CreateLicenseRequest = {
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        workspace_slug: 'acme',
        workspace_name: 'ACME',
      }

      // Create first license
      await service.create(input, 'correlation-123')

      // Try to create duplicate
      await expect(service.create(input, 'correlation-456')).rejects.toThrow(
        LicenseValidationError
      )
    })

    it('should reject negative student limit', async () => {
      const input: CreateLicenseRequest = {
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        workspace_slug: 'test-corp',
        workspace_name: 'Test',
        student_limit: -10, // Invalid
      }

      await expect(service.create(input, 'correlation-123')).rejects.toThrow(
        LicenseValidationError
      )
    })

    it('should accept null limits as unlimited', async () => {
      const input: CreateLicenseRequest = {
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        workspace_slug: 'unlimited-corp',
        workspace_name: 'Unlimited',
        student_limit: null,
        staff_limit: null,
      }

      const license = await service.create(input, 'correlation-123')
      expect(license.student_limit).toBeNull()
      expect(license.staff_limit).toBeNull()
    })

    it('should reject invalid language code', async () => {
      const input: CreateLicenseRequest = {
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        workspace_slug: 'test-lang',
        workspace_name: 'Test',
        default_language: 'zz', // Invalid
      }

      await expect(service.create(input, 'correlation-123')).rejects.toThrow(
        LicenseValidationError
      )
    })
  })

  describe('edit()', () => {
    let licenseId: string

    beforeEach(async () => {
      const license = await service.create(
        {
          product_id: '550e8400-e29b-41d4-a716-446655440000',
          workspace_slug: 'edit-test',
          workspace_name: 'Edit Test',
          student_limit: 100,
          staff_limit: 10,
        },
        'correlation-123'
      )
      licenseId = license.id
    })

    it('should edit mutable fields', async () => {
      const updated = await service.edit(
        licenseId,
        { student_limit: 200, staff_limit: 20 },
        'correlation-456'
      )

      expect(updated.student_limit).toBe(200)
      expect(updated.staff_limit).toBe(20)
    })

    it('should reject attempts to edit immutable fields', async () => {
      await expect(
        service.edit(
          licenseId,
          { product_id: '550e8400-e29b-41d4-a716-446655440001' } as any,
          'correlation-456'
        )
      ).rejects.toThrow(LicenseValidationError)
    })

    it('should reject negative limit in edit', async () => {
      await expect(
        service.edit(licenseId, { student_limit: -50 }, 'correlation-456')
      ).rejects.toThrow(LicenseValidationError)
    })
  })

  describe('softLock()', () => {
    let licenseId: string

    beforeEach(async () => {
      const license = await service.create(
        {
          product_id: '550e8400-e29b-41d4-a716-446655440000',
          workspace_slug: 'soft-lock-test',
          workspace_name: 'Soft Lock',
        },
        'correlation-123'
      )

      licenseId = license.id

      // Manually update status to ACTIVE for testing
      const stmt = db.prepare('UPDATE licenses SET status = ? WHERE id = ?')
      stmt.run(LicenseStatus.ACTIVE, licenseId)
    })

    it('should transition ACTIVE to SOFT_LOCKED', async () => {
      const updated = await service.softLock(
        licenseId,
        { grace_period_days: 90 },
        'correlation-456'
      )

      expect(updated.status).toBe(LicenseStatus.SOFT_LOCKED)
      expect(updated.soft_lock_until).not.toBeNull()
    })

    it('should reject soft-lock from non-ACTIVE status', async () => {
      // First soft-lock
      await service.softLock(
        licenseId,
        { grace_period_days: 90 },
        'correlation-456'
      )

      // Try to soft-lock again
      await expect(
        service.softLock(
          licenseId,
          { grace_period_days: 90 },
          'correlation-789'
        )
      ).rejects.toThrow(InvalidStateTransitionError)
    })
  })

  describe('retryProvisioning()', () => {
    let licenseId: string

    beforeEach(async () => {
      const license = await service.create(
        {
          product_id: '550e8400-e29b-41d4-a716-446655440000',
          workspace_slug: 'retry-test',
          workspace_name: 'Retry Test',
        },
        'correlation-123'
      )

      licenseId = license.id

      // Manually update to PROVISION_FAILED
      const stmt = db.prepare(`
        UPDATE licenses 
        SET status = ?, provisioning_error = ?, provisioning_retries = 0
        WHERE id = ?
      `)
      stmt.run(
        LicenseStatus.PROVISION_FAILED,
        'Initial provisioning failed',
        licenseId
      )
    })

    it('should retry provisioning from PROVISION_FAILED', async () => {
      const updated = await service.retryProvisioning(
        licenseId,
        {},
        'correlation-456'
      )

      expect(updated.status).toBe(LicenseStatus.PENDING_PROVISION)
      expect(updated.provisioning_retries).toBe(1)
      expect(updated.provisioning_error).toBeNull()
    })

    it('should reject retry from non-PROVISION_FAILED status', async () => {
      // Update to ACTIVE
      const stmt = db.prepare('UPDATE licenses SET status = ? WHERE id = ?')
      stmt.run(LicenseStatus.ACTIVE, licenseId)

      await expect(
        service.retryProvisioning(licenseId, {}, 'correlation-456')
      ).rejects.toThrow(InvalidStateTransitionError)
    })

    it('should enforce retry limit', async () => {
      // Simulate 5 retries already
      let updateStmt = db.prepare(
        'UPDATE licenses SET provisioning_retries = ? WHERE id = ?'
      )
      updateStmt.run(5, licenseId)

      await expect(
        service.retryProvisioning(licenseId, {}, 'correlation-456')
      ).rejects.toThrow(ProvisioningError)
    })
  })
})
