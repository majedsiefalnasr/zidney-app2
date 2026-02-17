/**
 * Tenant Database Audit Logs Table Migration
 *
 * File: apps/api/src/db/tenant/migrations/20260217_002_create_audit_logs.ts
 * Date: 2026-02-17
 * Phase: STAGE_03_AUTHENTICATION_SYSTEM
 * Status: IN PROGRESS
 *
 * Purpose:
 * Create comprehensive audit trail for all authentication events.
 * Enables forensic analysis, compliance reporting, and security incident investigation.
 *
 * Events Captured:
 * - login_success: Successful user login (with role/division info)
 * - login_failed: Failed authentication attempt
 * - account_locked: Account locked after max failed attempts
 * - token_issued: JWT token created
 * - token_invalidated: Token version incremented (logout-all)
 * - token_version_mismatch: Request rejected due to stale token_version
 * - workspace_mismatch: Cross-workspace token rejected
 * - schema_mismatch: Token schema_version incompatible (426 error)
 * - license_blocked: Request blocked due to workspace license state
 * - permission_denied: RBAC permission check failed (403)
 * - logout: User logout (optional for Phase 1)
 * - role_changed: User role modified
 * - password_changed: User password changed
 * - account_unlocked: Account automatically unlocked
 *
 * Structured Logging (JSON):
 * - correlation_id: Request tracing (links all events in single request)
 * - workspace_slug: Tenant identifier
 * - user_id: Subject of the audit event
 * - user_email: Email for post-auth queries (when deleted user events occur)
 * - event_type: One of values above
 * - result: SUCCESS | FAILURE | BLOCKED
 * - metadata: Event-specific data (e.g., ip_address, user_agent, reason)
 * - timestamp: Server authoritative time (PostgreSQL NOW())
 * - ip_address: Client IP for forensic analysis
 * - user_agent: Client user agent string
 *
 * Data Retention:
 * - Phase 1: 90 days (cleanup job optional)
 * - Phase 2+: Configurable retention policy
 * - Immutable after insert (no updates, hard deletes only!)
 *
 * Compliance:
 * - ADR-0001: Database-per-tenant (each workspace has own audit logs)
 * - AGENTS.md: Structured logging with correlation_id + workspace_slug
 * - GDPR: Support for right-to-be-forgotten (user_id → anonymized)
 */

import { PoolClient } from 'pg'

export const description =
  'Create audit_logs table for authentication event tracking'

/**
 * Execute schema migration
 */
