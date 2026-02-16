/**
 * Master Database Provisioning Tasks Table Migration
 *
 * File: apps/api/src/db/master/migrations/20250216_002_create_provisioning_tasks.ts
 * Date: 2026-02-16
 * Phase: Pre-Production Hardening
 * Status: CRITICAL - Idempotency enforcement
 *
 * Purpose:
 * Track all schema provisioning tasks (INIT_TENANT_SCHEMA) to prevent duplicate execution.
 * Idempotency is enforced at DB level via UNIQUE constraint.
 * Worker tasks reference this table to detect and skip redundant operations.
 *
 * Critical Requirement (PRINCIPAL_ENGINEER_FEEDBACK):
 * - UNIQUE(workspace_id, idempotency_key) prevents concurrent duplicate task enqueue
 * - DB-level enforcement (not app logic)
 * - Worker must handle constraint violation gracefully (200 OK if already provisioned)
 *
 * Properties:
 * - Transaction: YES (single atomic transaction)
 * - Idempotency: YES (CREATE TABLE IF NOT EXISTS)
 * - Rollback: Automatic on any error
 * - Dependencies: tenants_registry table must exist
 */

import { PoolClient } from 'pg'

export const description =
  'Create provisioning_tasks table for idempotent schema initialization tracking'

/**
 * Execute schema migration
 *
 * All DDL in single transaction for atomicity.
 * If any statement fails, entire transaction rolls back automatically.
 */
export async function up(client: PoolClient): Promise<void> {
  // ========================================================================
  // TABLE: provisioning_tasks
  // ========================================================================
  // Purpose: Track all tenant schema provisioning operations
  // Idempotency: UNIQUE(workspace_id, idempotency_key)
  // State tracking: Detect completed, in-progress, failed provisions
  // Audit trail: Record who/when each provisioning occurred
  //
  // Status values:
  // - PENDING: Task enqueued, waiting for worker
  // - IN_PROGRESS: Worker began execution
  // - COMPLETED: Schema fully initialized
  // - FAILED: Worker encountered non-recoverable error
  // - DLQ: Dead-lettered after max retries
  //
  // Indexes:
  // - PRIMARY KEY (id) - automatic index
  // - UNIQUE (workspace_id, idempotency_key) - CRITICAL for idempotency
  // - (workspace_id, status) - filter by workspace + state
  // - (created_at) - time-based queries (debugging)
  //
  // Constraints:
  // - workspace_id NOT NULL, FK to tenants_registry
  // - idempotency_key NOT NULL, max 255 chars, alphanumeric
  // - status NOT NULL, controlled enum
  // - error_message nullable (only set on FAILED/DLQ)
  //
  await client.query(`
    CREATE TABLE IF NOT EXISTS provisioning_tasks (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      workspace_id UUID NOT NULL REFERENCES tenants_registry(id) ON DELETE CASCADE,
      idempotency_key VARCHAR(255) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'DLQ')),
      task_type VARCHAR(50) NOT NULL DEFAULT 'INIT_TENANT_SCHEMA' CHECK (task_type IN ('INIT_TENANT_SCHEMA', 'APPLY_MIGRATION')),
      attempt_count INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      error_code VARCHAR(100),
      error_message TEXT,
      started_at TIMESTAMP WITH TIME ZONE,
      completed_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      created_by UUID,
      
      -- CRITICAL: Idempotency constraint to prevent duplicate task enqueue
      CONSTRAINT provisioning_tasks_workspace_idempotency_unique UNIQUE (workspace_id, idempotency_key),
      
      -- Validation constraints
      CONSTRAINT idempotency_key_not_empty CHECK (idempotency_key <> ''),
      CONSTRAINT idempotency_key_format CHECK (idempotency_key ~ '^[a-z0-9_-]{1,255}$'),
      CONSTRAINT task_type_not_empty CHECK (task_type <> ''),
      CONSTRAINT attempt_count_non_negative CHECK (attempt_count >= 0),
      CONSTRAINT max_attempts_positive CHECK (max_attempts > 0),
      CONSTRAINT status_consistency CHECK (
        (status = 'PENDING' AND attempt_count = 0 AND started_at IS NULL) OR
        (status = 'IN_PROGRESS' AND attempt_count > 0 AND started_at IS NOT NULL) OR
        (status IN ('COMPLETED', 'FAILED', 'DLQ') AND completed_at IS NOT NULL)
      )
    );

    COMMENT ON TABLE provisioning_tasks IS 'Master registry for tenant schema provisioning tasks. Prevents duplicate execution via workspace_id + idempotency_key UNIQUE constraint (DB-level enforcement).';
    COMMENT ON COLUMN provisioning_tasks.id IS 'Task instance ID (global unique)';
    COMMENT ON COLUMN provisioning_tasks.workspace_id IS 'Tenant workspace being provisioned';
    COMMENT ON COLUMN provisioning_tasks.idempotency_key IS 'Idempotency token (format: alphanumeric_hyphen_underscore)';
    COMMENT ON COLUMN provisioning_tasks.status IS 'Task lifecycle state: PENDING → IN_PROGRESS → COMPLETED|FAILED|DLQ';
    COMMENT ON COLUMN provisioning_tasks.task_type IS 'Task classification (INIT_TENANT_SCHEMA for baseline, APPLY_MIGRATION for updates)';
    COMMENT ON COLUMN provisioning_tasks.attempt_count IS 'Number of worker retry attempts so far';
    COMMENT ON COLUMN provisioning_tasks.max_attempts IS 'Maximum retry attempts before DLQ escalation (default: 3)';
    COMMENT ON COLUMN provisioning_tasks.error_code IS 'Error classification code (set only on failure)';
    COMMENT ON COLUMN provisioning_tasks.error_message IS 'Human-readable error details (set only on failure)';
    COMMENT ON COLUMN provisioning_tasks.started_at IS 'Worker execution start time';
    COMMENT ON COLUMN provisioning_tasks.completed_at IS 'Worker execution completion time (whether success or failure)';

    -- Indexes for efficient queries
    CREATE INDEX IF NOT EXISTS idx_provisioning_tasks_workspace_id ON provisioning_tasks(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_provisioning_tasks_workspace_status ON provisioning_tasks(workspace_id, status) WHERE status IN ('PENDING', 'IN_PROGRESS');
    CREATE INDEX IF NOT EXISTS idx_provisioning_tasks_status ON provisioning_tasks(status) WHERE status IN ('PENDING', 'IN_PROGRESS');
    CREATE INDEX IF NOT EXISTS idx_provisioning_tasks_created_at ON provisioning_tasks(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_provisioning_tasks_completed_at ON provisioning_tasks(completed_at DESC) WHERE completed_at IS NOT NULL;

    -- Index on idempotency_key for fast duplicate detection
    CREATE INDEX IF NOT EXISTS idx_provisioning_tasks_idempotency_key ON provisioning_tasks(idempotency_key);
  `)
}

export default { up, description }
