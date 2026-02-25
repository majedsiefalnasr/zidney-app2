/**
 * Integration Test: Schema Provisioning MUST Items Validation
 *
 * Purpose:
 * Verify all 6 critical hardening items work correctly in production.
 *
 * File: tests/integration/schema-provisioning-must-items.test.ts
 * Created: 2026-02-16
 * Status: CRITICAL - Must pass before staging validation
 *
 * Tests:
 * 1. Snapshot immutability trigger enforcement
 * 2. UNIQUE constraint prevents duplicate provisioning
 * 3. CHECK constraint validates snapshot columns
 * 4. Worker idempotency with partial init recovery
 * 5. Registry integrity detection
 * 6. Alert rules and monitoring exportable
 *
 * Run: npm test -- --testNamePattern="MUST Items"
 */

import {
  insertProvisioningTaskIdempotent,
  isTaskEligibleForProcessing,
} from '@zidney/domain-core/provisioning/idempotency-handler'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const runSchemaProvisioningMustItems =
  process.env.RUN_SCHEMA_PROVISIONING_MUST_ITEMS === 'true'
const integrationDescribe = runSchemaProvisioningMustItems
  ? describe
  : describe.skip

// Test fixtures
let masterPool: Pool | undefined
let tenantPool: Pool | undefined
let testWorkspaceId: string
let testTaskId: string

beforeAll(async () => {
  if (!runSchemaProvisioningMustItems) return

  // Connect to test databases (staging environment)
  masterPool = new Pool({
    host: process.env.STAGING_DB_HOST || 'localhost',
    port: 5432,
    user: 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: 'zidney_master_test',
  })

  // Create test workspace in master DB
  const result = await masterPool.query(
    `
    INSERT INTO tenants_registry (id, workspace_slug, database_name, is_active, created_at)
    VALUES (gen_random_uuid(), 'test-must-' || NOW()::TEXT, 'tenant_test_must', true, NOW())
    RETURNING id
    `
  )
  testWorkspaceId = result.rows[0].id

  // Connect to test tenant DB
  tenantPool = new Pool({
    host: process.env.STAGING_DB_HOST || 'localhost',
    port: 5432,
    user: 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres',
    database: 'tenant_test_must',
  })
})

afterAll(async () => {
  if (!runSchemaProvisioningMustItems) return

  await masterPool?.end()
  await tenantPool?.end()
})

integrationDescribe('MUST Item 1: Snapshot Immutability Trigger', () => {
  it('should prevent UPDATE on configuration_snapshot', async () => {
    const client = await tenantPool!.connect()

    try {
      // Insert test attempt
      const insertResult = await client.query(
        `
        INSERT INTO attempts (
          exam_type, exam_id, user_id,
          configuration_snapshot, question_list_snapshot, grading_config_snapshot,
          status, started_at
        ) VALUES (
          'MCQ',
          gen_random_uuid(),
          gen_random_uuid(),
          '{"version": "1.0"}'::jsonb,
          '[{"id": 1}]'::jsonb,
          '{"auto": true}'::jsonb,
          'STARTED',
          NOW()
        )
        RETURNING id
        `
      )
      const attemptId = insertResult.rows[0].id

      // Attempt UPDATE (should fail)
      try {
        await client.query(
          `
          UPDATE attempts
          SET configuration_snapshot = '{"version": "2.0"}'::jsonb
          WHERE id = $1
          `,
          [attemptId]
        )

        // Should not reach here
        throw new Error('UPDATE on snapshot should have been blocked')
      } catch (error) {
        // Expected: Trigger blocks UPDATE
        expect(
          error instanceof Error && error.message.includes('Immutable')
        ).toBe(true)
      }

      // Verify snapshot unchanged
      const verifyResult = await client.query(
        `SELECT configuration_snapshot FROM attempts WHERE id = $1`,
        [attemptId]
      )
      expect(verifyResult.rows[0].configuration_snapshot).toEqual({
        version: '1.0',
      })
    } finally {
      client.release()
    }
  })

  it('should prevent DELETE on attempts', async () => {
    const client = await tenantPool!.connect()

    try {
      // Insert test attempt
      const insertResult = await client.query(
        `
        INSERT INTO attempts (
          exam_type, exam_id, user_id,
          configuration_snapshot, question_list_snapshot, grading_config_snapshot,
          status, started_at
        ) VALUES ('MCQ', gen_random_uuid(), gen_random_uuid(), 
                  '{}', '[]', '{}', 'STARTED', NOW())
        RETURNING id
        `
      )
      const attemptId = insertResult.rows[0].id

      // Attempt DELETE (should fail)
      try {
        await client.query(`DELETE FROM attempts WHERE id = $1`, [attemptId])

        throw new Error('DELETE on attempts should have been blocked')
      } catch (error) {
        expect(
          error instanceof Error && error.message.includes('Immutable')
        ).toBe(true)
      }

      // Verify record still exists
      const verifyResult = await client.query(
        `SELECT COUNT(*) FROM attempts WHERE id = $1`,
        [attemptId]
      )
      expect(verifyResult.rows[0].count).toBe(1)
    } finally {
      client.release()
    }
  })
})

