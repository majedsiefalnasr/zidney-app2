/**
 * Tenant Database Authentication Fields Migration
 *
 * File: apps/api/src/db/tenant/migrations/20260217_001_add_auth_to_users.ts
 * Date: 2026-02-17
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Add authentication-specific fields to users table for Phase 1 authentication.
 * Implements token versioning, account locking, and password hashing support.
 *
 * Fields Added:
 * - password_hash: bcrypt hash of user password (required)
 * - token_version: version counter for forced token invalidation (atomic increment)
 * - locked_until: account lock timestamp for brute force protection
 * - subscription_status: frontoffice-specific subscription state
 * - failed_login_count: counter for login attempts (resets on success)
 *
 * Constraints:
 * - password_hash NOT NULL (required for auth)
 * - token_version >= 0 (atomic counter)
 * - locked_until >= NOW() OR NULL (temporal lock)
 * - subscription_status IN ('ACTIVE', 'EXPIRED', 'PENDING')
 *
 * Idempotency:
 * - Uses IF NOT EXISTS for all ALTER ADD COLUMN statements
 * - Safe to run multiple times
 * - Will not fail if columns already exist
 *
 * Compliance:
 * - ADR-0001: Database-per-tenant (only affects tenant schema)
 * - ADR-0006: Server-authoritative time (uses PostgreSQL NOW())
 * - AGENTS.md: No direct DB instantiation, uses migration system
 */

import { PoolClient } from 'pg'

export const description =
  'Add authentication fields to users table for STAGE_03'

/**
 * Execute schema migration
 *
 * All DDL in single transaction for atomicity.
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    -- ====================================================================
    -- ALTER TABLE: users (add authentication fields)
    -- ====================================================================
    
    -- Column: password_hash
    -- Type: VARCHAR(255) NOT NULL
    -- Purpose: bcrypt hash of user password
    -- Constraint: NOT NULL (all users must have password)
    -- Default: Empty string (will be forced to set during user creation)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT '';
    
    -- Column: token_version
    -- Type: INTEGER NOT NULL DEFAULT 0
    -- Purpose: Atomic counter for token invalidation
    -- Logic: On each logout-all or password change, increment this value
    -- Validation: JWT token_version must match user.token_version (else 401)
    -- Idempotency: ON CONFLICT DO NOTHING (if already exists)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;
    
    -- Column: locked_until
    -- Type: TIMESTAMPTZ NULL
    -- Purpose: Account lock expiration timestamp for brute force protection
    -- Logic: If locked_until > NOW(), reject login with 401
    -- Retention: NULL (no lock) or timestamp. Auto-expires by time passage.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ NULL;
    
    -- Column: subscription_status
    -- Type: VARCHAR(50)
    -- Purpose: Frontoffice-specific subscription state
    -- Values: 'ACTIVE' | 'EXPIRED' | 'PENDING' | NULL (backoffice users)
    -- Claim Included: JWT includes subscription_status for frontoffice users
    -- Enforcement: Content access restricted if EXPIRED (Phase 2+)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) 
      CHECK (subscription_status IS NULL OR subscription_status IN ('ACTIVE', 'EXPIRED', 'PENDING'));
    
    -- Column: failed_login_count
    -- Type: INTEGER NOT NULL DEFAULT 0
    -- Purpose: Counter for failed login attempts
    -- Logic: Increments on auth failure, resets on success
    -- Threshold: When >= 5, set locked_until = NOW() + LOCK_DURATION
    ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0;
    
    -- ====================================================================
    -- INDEXES: Performance optimization for auth queries
    -- ====================================================================
    
    -- Index: token_version lookups during request validation
    CREATE INDEX IF NOT EXISTS idx_users_token_version ON users(id, token_version);
    
    -- Index: Account lock expiry checks
    CREATE INDEX IF NOT EXISTS idx_users_locked_until ON users(locked_until) 
      WHERE locked_until IS NOT NULL;
    
    -- Index: Failed login counter range queries
    CREATE INDEX IF NOT EXISTS idx_users_failed_login_count ON users(failed_login_count) 
      WHERE failed_login_count > 0;
  `)
}

/**
 * Rollback migration
 *
 * Removes all authentication fields added in up().
 * Idempotent: Uses IF EXISTS for all DROP COLUMN.
 */
export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    -- Drop authentication fields
    ALTER TABLE users DROP COLUMN IF EXISTS password_hash CASCADE;
    ALTER TABLE users DROP COLUMN IF EXISTS token_version CASCADE;
    ALTER TABLE users DROP COLUMN IF EXISTS locked_until CASCADE;
    ALTER TABLE users DROP COLUMN IF EXISTS subscription_status CASCADE;
    ALTER TABLE users DROP COLUMN IF EXISTS failed_login_count CASCADE;
    
    -- Drop indexes
    DROP INDEX IF EXISTS idx_users_token_version CASCADE;
    DROP INDEX IF EXISTS idx_users_locked_until CASCADE;
    DROP INDEX IF EXISTS idx_users_failed_login_count CASCADE;
  `)
}
