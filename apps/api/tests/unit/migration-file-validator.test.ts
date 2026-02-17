/**
 * Unit tests for migration file validator (Task 41)
 * Tests migration-file-validator functions
 */

import {
  calculateChecksum,
  detectDestructiveOperations,
  detectMigrationGap,
  extractMigrationHeader,
  validateMigrationFile,
} from '@zidney/validation'

describe('MigrationFileValidator', () => {
  describe('extractMigrationHeader', () => {
    it('extracts target version', () => {
      const content = `-- Migration: 1.5.0\nCREATE TABLE foo (id UUID);`
      const header = extractMigrationHeader(content)
      expect(header.targetVersion).toBe('1.5.0')
    })

    it('extracts product version requirement', () => {
      const content = `-- Migration: 1.5.0\n-- Required Minimum Product Version: 1.2.0\nCREATE TABLE foo (id UUID);`
      const header = extractMigrationHeader(content)
      expect(header.targetProductVersion).toBe('1.2.0')
    })

    it('extracts breaking flag', () => {
      const content = `-- Migration: 2.0.0\n-- Breaking: true\nDROP TABLE users;`
      const header = extractMigrationHeader(content)
      expect(header.isBreaking).toBe(true)
    })

    it('throws when required header missing', () => {
      const content = 'CREATE TABLE foo (id UUID);'
      expect(() => extractMigrationHeader(content)).toThrow()
    })
  })

  describe('calculateChecksum', () => {
    it('produces consistent checksum for same content', () => {
      const content = 'CREATE TABLE foo (id UUID);'
      const hash1 = calculateChecksum(content)
      const hash2 = calculateChecksum(content)
      expect(hash1).toBe(hash2)
    })

    it('produces different checksums for different content', () => {
      const hash1 = calculateChecksum('CREATE TABLE foo (id UUID);')
      const hash2 = calculateChecksum('CREATE TABLE bar (id UUID);')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('detectDestructiveOperations', () => {
    it('detects DROP COLUMN', () => {
      const content = 'ALTER TABLE users DROP COLUMN email;'
      const ops = detectDestructiveOperations(content)
      expect(ops.length).toBeGreaterThan(0)
      expect(ops[0]).toContain('DROP COLUMN')
    })

    it('detects DROP TABLE', () => {
      const content = 'DROP TABLE users;'
      const ops = detectDestructiveOperations(content)
      expect(ops.length).toBeGreaterThan(0)
    })

    it('ignores CREATE TABLE', () => {
      const content = 'CREATE TABLE users (id UUID PRIMARY KEY);'
      const ops = detectDestructiveOperations(content)
      expect(ops.length).toBe(0)
    })
  })

  describe('detectMigrationGap', () => {
    it('accepts sequential files', () => {
      const files = ['001_init.sql', '002_users.sql', '003_posts.sql']
      const error = detectMigrationGap(files)
      expect(error).toBeNull()
    })

    it('rejects gap in sequence', () => {
      const files = ['001_init.sql', '003_posts.sql'] // missing 002
      const error = detectMigrationGap(files)
      expect(error).not.toBeNull()
      expect(error?.message).toContain('gap')
    })

    it('rejects if not starting at 001', () => {
      const files = ['002_init.sql', '003_posts.sql']
      const error = detectMigrationGap(files)
      expect(error).not.toBeNull()
    })
  })

  describe('validateMigrationFile', () => {
    it('validates well-formed migration', () => {
      const content = `-- Migration: 1.5.0\nCREATE TABLE users (id UUID PRIMARY KEY);`
      const result = validateMigrationFile('001_users.sql', content)
      expect(result.isValid).toBe(true)
    })

    it('detects destructive ops without MAJOR bump', () => {
      const content = `-- Migration: 1.5.0\nALTER TABLE users DROP COLUMN email;`
      const result = validateMigrationFile('002_drop_email.sql', content)
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('allows destructive ops with Breaking: true', () => {
      const content = `-- Migration: 2.0.0\n-- Breaking: true\nALTER TABLE users DROP COLUMN email;`
      const result = validateMigrationFile('003_major.sql', content)
      expect(result.isValid).toBe(true)
    })
  })
})