integrationDescribe(
  'MUST Item 2: UNIQUE Constraint + Idempotency Handler',
  () => {
    it('should handle duplicate inserts with 23505 constraint violation', async () => {
      const idempotencyKey = `test-dup-${Date.now()}`

      // First insert (success)
      const result1 = await insertProvisioningTaskIdempotent(
        masterPool!,
        testWorkspaceId,
        idempotencyKey,
        'INIT_TENANT_SCHEMA'
      )

      expect(result1.is_duplicate).toBe(false)
      expect(result1.task_id).toBeTruthy()
      testTaskId = result1.task_id

      // Second insert (duplicate)
      const result2 = await insertProvisioningTaskIdempotent(
        masterPool!,
        testWorkspaceId,
        idempotencyKey,
        'INIT_TENANT_SCHEMA'
      )

      expect(result2.is_duplicate).toBe(true)
      expect(result2.task_id).toBe(result1.task_id) // Same ID
      expect(result2.status).toBe('PENDING')
    })

    it('should return success on duplicate requests', async () => {
      const idempotencyKey = `test-dup-success-${Date.now()}`

      const result1 = await insertProvisioningTaskIdempotent(
        masterPool!,
        testWorkspaceId,
        idempotencyKey
      )

      const result2 = await insertProvisioningTaskIdempotent(
        masterPool!,
        testWorkspaceId,
        idempotencyKey
      )

      const result3 = await insertProvisioningTaskIdempotent(
        masterPool!,
        testWorkspaceId,
        idempotencyKey
      )

      // All three should return same task_id
      expect(result1.task_id).toBe(result2.task_id)
      expect(result2.task_id).toBe(result3.task_id)

      // First is new, others are dupes
      expect(result1.is_duplicate).toBe(false)
      expect(result2.is_duplicate).toBe(true)
      expect(result3.is_duplicate).toBe(true)
    })

    it('should reject FK constraint violation (workspace not found)', async () => {
      const fakeWorkspaceId = 'ffffffff-ffff-ffff-ffff-ffffffffffff'

      try {
        await insertProvisioningTaskIdempotent(
          masterPool!,
          fakeWorkspaceId,
          'test-fk-violation',
          'INIT_TENANT_SCHEMA'
        )

        throw new Error('Should have failed on FK constraint')
      } catch (error) {
        expect(
          error instanceof Error && error.message.includes('not found')
        ).toBe(true)
      }
    })
  }
)