export async function up(client: PoolClient): Promise<void> {
  await client.query(`
    -- ====================================================================
    -- CREATE TABLE: audit_logs
    -- ====================================================================
    -- Purpose: Immutable audit trail for all authentication events
    -- Retention: 90 days (cleanup via worker job)
    -- Idempotency: CREATE TABLE IF NOT EXISTS
    -- Immutability: No UPDATE triggers, only INSERT and DELETE
    
    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      
      -- ================================================================
      -- EVENT IDENTIFICATION
      -- ================================================================
      
      -- correlation_id: Links all events in a single HTTP request
      -- Used for distributed tracing across services
      -- Format: UUID v4 or custom string (max 50 chars)
      correlation_id VARCHAR(50) NOT NULL,
      
      -- event_type: Category of auth event
      -- Values: login_success, login_failed, account_locked, token_issued, etc.
      event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
        'login_success', 'login_failed', 'account_locked', 'token_issued',
        'token_invalidated', 'token_version_mismatch', 'workspace_mismatch',
        'schema_mismatch', 'license_blocked', 'permission_denied', 'logout',
        'role_changed', 'password_changed', 'account_unlocked'
      )),
      
      -- result: Outcome of the event
      -- Values: SUCCESS, FAILURE, BLOCKED
      result VARCHAR(20) NOT NULL CHECK (result IN ('SUCCESS', 'FAILURE', 'BLOCKED')),
      
      -- ================================================================
      -- SUBJECT INFORMATION
      -- ================================================================
      
      -- user_id: Subject of the audit event (who the event is about)
      -- Foreign key: users(id) with ON DELETE SET NULL (preserve audit trail)
      user_id UUID,
      
      -- user_email: Email for post-event queries (when user deleted)
      -- Stored denormalized for forensic analysis
      user_email VARCHAR(255),
      
      -- ================================================================
      -- CONTEXT INFORMATION
      -- ================================================================
      
      -- workspace_slug: Tenant identifier for multi-tenant filtering
      -- Used for: Audit log export, compliance reports, incident investigation
      workspace_slug VARCHAR(100) NOT NULL,
      
      -- ================================================================
      -- NETWORK & REQUEST INFORMATION
      -- ================================================================
      
      -- ip_address: Client IP address for forensic analysis
      -- Can detect: Account takeover attempts, suspicious geographies
      ip_address INET,
      
      -- user_agent: Client user agent string for forensic analysis
      user_agent TEXT,
      
      -- ================================================================
      -- EVENT DETAILS (JSONB)
      -- ================================================================
      
      -- metadata: Event-specific JSON data
      -- Examples:
      --   login_failed: { "reason": "invalid_password", "failed_count": 2 }
      --   token_issued: { "token_version": 1, "schema_version": "1.0.0" }
      --   permission_denied: { "permission_code": "exam:submit", "resource_id": "..." }
      --   workspace_mismatch: { "token_workspace": "...", "resolved_workspace": "..." }
      -- Queries: Use JSONB operators for forensic queries (e.g., -> 'reason')
      metadata JSONB DEFAULT '{}'::jsonb,
      
      -- ================================================================
      -- VERSIONING INFORMATION
      -- ================================================================
      
      -- schema_version: Schema version at time of event
      -- Used: Detect schema incompatibility incidents
      schema_version VARCHAR(20),
      
      -- product_version: Product version at time of event
      -- Used: Track events during upgrade windows
      product_version VARCHAR(20),
      
      -- ================================================================
      -- TEMPORAL INFORMATION
      -- ================================================================
      
      -- timestamp: Server-authoritative time (when event occurred)
      -- Used: Event ordering, retention policy, time-series analysis
      -- Default: PostgreSQL NOW() for atomic time accuracy
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      
      -- ================================================================
      -- CONSTRAINTS & INDEXES
      -- ================================================================
      
      CONSTRAINT fk_audit_logs_user 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );
    
    -- ====================================================================
    -- INDEXES: Query optimization for audit log queries
    -- ====================================================================
    
    -- Index 1: Find all events for a specific user
    -- Query: SELECT * FROM audit_logs WHERE user_id = $1 AND workspace_slug = $2
    -- Used: User activity history, post-incident investigation
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id 
      ON audit_logs(user_id, workspace_slug, timestamp DESC);
    
    -- Index 2: Find all events in a specific workspace
    -- Query: SELECT * FROM audit_logs WHERE workspace_slug = $1 AND timestamp >= $2
    -- Used: Compliance exports, workspace-wide incident analysis
    CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace 
      ON audit_logs(workspace_slug, timestamp DESC);
    
    -- Index 3: Find all events by type (e.g., all failed logins in time window)
    -- Query: SELECT * FROM audit_logs WHERE event_type = 'login_failed' AND timestamp >= $1
    -- Used: Security monitoring, attack detection (rapid failed logins)
    CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type 
      ON audit_logs(event_type, timestamp DESC);
    
    -- Index 4: Find events by correlation_id (all steps in single request)
    -- Query: SELECT * FROM audit_logs WHERE correlation_id = $1
    -- Used: Distributed tracing, request forensics
    CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id 
      ON audit_logs(correlation_id);
    
    -- Index 5: Find events by result (all failures or blocked attempts)
    -- Query: SELECT * FROM audit_logs WHERE result = 'FAILURE' AND timestamp >= $1
    -- Used: Failure rate analysis, security incident detection
    CREATE INDEX IF NOT EXISTS idx_audit_logs_result 
      ON audit_logs(result, timestamp DESC);
    
    -- Index 6: Retention cleanup query (90-day old records)
    -- Query: DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '90 days'
    -- Used: Automated data retention enforcement
    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp 
      ON audit_logs(timestamp DESC);
    
    -- ====================================================================
    -- COMMENTS
    -- ====================================================================
    
    COMMENT ON TABLE audit_logs IS 
      'Immutable audit trail for all authentication events. Enables forensic analysis, '
      'compliance reporting, and security incident investigation. 90-day retention.';
    
    COMMENT ON COLUMN audit_logs.correlation_id IS
      'Request tracing ID linking all events in a single HTTP request. Used for distributed tracing.';
    
    COMMENT ON COLUMN audit_logs.event_type IS
      'Category of authentication event (login_success, login_failed, token_issued, etc.)';
    
    COMMENT ON COLUMN audit_logs.metadata IS
      'Event-specific JSON data for forensic analysis. Queryable with JSONB operators.';
    
    COMMENT ON COLUMN audit_logs.timestamp IS
      'Server-authoritative timestamp. PostgreSQL NOW() ensures atomic time accuracy.';
    
    -- ====================================================================
    -- IMMUTABILITY ENFORCEMENT
    -- ====================================================================
    -- Prevent UPDATE on audit_logs table to maintain compliance audit trail
    -- Audit logs are append-only; only INSERT and DELETE (retention) allowed
    
    CREATE OR REPLACE FUNCTION prevent_audit_logs_update()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'audit_logs table is immutable. UPDATE operations are not allowed. '
        'The only allowed operations are INSERT (audit logging) and DELETE (retention policy). '
        'Attempted to update: ' || TO_JSON(NEW)::text;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Attach trigger to prevent UPDATE
    DROP TRIGGER IF EXISTS audit_logs_prevent_update ON audit_logs CASCADE;
    CREATE TRIGGER audit_logs_prevent_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_audit_logs_update();
    
    COMMENT ON FUNCTION prevent_audit_logs_update() IS
      'Trigger function enforcing immutability of audit_logs table. Raises exception on any UPDATE attempt.';
  `)
}

/**
 * Rollback migration
 */
export async function down(client: PoolClient): Promise<void> {
  await client.query(`
    DROP TABLE IF EXISTS audit_logs CASCADE;
  `)
}
