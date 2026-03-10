# Fix Plan: Replace Invalid `Database` Type Import from `pg`

## Problem Statement

TypeScript error: `Module '"pg"' has no exported member 'Database'`

The `pg` (node-postgres) package does not export a type called `Database`. This is causing
TypeScript compilation errors in multiple files.

## Root Cause

The `pg` package exports the following types:

- `Pool` - Connection pool for managing multiple clients
- `Client` - Single database client
- `PoolClient` - Client acquired from a pool (extends `Client`)

The code incorrectly imports a non-existent `Database` type.

## Affected Files

| File                                                                                                                                | Line | Current Import                  | Usage                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------- | ---- | ------------------------------- | --------------------------------------------------------------------------- |
| [`packages/domain-core/src/migration/tenant-migration-runner.ts`](packages/domain-core/src/migration/tenant-migration-runner.ts:17) | 17   | `import { Database } from 'pg'` | `TenantMigrationContext.connection_pool`, `TenantMigrationContext.masterDb` |
| [`apps/worker/src/jobs/migration-phase.ts`](apps/worker/src/jobs/migration-phase.ts:7)                                              | 7    | `import { Database } from 'pg'` | `masterDb`, `tenantDb` parameters                                           |
| [`apps/worker/src/jobs/lock-manager.ts`](apps/worker/src/jobs/lock-manager.ts:6)                                                    | 6    | `import { Database } from 'pg'` | `masterDb` parameter                                                        |
| [`apps/worker/src/jobs/snapshot-phase.ts`](apps/worker/src/jobs/snapshot-phase.ts:7)                                                | 7    | `import { Database } from 'pg'` | `masterDb`, `tenantDb` parameters                                           |

## Solution

Replace `Database` with `Pool` from `pg` in all affected files.

### Why `Pool` is the Correct Type

1. The code uses `connection_pool.connect()` in
   [`tenant-migration-runner.ts:69`](packages/domain-core/src/migration/tenant-migration-runner.ts:69) -
   this method exists on `Pool`
2. The `.query()` method is available on both `Pool` and `PoolClient`
3. Other files in the project correctly use `Pool` from `pg` (see
   [`ProvisioningOrchestrator.ts`](apps/worker/src/services/provisioning/ProvisioningOrchestrator.ts:23),
   [`Operations.ts`](apps/worker/src/services/provisioning/Operations.ts:12), etc.)

## Implementation Steps

### Step 1: Fix packages/domain-core/src/migration/tenant-migration-runner.ts

```typescript
// Before
import { Database } from "pg";

// After
import { Pool } from "pg";
```

Update interface:

```typescript
// Before
export interface TenantMigrationContext {
  workspace_id: string;
  workspace_slug: string;
  connection_pool: Database;
  masterDb: Database;
  correlationId: string;
}

// After
export interface TenantMigrationContext {
  workspace_id: string;
  workspace_slug: string;
  connection_pool: Pool;
  masterDb: Pool;
  correlationId: string;
}
```

### Step 2: Fix apps/worker/src/jobs/migration-phase.ts

```typescript
// Before
import { Database } from "pg";

// After
import { Pool } from "pg";
```

Update function signature:

```typescript
// Before
export async function executeMigrationPhase(
  job: SchemaMigrationJob,
  masterDb: Database,
  tenantDb: Database,
  workspace_slug: string,
): Promise<{ success: boolean; error?: any }>;

// After
export async function executeMigrationPhase(
  job: SchemaMigrationJob,
  masterDb: Pool,
  tenantDb: Pool,
  workspace_slug: string,
): Promise<{ success: boolean; error?: any }>;
```

### Step 3: Fix apps/worker/src/jobs/lock-manager.ts

```typescript
// Before
import { Database } from "pg";

// After
import { Pool } from "pg";
```

Update function signatures:

```typescript
// Before
export async function acquireWorkspaceLock(
  workspace_id: string,
  masterDb: Database,
  timeoutMs: number = 60000,
): Promise<LockHandle>;

export async function releaseWorkspaceLock(
  lockHandle: LockHandle,
  masterDb: Database,
): Promise<void>;

// After
export async function acquireWorkspaceLock(
  workspace_id: string,
  masterDb: Pool,
  timeoutMs: number = 60000,
): Promise<LockHandle>;

export async function releaseWorkspaceLock(lockHandle: LockHandle, masterDb: Pool): Promise<void>;
```

### Step 4: Fix apps/worker/src/jobs/snapshot-phase.ts

```typescript
// Before
import { Database } from "pg";

// After
import { Pool } from "pg";
```

Update function signature:

```typescript
// Before
export async function executeSnapshotCreation(
  job: SchemaMigrationJob,
  masterDb: Database,
  tenantDb: Database,
): Promise<string>;

// After
export async function executeSnapshotCreation(
  job: SchemaMigrationJob,
  masterDb: Pool,
  tenantDb: Pool,
): Promise<string>;
```

## Verification

After applying fixes:

1. Run `pnpm tsc --noEmit` to verify no TypeScript errors
2. Verify all imports resolve correctly
3. Run existing tests to ensure no runtime issues

## Notes

- This is a type-only fix - no runtime behavior changes
- The `Pool` type is already used correctly in other parts of the codebase
- No changes to package dependencies required