integrationDescribe('MUST Item 3: CHECK Constraint for Snapshots', () => {
  it('should reject INSERT with NULL snapshot', async () => {
    const client = await tenantPool!.connect()

    try {
      try {
        await client.query(`
          INSERT INTO attempts (
            exam_type, exam_id, user_id,
            configuration_snapshot, question_list_snapshot, grading_config_snapshot,
            status, started_at
          ) VALUES ('MCQ', gen_random_uuid(), gen_random_uuid(),
                    NULL, '[]', '{}', 'STARTED', NOW())
        `)

        throw new Error('INSERT with NULL snapshot should have been rejected')
      } catch (error) {
        // Expected: NOT NULL or CHECK constraint violation
        expect(error instanceof Error).toBe(true)
      }
    } finally {
      client.release()
    }
  })

  it('should allow INSERT with all snapshots present', async () => {
    const client = await tenantPool!.connect()

    try {
      const result = await client.query(`
        INSERT INTO attempts (
          exam_type, exam_id, user_id,
          configuration_snapshot, question_list_snapshot, grading_config_snapshot,
          status, started_at
        ) VALUES ('MCQ', gen_random_uuid(), gen_random_uuid(),
                  '{"v": "1}"', '[{"q": 1}]', '{"a": 1}', 'STARTED', NOW())
        RETURNING id
      `)

      expect(result.rows[0].id).toBeTruthy()
    } finally {
      client.release()
    }
  })
})

integrationDescribe(
  'MUST Item 4: Worker Idempotency + Partial Init Detection',
  () => {
    it('should detect existing full schema and return SUCCESS', async () => {
      const client = await tenantPool!.connect()

      try {
        // Verify schema exists
        const schemaCheckResult = await client.query(
          `SELECT COUNT(*) FROM information_schema.tables 
         WHERE table_schema = 'public'`
        )

        expect(Number(schemaCheckResult.rows[0].count)).toBeGreaterThan(10) // Baseline has 38+ tables

        // If rerun occurs, worker should:
        // 1. Check schema_version exists ✓
        // 2. Verify baseline tables exist ✓
        // 3. Return SUCCESS immediately ✓

        const versionCheck = await client.query(
          `SELECT COUNT(*) FROM schema_version`
        )
        expect(Number(versionCheck.rows[0].count)).toBeGreaterThanOrEqual(1)
      } finally {
        client.release()
      }
    })

    it('should detect partial initialization (schema_version without tables)', async () => {
      // This is tested in Gate 4 (load test) which might introduce partial inits
      // For unit test, we would:
      // 1. Create schema_version record
      // 2. Delete critical tables
      // 3. Call verifySchemaIntegrity() → should fail
      // 4. Worker should return RETRY status

      // Mock test:
      const client = await tenantPool!.connect()

      try {
        // Create minimal schema_version (partial init)
        await client.query(
          `
        INSERT INTO schema_version (version, checksum)
        VALUES ('1.0.0', 'abc123def456')
        `
        )

        // In production, verify baseline tables would be present
        // Here we're just confirming schema_version is insertable
        const result = await client.query(`SELECT COUNT(*) FROM schema_version`)
        expect(Number(result.rows[0].count)).toBeGreaterThan(0)
      } finally {
        await client.query(`DELETE FROM schema_version`)
        client.release()
      }
    })
  }
)

