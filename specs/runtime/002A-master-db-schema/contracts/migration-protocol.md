// Migration Execution Protocol // // Feature: 002A-master-db-schema // Format: Protocol
specification // Created: 2026-02-16 // // This document defines the contract for how master
database migrations // are executed, tracked, and rolled back.

/\*\*

- Migration File Structure
-
- Migration files must follow this naming convention:
- apps/api/src/db/master/migrations/{VERSION}\_{NAME}.ts
-
- Example:
- apps/api/src/db/master/migrations/001_initial_schema.ts \*/

export interface MigrationFile { // Migration version (e.g., "001") version: string;

// Human-readable description description: string;

// Up migration: Apply the schema change up: (client: PostgreSQLClient) => Promise<void>;

// Down migration: NEVER IMPLEMENTED // Instead, use database snapshot restore (see Rollback
Strategy) down?: never; }

/\*\*

- Migration Execution Flow
-
- 1.  Application startup
- 2.  Load all migration files from migrations directory
- 3.  Query \_schema_migrations table for applied migrations
- 4.  For each unapplied migration:
- a. Begin transaction
- b. Execute migration.up()
- c. Record in \_schema_migrations
- d. Commit transaction
- 5.  If any error: Rollback transaction, log error, exit \*/

export interface MigrationExecutor { /\*\*

- Load all migration files from the migrations directory. \*/ loadMigrations(directory: string):
  Promise<MigrationFile[]>;

/\*\*

- Sort migrations by version (ascending). \*/ sortMigrations(migrations: MigrationFile[]):
  MigrationFile[];

/\*\*

- Get list of applied migrations from database. \*/ getAppliedMigrations(client: PostgreSQLClient):
  Promise<string[]>;

/\*\*

- Find unapplied migrations (not in \_schema_migrations). \*/ getUnappliedMigrations( migrations:
  MigrationFile[], applied: string[] ): MigrationFile[];

/\*\*

- Execute single migration in transaction.
-
- Rollback on error (automatic if any SQL fails). \*/ executeMigration( client: PostgreSQLClient,
  migration: MigrationFile ): Promise<void>;

/\*\*

- Execute all unapplied migrations in sequence.
-
- Stops on first failure. \*/ executeAll(client: PostgreSQLClient): Promise<void>; }

/\*\*

- Transaction Guarantees
-
- Each migration executes within a transaction:
-
- BEGIN TRANSACTION;
- -- Execute migration SQL
- CREATE TABLE products (...)
- CREATE TABLE licenses (...)
- ... more DDL ...
- -- Record migration
- INSERT INTO \_schema_migrations (version, description, applied_at)
- VALUES ('001', 'Initial schema', NOW());
- COMMIT; -- or ROLLBACK on any error
-
- If any SQL fails:
- - Entire transaction rolled back
- - No partial schema created
- - No migration record inserted
- - Error logged (structured JSON) \*/

export interface TransactionGuarantee { atomicity: "ALL_OR_NOTHING"; isolation: "READ_COMMITTED";
rollback_on_error: boolean; }

/\*\*

- Idempotency Strategy
-
- Migrations are idempotent via migration tracking:
-
- 1.  Check if version exists in \_schema_migrations:
- SELECT 1 FROM \_schema_migrations WHERE version = '001'
-
- 2.  If exists: Skip (already applied)
-
- 3.  If not exists: Execute migration
-
- This means:
- - Re-running migration system does not re-apply migrations
- - Safe to restart on failure (after fixing root cause)
- - Each version applied exactly once \*/

export interface IdempotencyStrategy { mechanism: "MIGRATION_TRACKING_TABLE"; detection:
"VERSION_LOOKUP"; behavior_on_duplicate: "SKIP"; }

/\*\*

- Rollback Strategy
-
- Zidney uses forward-only migrations with database snapshot restore:
-
- Normal Deploy Path:
- v0.9.9 (stable) → v1.0.0 (new)
-
- Rollback Path (if issues detected):
- Step 1: Restore database from snapshot of v0.9.9
- Step 2: Verify data integrity
- Step 3: Fix issue (patch in v1.0.1)
- Step 4: Redeploy v1.0.1
-
- Why No DOWN Migrations:
- - Data transformation complexity
- - Potential data loss in rollback
- - Complexity of multi-state data
- - Database snapshots are simpler and safer
-
- Migration System Never Reverses:
- - No DELETE or DROP in migration system
- - Version only increments
- - Migrations are write-only \*/

export interface RollbackStrategy { type: "SNAPSHOT_RESTORE"; implementation: "DATABASE_BACKUP";
down_migrations: "NEVER_IMPLEMENTED"; data_loss_prevention: "SNAPSHOT_COVERAGE"; }

/\*\*

- Error Handling During Migration \*/

export interface MigrationError { phase: "LOAD" | "PARSE" | "EXECUTE" | "RECORD"; version: string;
error: Error; stack_trace: string; recovery_action: string; // "MANUAL_INTERVENTION" or
"RETRY_AFTER_FIX" }

/\*\*

- Logging Requirements
-
- All migration operations must be logged in structured format. \*/

