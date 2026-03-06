/**
 * License Service Integration Tests
 *
 * File: tests/integration/domain/licenses/license.service.test.ts
 * Task: T066
 *
 * Comprehensive tests for LicenseService business logic.
 * Covers create, edit, state transitions, retry logic.
 */

import {
  InvalidStateTransitionError,
  LicenseNotFoundError,
  LicenseValidationError,
  ProvisioningError,
} from '@zidney/domain-core/licenses/errors'
import { LicenseService } from '@zidney/domain-core/licenses/service'
import {
  type CreateLicenseRequest,
  type License,
  LicenseStatus,
} from '@zidney/domain-core/licenses/types'
import type { Logger } from '@zidney/logger'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class InMemoryLicenseRepository {
  private licenses = new Map<string, License>()
  private platformSchemaVersion = 7

  async withTransaction<T>(callback: () => Promise<T>): Promise<T> {
    return callback()
  }

  async getPlatformSchemaVersion(): Promise<number> {
    return this.platformSchemaVersion
  }

  async getByWorkspaceSlug(slug: string): Promise<License | null> {
    for (const license of this.licenses.values()) {
      if (license.workspace_slug === slug && !license.deleted_at) {
        return { ...license }
      }
    }
    return null
  }

  async create(data: {
    id: string
    product_id: string
    workspace_slug: string
    workspace_name: string
    student_limit: number | null
    staff_limit: number | null
    use_zidney_payment: boolean
    commission_per_user: number | null
    default_language: string
    uses_divisions: boolean
    schema_version: number
    product_version: number
  }): Promise<License> {
    const existing = await this.getByWorkspaceSlug(data.workspace_slug)
    if (existing) {
      throw LicenseValidationError.slugNotUnique()
    }

    const now = new Date()
    const license: License = {
      id: data.id,
      product_id: data.product_id,
      workspace_slug: data.workspace_slug,
      workspace_name: data.workspace_name,
      student_limit: data.student_limit,
      staff_limit: data.staff_limit,
      use_zidney_payment: data.use_zidney_payment,
      commission_per_user: data.commission_per_user,
      default_language: data.default_language,
      uses_divisions: data.uses_divisions,
      status: LicenseStatus.PENDING_PROVISION,
      soft_lock_until: null,
      archived_at: null,
      deleted_at: null,
      schema_version: data.schema_version,
      product_version: data.product_version,
      provisioning_error: null,
      provisioning_retries: 0,
      provisioning_last_attempt_at: null,
      created_at: now,
      updated_at: now,
    }

    this.licenses.set(license.id, license)
    return { ...license }
  }

  async getById(id: string): Promise<License | null> {
    const license = this.licenses.get(id)
    return license ? { ...license } : null
  }

  async update(
    id: string,
    data: Partial<Omit<License, 'id' | 'created_at' | 'updated_at'>>
  ): Promise<License> {
    const existing = this.licenses.get(id)
    if (!existing) throw new LicenseNotFoundError(id)

    const updated: License = {
      ...existing,
      ...data,
      updated_at: new Date(),
    }

    this.licenses.set(id, updated)
    return { ...updated }
  }

  async softLock(id: string, gracePeriodMs: number): Promise<License> {
    const existing = this.licenses.get(id)
    if (!existing) throw new LicenseNotFoundError(id)
    if (existing.status !== LicenseStatus.ACTIVE) {
      throw InvalidStateTransitionError.softLockFromNonActive()
    }

    const updated: License = {
      ...existing,
      status: LicenseStatus.SOFT_LOCKED,
      soft_lock_until: new Date(Date.now() + gracePeriodMs),
      updated_at: new Date(),
    }

    this.licenses.set(id, updated)
    return { ...updated }
  }

  setLicenseFields(id: string, fields: Partial<Omit<License, 'id' | 'created_at' | 'updated_at'>>) {
    const existing = this.licenses.get(id)
    if (!existing) throw new Error(`License ${id} not found in test repo`)

    this.licenses.set(id, {
      ...existing,
      ...fields,
      updated_at: new Date(),
    })
  }
}

describe('LicenseService', () => {
  let repository: InMemoryLicenseRepository
  let service: LicenseService
  let mockQueueService: any
  let mockLogger: Logger

  beforeEach(() => {
    repository = new InMemoryLicenseRepository()

    mockQueueService = {
      enqueueProvisioningJob: vi.fn().mockResolvedValue(undefined),
    }

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as any

    service = new LicenseService(repository as any, mockQueueService, mockLogger)
  })

  afterEach(() => {
    vi.restoreAllMocks()
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
      expect(mockQueueService.enqueueProvisioningJob).toHaveBeenCalledTimes(1)
    })

    it('should reject invalid slug format', async () => {
      const input: CreateLicenseRequest = {
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        workspace_slug: 'INVALID_SLUG',
        workspace_name: 'Test',
      }

      await expect(service.create(input, 'correlation-123')).rejects.toThrow(LicenseValidationError)
    })

    it('should reject slug that is too short', async () => {
      const input: CreateLicenseRequest = {
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        workspace_slug: 'ab',
        workspace_name: 'Test',
      }

      await expect(service.create(input, 'correlation-123')).rejects.toThrow(LicenseValidationError)
    })

    it('should enforce slug uniqueness', async () => {
      const input: CreateLicenseRequest = {
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        workspace_slug: 'acme',
        workspace_name: 'ACME',
      }

      await service.create(input, 'correlation-123')

      await expect(service.create(input, 'correlation-456')).rejects.toThrow(LicenseValidationError)
    })

    it('should reject negative student limit', async () => {
      const input: CreateLicenseRequest = {
        product_id: '550e8400-e29b-41d4-a716-446655440000',
        workspace_slug: 'test-corp',
        workspace_name: 'Test',
        student_limit: -10,
      }

      await expect(service.create(input, 'correlation-123')).rejects.toThrow(LicenseValidationError)
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
        default_language: 'zz',
      }

      await expect(service.create(input, 'correlation-123')).rejects.toThrow(LicenseValidationError)
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
      repository.setLicenseFields(licenseId, { status: LicenseStatus.ACTIVE })
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
      await service.softLock(licenseId, { grace_period_days: 90 }, 'correlation-456')

      await expect(
        service.softLock(licenseId, { grace_period_days: 90 }, 'correlation-789')
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
      repository.setLicenseFields(licenseId, {
        status: LicenseStatus.PROVISION_FAILED,
        provisioning_error: 'Initial provisioning failed',
        provisioning_retries: 0,
      })
    })

    it('should retry provisioning from PROVISION_FAILED', async () => {
      const updated = await service.retryProvisioning(licenseId, {}, 'correlation-456')

      expect(updated.status).toBe(LicenseStatus.PENDING_PROVISION)
      expect(updated.provisioning_retries).toBe(1)
      expect(updated.provisioning_error).toBeNull()
    })

    it('should reject retry from non-PROVISION_FAILED status', async () => {
      repository.setLicenseFields(licenseId, { status: LicenseStatus.ACTIVE })

      await expect(service.retryProvisioning(licenseId, {}, 'correlation-456')).rejects.toThrow(
        InvalidStateTransitionError
      )
    })

    it('should enforce retry limit', async () => {
      repository.setLicenseFields(licenseId, { provisioning_retries: 5 })

      await expect(service.retryProvisioning(licenseId, {}, 'correlation-456')).rejects.toThrow(
        ProvisioningError
      )
    })
  })
})
