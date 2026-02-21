/**
 * Master Database MMC Users Table Migration
 *
 * File: apps/api/src/db/master/migrations/20260217_003_create_mmc_users.ts
 * Date: 2026-02-17
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Create MMC (Platform Control) user table for platform-level authentication.
 * MMC users are platform administrators and operators (not workspace staff).
 * Stored in master database (not tenant databases).
 *
 * User Types:
 * - ADMIN: Full platform control (create tenants, manage licenses, etc.)
 * - OPERATOR: Read-only access to platform metrics, limited configuration
 *
 * Critical Isolation Rules:
 * - MMC users NEVER authenticate against tenant databases
 * - MMC tokens MUST NOT contain workspace_id
 * - MMC tokens have scope: "MMC" (not "BACKOFFICE" or "FRONTOFFICE")
 * - MMC queries are master_db only (never access tenant data)
 *
 * Authentication Fields:
 * - password_hash: bcrypt hash (required, set at user creation)
 * - token_version: Atomic counter for forced invalidation
 * - locked_until: Account lock for brute force protection (locked_until > NOW())
 * - failed_login_count: Counter for failed attempts (resets on success)
 *
 * Data Retention:
 * - Small dataset (<100 users typically)
 * - permanent records (no retention cleanup)
 * - Audit via master audit_logs table
 *
 * Compliance:
 * - ADR-0001: Database-per-tenant (master DB is global, not tenant-scoped)
 * - AGENTS.md: MMC authentication is in separate domain
 * - STAGE_03: Workspace isolation enforced (MMC tokens rejected for tenant APIs)
 */

import { PoolClient } from 'pg'

export const description =
  'Create MMC users table for platform-level authentication'

/**
 * Execute schema migration
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    -- ====================================================================
    -- CREATE TABLE: mmc_users (Platform administrators)
    -- ====================================================================
    -- Scope: Master database (not workspace-scoped)
    -- Purpose: Platform-level user authentication (admins, operators)
    -- Isolation: NEVER accessed from tenant context
    
    CREATE TABLE IF NOT EXISTS mmc_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      
      -- ================================================================
      -- IDENTITY
      -- ================================================================
      
      -- email: Unique platform user email
      -- Format: RFC 5322 email validation
      -- Uniqueness: UNIQUE constraint prevents duplicate accounts
      email VARCHAR(255) NOT NULL UNIQUE,
      
      -- ================================================================
      -- AUTHENTICATION
      -- ================================================================
      
      -- password_hash: bcrypt hash of user password
      -- Cost: 12 (balance between security and performance)
      -- Constraint: NOT NULL (all MMC users must have password)
      password_hash VARCHAR(255) NOT NULL,
      
      -- token_version: Atomic counter for JWT invalidation
      -- Default: 0
      -- Usage: When token_version changes, all existing tokens become invalid
      -- Increment: On logout-all, password change, role change, or security incident
      -- Guarantee: Stateless token revocation (no need to store token blocklist)
      token_version INTEGER NOT NULL DEFAULT 0,
      
      -- locked_until: Account lock timestamp (brute force protection)
      -- Type: TIMESTAMPTZ NULL
      -- Logic: If locked_until > NOW(), reject login (return 401)
      -- Auto-unlock: Expires naturally by time passage
      -- Threshold: Lock after 5 failed attempts (configurable)
      -- Duration: 5 minutes (configurable)
      locked_until TIMESTAMPTZ NULL,
      
      -- failed_login_count: Counter for consecutive failed login attempts
      -- Type: INTEGER NOT NULL DEFAULT 0
      -- Reset: After successful login (set to 0)
      -- Increment: After failed auth attempt
      -- Threshold: When >= 5, set locked_until = NOW() + LOCK_DURATION
      failed_login_count INTEGER NOT NULL DEFAULT 0,
      
      -- ================================================================
      -- AUTHORIZATION
      -- ================================================================
      
      -- role: Platform role (ADMIN or OPERATOR)
      -- Values: 'ADMIN' | 'OPERATOR'
      -- Constraint: CHECK restricts to valid values
      -- Immutability: Cannot change in Phase 1 (manual admin change only)
      -- JWT Claim: Included in token for permission evaluation
      role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'OPERATOR')),
      
      -- ================================================================
      -- STATUS
      -- ================================================================
      
      -- is_active: Soft delete flag
      -- Values: true (active), false (disabled/deleted)
      -- Usage: Can deactivate user without losing audit trail
      -- Query: WHERE is_active = true in most queries
      is_active BOOLEAN NOT NULL DEFAULT true,
      
      -- ================================================================
      -- TEMPORAL
      -- ================================================================
      
      -- created_at: User account creation timestamp (server-authoritative)
      -- Default: PostgreSQL NOW()
      -- Immutability: Never changed after creation
      -- Usage: Account age analysis, retention policy
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      
      -- updated_at: Last update timestamp (auto-updated on any modification)
      -- Default: PostgreSQL NOW()
      -- Trigger: Auto-update on any UPDATE statement
      -- Usage: Detect stale users, track recent activity
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      
      -- last_login: Last successful login timestamp
      -- Type: TIMESTAMPTZ NULL
      -- Update: After successful authentication
      -- Usage: Detect inactive accounts, security audits
      last_login TIMESTAMPTZ NULL,
      
      -- ================================================================
      -- CONSTRAINTS
      -- ================================================================
      
      CONSTRAINT valid_email CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$')
    );
    
    -- ====================================================================
    -- INDEXES
    -- ====================================================================
    
    -- Index 1: Primary lookup during login
    -- Query: SELECT * FROM mmc_users WHERE email = $1 AND is_active = true
    -- Used: User authentication (fast email lookup)
    CREATE INDEX IF NOT EXISTS idx_mmc_users_email 
      ON mmc_users(email) WHERE is_active = true;
    
    -- Index 2: Token version lookups during request validation
    -- Query: SELECT token_version FROM mmc_users WHERE id = $1
    -- Used: Request validation middleware
    CREATE INDEX IF NOT EXISTS idx_mmc_users_token_version 
      ON mmc_users(id, token_version);
    
    -- Index 3: Account lock expiry checks
    -- Query: SELECT * FROM mmc_users WHERE locked_until > NOW()
    -- Used: Check if account is currently locked
    CREATE INDEX IF NOT EXISTS idx_mmc_users_locked_until 
      ON mmc_users(locked_until) WHERE locked_until IS NOT NULL;
    
    -- Index 4: Failed login count range queries
    -- Query: SELECT * FROM mmc_users WHERE failed_login_count > 0
    -- Used: Security monitoring, detect problematic accounts
    CREATE INDEX IF NOT EXISTS idx_mmc_users_failed_login 
      ON mmc_users(failed_login_count) WHERE failed_login_count > 0;
    
    -- ====================================================================
    -- COMMENTS
    -- ====================================================================
    
    COMMENT ON TABLE mmc_users IS 
      'Platform-level users (admins, operators). Master DB only, never tenant-scoped.';
    
    COMMENT ON COLUMN mmc_users.token_version IS
      'Atomic counter for JWT token invalidation. Increment to revoke all sessions.';
    
    COMMENT ON COLUMN mmc_users.locked_until IS
      'Account lock expiration timestamp. If > NOW(), login rejected with 401.';
    
    COMMENT ON COLUMN mmc_users.role IS
      'Platform role: ADMIN (full control) or OPERATOR (read-only metrics).';
  `)
}

/**
 * Rollback migration
 */
export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS mmc_users CASCADE;
  `)
}