export interface MigrationLog { timestamp: string; // ISO 8601 UTC level: "INFO" | "WARN" | "ERROR";
service: "master-db-migration"; correlation_id: string; // Unique ID for this migration run phase:
string; // "load" | "validate" | "execute" | "record" migration_version: string; migration_name:
string; status: "started" | "completed" | "failed"; duration_ms: number; tables_affected?: string[];
error?: { code: string; message: string; }; }

/\*\*

- Schema Migration Table: \_schema_migrations
-
- This table tracks which migrations have been applied.
- It is automatically created by the migration system. \*/

export interface SchemaMigrationRecord { version: string; // e.g., "001" description: string; //
e.g., "Initial master database schema" applied_at: Date; // Server timestamp (UTC) when applied
execution_time_ms: number; // How long the migration took }

/\*\*

- Migration Safety Checklist
-
- Before deploying migration to production:
- ✓ All SQL validated for syntax
- ✓ All constraints (FK, UNIQUE, CHECK) defined
- ✓ All indexes created for performance
- ✓ No hardcoded data (use configuration)
- ✓ No dropping tables or columns
- ✓ No modifications to old migrations
- ✓ Version number incremented
- ✓ Tests pass (migration rollback test)
- ✓ Backup / snapshot created
- ✓ Rollback plan documented \*/

export interface PreDeploymentChecklist { sql_syntax_validated: boolean; constraints_defined:
boolean; indexes_created: boolean; no_hardcoded_data: boolean; no_destructive_ddl: boolean;
no_old_migration_modifications: boolean; version_incremented: boolean; tests_passed: boolean;
backup_created: boolean; rollback_plan_documented: boolean; }

/\*\*

- Example Migration File
-
- File: apps/api/src/db/master/migrations/001_initial_schema.ts \*/

/\* import { PostgreSQLClient } from '@zidney/db';

export const migration = { version: '001', description: 'Initial master database schema',

async up(client: PostgreSQLClient) { // Create products table await
client.query(`       CREATE TABLE IF NOT EXISTS products (         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),         name VARCHAR(255) NOT NULL,         slug VARCHAR(100) NOT NULL UNIQUE,         description TEXT,         version VARCHAR(20) NOT NULL,         enabled_modules JSONB NOT NULL,         created_at TIMESTAMP NOT NULL DEFAULT NOW(),         updated_at TIMESTAMP NOT NULL DEFAULT NOW()       );       CREATE INDEX idx_products_slug ON products(slug);     `);

    // Create licenses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS licenses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
        workspace_slug VARCHAR(100) NOT NULL UNIQUE,
        student_limit INTEGER,
        staff_limit INTEGER,
        status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SOFT_LOCKED', 'ARCHIVED')),
        starts_at TIMESTAMP NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        product_version VARCHAR(20) NOT NULL,
        schema_version VARCHAR(20) NOT NULL,
        soft_lock_until TIMESTAMP,
        archived_at TIMESTAMP,
        deleted_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_licenses_workspace_slug ON licenses(workspace_slug);
      CREATE INDEX idx_licenses_status ON licenses(status);
    `);

    // Create tenants_registry table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants_registry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE RESTRICT,
        workspace_slug VARCHAR(100) NOT NULL UNIQUE,
        db_name VARCHAR(100) NOT NULL,
        db_host VARCHAR(255) NOT NULL,
        db_port INTEGER NOT NULL,
        db_user VARCHAR(100) NOT NULL,
        db_password_encrypted VARCHAR(512) NOT NULL,
        schema_version VARCHAR(20) NOT NULL,
        product_version VARCHAR(20) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_tenants_registry_workspace_slug ON tenants_registry(workspace_slug);
    `);

    // Create mmc_users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS mmc_users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'operator', 'read_only')),
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_mmc_users_email ON mmc_users(email);
    `);

    // Create platform_schema_version table
    await client.query(`
      CREATE TABLE IF NOT EXISTS platform_schema_version (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_version VARCHAR(20) NOT NULL,
        minimum_supported_version VARCHAR(20) NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Initialize platform schema version
    await client.query(`
      INSERT INTO platform_schema_version (id, current_version, minimum_supported_version, updated_at)
      VALUES (1, '1.0.0', '1.0.0', NOW())
      ON CONFLICT (id) DO NOTHING;
    `);

} }; \*/

/\*\*

- Migration Version Format
-
- Versions are numeric (e.g., "001", "002", "010")
- They are zero-padded to 3 digits.
-
- Examples:
- 001 - First migration
- 002 - Second migration
- 010 - Tenth migration
- 100 - Hundredth migration
-
- This ensures natural sorting when ordered as strings. \*/

export const VersionFormat = { pattern: /^\d{3}$/, examples: ["001", "002", "010", "100"], notes:
"Always 3 digits, zero-padded", };

/\*\*

- Summary
-
- This contract ensures:
- ✓ All migrations are tracked
- ✓ No migration is applied twice
- ✓ Failures are atomic (no partial schema)
- ✓ Errors are logged structured
- ✓ Rollback is via snapshot restore (safe)
- ✓ Schema version is always forward-only \*/