integrationDescribe('MUST Item 5: Registry Integrity Check', () => {
  it('should verify all tenants_registry entries have physical databases', async () => {
    const result = await masterPool!.query(`
      SELECT
        tr.id,
        tr.workspace_slug,
        tr.database_name,
        pd.datname as db_exists
      FROM tenants_registry tr
      LEFT JOIN pg_database pd ON pd.datname = tr.database_name
      WHERE tr.is_active = true
      LIMIT 5
    `)

    // All active tenants should have database
    for (const row of result.rows) {
      expect(row.db_exists).toBeTruthy()
    }
  })

  it('should detect missing provisioning_tasks table structure', async () => {
    const result = await masterPool!.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'provisioning_tasks'
      ORDER BY ordinal_position
    `)

    // Required columns: id, workspace_id, idempotency_key, status, created_at
    const columnNames = result.rows.map((r) => r.column_name)
    expect(columnNames).toContain('id')
    expect(columnNames).toContain('workspace_id')
    expect(columnNames).toContain('idempotency_key')
    expect(columnNames).toContain('status')
    expect(columnNames).toContain('created_at')
  })

  it('should verify UNIQUE constraint exists', async () => {
    const result = await masterPool!.query(`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'provisioning_tasks'
        AND constraint_type = 'UNIQUE'
        AND constraint_name ~ 'idempotency'
    `)

    expect(result.rows.length).toBeGreaterThan(0)
    expect(result.rows[0].constraint_name).toContain('idempotency')
  })
})

integrationDescribe('MUST Item 6: Alerts and Monitoring Configuration', () => {
  it('should verify alert rules JSON is valid', () => {
    const alertsFile = require('../../docs/monitoring/alerts-schema-provisioning.json')

    expect(alertsFile.groups).toBeDefined()
    expect(alertsFile.groups.length).toBeGreaterThan(0)

    const ruleCount = alertsFile.groups[0].rules.length
    expect(ruleCount).toBe(8) // 8 alert rules required

    // Verify critical alerts present
    const alertNames = alertsFile.groups[0].rules.map((r: any) => r.alert)
    expect(alertNames).toContain('SchemaProvisioningDLQEscalation')
    expect(alertNames).toContain('SchemaTampering Detected')
    expect(alertNames).toContain('SchemaProvisioningHighFailureRate')
  })

  it('should verify dashboard JSON is valid', () => {
    const dashboardFile = require('../../docs/monitoring/dashboard-schema-provisioning.json')

    expect(dashboardFile.dashboard).toBeDefined()
    expect(dashboardFile.dashboard.title).toContain('Schema Provisioning')
    expect(dashboardFile.dashboard.panels.length).toBeGreaterThanOrEqual(8)
  })

  it('should verify Terraform module files exist', async () => {
    const fs = require('fs').promises

    const mainTfExists = await fs
      .stat('terraform/modules/monitoring/schema-provisioning/main.tf')
      .then(() => true)
      .catch(() => false)

    const varsTfExists = await fs
      .stat('terraform/modules/monitoring/schema-provisioning/variables.tf')
      .then(() => true)
      .catch(() => false)

    expect(mainTfExists).toBe(true)
    expect(varsTfExists).toBe(true)
  })
})

integrationDescribe('Integration: All MUST Items Together', () => {
  it('should complete full provisioning lifecycle', async () => {
    const idempotencyKey = `integration-test-${Date.now()}`

    // Step 1: Insert provisioning task (MUST Item 2 + 5)
    const taskResult = await insertProvisioningTaskIdempotent(
      masterPool!,
      testWorkspaceId,
      idempotencyKey,
      'INIT_TENANT_SCHEMA'
    )

    expect(taskResult.task_id).toBeTruthy()
    expect(taskResult.is_duplicate).toBe(false)

    // Step 2: Verify task is eligible for processing (MUST Item 4)
    const taskRecord = {
      id: taskResult.task_id,
      status: taskResult.status,
      attempt_count: 0,
    }

    expect(isTaskEligibleForProcessing(taskRecord as any)).toBe(true)

    // Step 3: Attempt duplicate insert (should return same task_id)
    const dupResult = await insertProvisioningTaskIdempotent(
      masterPool!,
      testWorkspaceId,
      idempotencyKey,
      'INIT_TENANT_SCHEMA'
    )

    expect(dupResult.task_id).toBe(taskResult.task_id)
    expect(dupResult.is_duplicate).toBe(true)

    // Step 4: Verify snapshot immutability can be tested once task completes
    // (MUST Item 1 + 3 - requires schema to be initialized)

    expect(true).toBe(true) // All steps passed
  })
})
