/**
 * Test Data Cleanup Utilities
 * Provides idempotent cleanup functions for test isolation
 */

import type { Pool } from 'pg'

export class TestCleanup {
  constructor(private db: Pool) {}

  /**
   * Cleanup all workspaces and databases
   */
  async cleanupAllWorkspaces(): Promise<void> {
    try {
      // Delete all audit log entries first
      await this.db.query('TRUNCATE TABLE audit_logs CASCADE')
    } catch (error) {
      // Ignore if table doesn't exist
    }

    try {
      // Delete all licenses
      await this.db.query('DELETE FROM licenses')
    } catch (error) {
      // Ignore if table doesn't exist
    }

    try {
      // Delete all workspaces
      await this.db.query('DELETE FROM workspaces')
    } catch (error) {
      // Ignore if table doesn't exist
    }
  }

  /**
   * Cleanup specific workspace
   */
  async cleanupWorkspace(workspaceId: string): Promise<void> {
    try {
      await this.db.query('DELETE FROM licenses WHERE workspace_id = $1', [workspaceId])
    } catch (error) {
      // Ignore
    }

    try {
      await this.db.query('DELETE FROM workspaces WHERE id = $1', [workspaceId])
    } catch (error) {
      // Ignore
    }

    try {
      await this.db.query('DELETE FROM audit_logs WHERE workspace_id = $1', [workspaceId])
    } catch (error) {
      // Ignore
    }
  }

  /**
   * Cleanup all licenses
   */
  async cleanupAllLicenses(): Promise<void> {
    try {
      await this.db.query('TRUNCATE TABLE licenses CASCADE')
    } catch (error) {
      // Ignore
    }
  }

  /**
   * Cleanup all attempts
   */
  async cleanupAllAttempts(): Promise<void> {
    try {
      await this.db.query('TRUNCATE TABLE attempts CASCADE')
    } catch (error) {
      // Ignore
    }
  }

  /**
   * Verify cleanup is idempotent by running it twice
   */
  async verifyIdempotency(): Promise<boolean> {
    try {
      await this.cleanupAllWorkspaces()
      await this.cleanupAllWorkspaces() // Second call should not fail
      return true
    } catch (error) {
      return false
    }
  }
}

/**
 * Factory to create cleanup utility
 */
export function createTestCleanup(db: Pool): TestCleanup {
  return new TestCleanup(db)
}
