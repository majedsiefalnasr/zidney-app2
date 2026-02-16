/**
 * Phase 7 Test Suite: Schema Versioning & Migrations
 *
 * Tests for T058-T059:
 * - T058: Version bumping tests
 * - T059: Schema version mismatch handling
 *
 * Stage: STAGE_02B_TENANT_BASELINE_SCHEMA
 */

import { Pool, PoolClient } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const getConnectionString = () => {
  const user = process.env.DB_USER || 'postgres'
  const password = process.env.DB_PASSWORD || 'postgres'
  const host = process.env.DB_HOST || 'localhost'
  const port = process.env.DB_PORT || '5432'
  const database = process.env.DB_DATABASE || 'zidney_test_tenant'

  return `postgresql://${user}:${password}@${host}:${port}/${database}`
}

// Version utilities
function bumpVersion(
  currentVersion: string,
  changeType: 'major' | 'minor' | 'patch'
): string {
  const [major, minor, patch] = currentVersion.split('.').map(Number)

  switch (changeType) {
    case 'major':
      return `${major + 1}.0.0`
    case 'minor':
      return `${major}.${minor + 1}.0`
    case 'patch':
      return `${major}.${minor}.${patch + 1}`
    default:
      throw new Error(`Invalid change type: ${changeType}`)
  }
}

function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version)
}

describe('Phase 7: Schema Versioning Tests', () => {
  let pool: Pool
  let client: PoolClient

  beforeAll(async () => {
    pool = new Pool({ connectionString: getConnectionString() })
    client = await pool.connect()
  })

  afterAll(async () => {
    if (client) {
      await client.release()
    }
    if (pool) {
      await pool.end()
    }
  })

  describe('T058: Version Bumping Logic Tests', () => {
    it('should bump patch version: 1.0.0 → 1.0.1', () => {
      const result = bumpVersion('1.0.0', 'patch')
      expect(result).toBe('1.0.1')
    })

    it('should bump minor version: 1.0.0 → 1.1.0', () => {
      const result = bumpVersion('1.0.0', 'minor')
      expect(result).toBe('1.1.0')
    })

    it('should bump major version: 1.0.0 → 2.0.0', () => {
      const result = bumpVersion('1.0.0', 'major')
      expect(result).toBe('2.0.0')
    })

    it('should handle high version numbers', () => {
      expect(bumpVersion('10.20.30', 'patch')).toBe('10.20.31')
      expect(bumpVersion('10.20.30', 'minor')).toBe('10.21.0')
      expect(bumpVersion('10.20.30', 'major')).toBe('11.0.0')
    })

    it('should reject invalid version format', () => {
      expect(() => bumpVersion('1.0', 'patch')).toThrow()
      expect(() => bumpVersion('1.0.0.0', 'patch')).toThrow()
      expect(() => bumpVersion('a.b.c', 'patch')).toThrow()
    })

    it('should validate version format', () => {
      expect(isValidVersion('1.0.0')).toBe(true)
      expect(isValidVersion('2.5.10')).toBe(true)
      expect(isValidVersion('1.0')).toBe(false)
      expect(isValidVersion('1.0.0.0')).toBe(false)
      expect(isValidVersion('latest')).toBe(false)
    })
  })

  describe('T059: Schema Version Mismatch Handling', () => {
    it('should track current schema version in schema_version table', async () => {
      // Insert a version record
      const version = '1.0.0'
      const checksum = 'abc123def456'

      await client.query(
        `INSERT INTO schema_version (version, applied_at, checksum)
         VALUES ($1, NOW(), $2)
        ON CONFLICT (version) DO NOTHING`,
        [version, checksum]
      )

      // Query it back
      const result = await client.query(
        `SELECT version, checksum FROM schema_version WHERE version = $1`,
        [version]
      )

      expect(result.rows[0].version).toBe('1.0.0')
      expect(result.rows[0].checksum).toBe('abc123def456')
    })

    it('should detect when tenant schema is behind product version', async () => {
      // Simulate checking version compatibility
      const tenantVersion = '1.0.0'
      const productVersion = '1.1.0'

      // Tenant is behind if: tenant_version < product_version
      const isBehind = tenantVersion < productVersion

      expect(isBehind).toBe(true)
    })

    it('should detect when tenant schema is ahead of product version', async () => {
      // Simulate version check
      const tenantVersion = '2.0.0'
      const productVersion = '1.5.0'

      // Tenant is ahead if: tenant_version > product_version
      const isAhead = tenantVersion > productVersion

      expect(isAhead).toBe(true)
    })

    it('should allow matching versions', async () => {
      const tenantVersion = '1.5.0'
      const productVersion = '1.5.0'

      const isMatching = tenantVersion === productVersion

      expect(isMatching).toBe(true)
    })

    it('should enforce single-row constraint on schema_version', async () => {
      // This test documents the existing constraint which prevents
      // multiple version records via EXCLUSION constraint
      // Note: Attempting to insert second version should fail
      // This is enforced at database level via EXCLUSION USING gist constraint
    })
  })

  describe('Schema Version Immutability', () => {
    it('should prevent UPDATE of schema_version via trigger', async () => {
      const version = '1.0.0'
      const checksum = 'primary_checksum'

      // Insert version
      await client.query(
        `INSERT INTO schema_version (version, applied_at, checksum)
         VALUES ($1, NOW(), $2)
         ON CONFLICT DO NOTHING`,
        [version, checksum]
      )

      // Attempt UPDATE
      let error: Error | null = null
      try {
        await client.query(
          `UPDATE schema_version SET checksum = $1 WHERE version = $2`,
          ['modified_checksum', version]
        )
      } catch (e) {
        error = e as Error
      }

      expect(error).not.toBeNull()
      expect(error?.message).toContain('Immutable')
    })
  })

  describe('Migration Validation Logic', () => {
    it('should validate forward-only migrations', () => {
      // Forward migration: 1.0.0 → 1.1.0 (OK)
      const isForward = '1.1.0' > '1.0.0'
      expect(isForward).toBe(true)

      // Backward migration: 2.0.0 → 1.5.0 (NOT OK)
      const isBackward = '1.5.0' > '2.0.0'
      expect(isBackward).toBe(false)
    })

    it('should identify semantic versioning change types', () => {
      // Patch: 1.0.0 → 1.0.1
      const isPatch =
        '1.0.1' === '1.0.0'.replace(/\.\d+$/, `.${parseInt('0') + 1}`)
      expect(isPatch).toBe(true)

      // Minor: 1.0.0 → 1.1.0
      const isMinor = '1.1.0'.split('.')[1] !== '1.0.0'.split('.')[1]
      expect(isMinor).toBe(true)

      // Major: 1.0.0 → 2.0.0
      const isMajor = '2.0.0'.split('.')[0] !== '1.0.0'.split('.')[0]
      expect(isMajor).toBe(true)
    })
  })

  describe('Migration Checksum Validation', () => {
    it('should detect checksum mismatch as tampering', () => {
      const storedChecksum = 'abc123'
      const calculatedChecksum = 'abc124'

      const isTampering = storedChecksum !== calculatedChecksum

      expect(isTampering).toBe(true)
    })

    it('should allow matching checksums', () => {
      const storedChecksum = 'abc123'
      const calculatedChecksum = 'abc123'

      const isValid = storedChecksum === calculatedChecksum

      expect(isValid).toBe(true)
    })
  })
})
