# Research: Translation System

**Phase**: 0 — Research  
**Feature Branch**: `019-translation-system`  
**Date**: 2026-03-01  
**Status**: Complete — all NEEDS CLARIFICATION resolved

---

## 1. Drizzle ORM: Upsert on Composite Unique Key

### Decision

Use `db.insert(...).values(...).onConflictDoUpdate({ target: [...], set: {...} })` targeting the
four-column unique constraint.

### Rationale

The existing workspace-settings repository already uses `ON CONFLICT (...) DO UPDATE SET` raw SQL
for its singleton upsert (see `workspace-settings.repository.ts` lines 50-65). Drizzle's fluent API
wraps this with type-safety and avoids raw SQL strings for the translation upsert path.

### Pattern (Drizzle v0.28+)

```typescript
await db
  .insert(translations)
  .values({
    id: crypto.randomUUID(),
    entity_type,
    entity_id,
    field_name,
    language_code,
    translated_value,
    created_at: now,
    updated_at: now,
  })
  .onConflictDoUpdate({
    target: [
      translations.entity_type,
      translations.entity_id,
      translations.field_name,
      translations.language_code,
    ],
    set: {
      translated_value: sql`EXCLUDED.translated_value`,
      updated_at: sql`NOW()`, // server-authoritative time
    },
  });
```

The `target` array maps to the `UNIQUE (entity_type, entity_id, field_name, language_code)`
constraint. Drizzle requires the target columns to match a named unique constraint or a subset of a
primary key; this pattern is confirmed valid in Drizzle's pg adapter.

**created_at is never overwritten on conflict** — `EXCLUDED` update skips it, preserving the
original insert timestamp.

### Alternatives Considered

- Raw SQL `INSERT ... ON CONFLICT DO UPDATE`: already used in codebase (workspace-settings), works
  but loses type safety.
- Two-step SELECT + UPDATE/INSERT: rejected — creates a race window. Composite-key conflict
  serializes correctly under PostgreSQL READ COMMITTED.
- Client-provided idempotency header (Stripe-style): rejected per spec Q4 clarification — composite
  key is the idempotency key.

---

## 2. PostgreSQL Index Strategies for Translations at Scale

### Decision

Four indexes on the `translations` table, chosen to cover the five critical query shapes without
redundancy.

### Index Plan

| Index Name                      | Columns                                               | Type          | Covers                                                        |
| ------------------------------- | ----------------------------------------------------- | ------------- | ------------------------------------------------------------- |
| `translations_composite_unique` | `(entity_type, entity_id, field_name, language_code)` | UNIQUE B-Tree | upsert conflict target; single-translation lookup             |
| `idx_translations_entity`       | `(entity_type, entity_id)`                            | B-Tree        | batch entity load (FR-037), entity cleanup (Q1 clarification) |
| `idx_translations_coverage`     | `(entity_type, language_code)`                        | B-Tree        | coverage COUNT aggregation (FR-022)                           |
| `idx_translations_language`     | `(language_code)`                                     | B-Tree        | DRAIN job DELETE loop; language removal COUNT check           |

### Rationale

- The UNIQUE constraint doubles as the lookup index for the upsert, so no extra index needed for the
  four-column key.
- `(entity_type, entity_id)` satisfies FR-037 batch load: a single
  `WHERE entity_type = X AND entity_id = ANY($ids)` uses this index.
- `(entity_type, language_code)` satisfies FR-022 coverage aggregation:
  `COUNT(*) WHERE entity_type = X AND language_code = Y` is an index-only scan on this composite.
- `(language_code)` alone enables the row-count check before language removal and the DRAIN job
  batch deletes to use the index rather than a sequential scan.

### Scale Considerations (SC-007: 5 million rows per tenant)

- B-tree indexes remain efficient at 5M rows for equality + range queries.
- Fill factor: default 90% is acceptable; translation rows are updated in-place (upsert) rather than
  bulk-appended, so 90% leaves reasonable free space.
- Partitioning path (FR-039): the schema is forward-compatible with declarative partitioning by
  `language_code` or `entity_type` without application changes. Each partition would inherit the
  index structure. Partitioning is NOT added at this stage.
- VACUUM/AUTOVACUUM: upsert-heavy tables accumulate dead tuples. Ensure
  `autovacuum_vacuum_scale_factor` is tuned at DB level for this table (operational concern,
  documented in quickstart.md).

### Alternatives Considered

- Partial indexes (e.g., per entity_type): premature optimization — full composite index covers all
  entity types adequately at 5M rows.
- GIN index on JSONB: not applicable — translations table uses scalar columns.
- Covering index including `translated_value`: rejected — `translated_value` is unbounded text;
  including it in an index would bloat index size significantly.

---

## 3. Hono Middleware Chain for Translation Routes

### Decision

Translation routes mount under the existing `backoffice` route group and inherit its middleware
chain:

```
correlationId → tenantResolver → licenseEnforcement → schemaVersion → rateLimit → authentication → rbacGuard(staff)
```

### Evidence

The backoffice settings route (`apps/api/src/routes/backoffice/settings.ts`) explicitly documents
this chain:

```
correlationId → tenantResolver → licenseEnforcement → schemaVersion → rateLimit(max:60) → authentication
```

Translation routes follow the same chain. The RBAC guard (`staff` permission level) is applied
per-route in the route handler (same as workspace-settings routes).

### Implementation

- New file: `apps/api/src/routes/backoffice/translations.ts`
- Exports `translationsRouter` via the backoffice group mount point
- No new middleware types required — all layers already exist
- Route registration: `app.route('/api/workspaces/:slug/translations', translationsRouter)` scoped
  under the backoffice group

### Alternatives Considered

- Creating a standalone route group with its own middleware: rejected — violates DRY and risks
  skipping tenant resolver or license middleware (architectural drift).
- Mounting under frontoffice routes: rejected — translation writes are staff-only; frontoffice only
  reads resolved entities via the entity APIs.

---

## 4. Worker Job Pattern: DRAIN_LANGUAGE_TRANSLATIONS

### Decision

A batch-delete loop job that processes translations for a specific `language_code` in configurable
chunks (default 1,000 rows), retrying idempotently until drain is complete.

### Pattern

```typescript
// Job payload
interface DrainLanguageTranslationsJob {
  job_type: "DRAIN_LANGUAGE_TRANSLATIONS";
  workspace_id: string;
  workspace_slug: string;
  language_code: string;
  batch_size: number; // default 1000, configurable
  correlation_id: string;
  initiated_by_user_id: string;
}

// Handler loop
async function handleDrainLanguageTranslations(job, logger) {
  const { workspace_slug, language_code, batch_size = 1000 } = job.payload;
  const db = getTenantDb(workspace_slug);

  let totalDeleted = 0;
  let batchDeleted: number;

  do {
    // DELETE ... LIMIT is not standard SQL; use ctid trick or subquery LIMIT
    // RETURNING is required to populate audit log entries for each deleted row (FR-032, FR-035)
    const deletedRows = await db.execute(sql`
      DELETE FROM translations
      WHERE id IN (
        SELECT id FROM translations
        WHERE language_code = ${language_code}
        LIMIT ${batch_size}
      )
      RETURNING id, entity_type, entity_id, field_name, language_code
    `);
    const rows = deletedRows.rows;
    batchDeleted = rows.length;
    totalDeleted += batchDeleted;

    // Insert audit log entries for deleted rows within same batch transaction
    if (rows.length > 0) {
      await insertAuditEntries(
        db,
        rows.map((row) => ({
          ...row,
          action: "deleted",
          reason: "language_removed",
          user_id: null, // system-initiated
          correlation_id: job.correlation_id,
          workspace_id: job.workspace_id,
        })),
      );
    }
  } while (batchDeleted > 0);

  // Mark language status as removed in workspace_settings
  await markLanguageRemoved(db, language_code);
  logger.info({
    event: "drain_complete",
    language_code,
    total_deleted: totalDeleted,
  });
}
```

### Idempotency

The job is idempotent: if the worker crashes mid-drain, re-queueing the same job continues from
where deletion left off. The `language_status: 'removing'` flag in
`workspace_settings.language_status` will still be set to `removing`, so the worker picks up the
drain on retry without duplicating work.

### Trigger Condition

Per spec Q3 clarification: the language removal endpoint checks `COUNT(*) WHERE language_code = X`.
If count > 10,000, it:

1. Sets `language_status[X] = 'removing'` in `workspace_settings`
2. Enqueues `DRAIN_LANGUAGE_TRANSLATIONS` job
3. Returns HTTP 409 Conflict with `{ code: 'LANGUAGE_REMOVAL_REQUIRES_ASYNC', ... }`

### Alternatives Considered

- Single-transaction bulk delete: rejected for large datasets — blocks on table lock for minutes,
  violates Q3 clarification.
- FK cascade: rejected per Q1 clarification — translations table cannot have FK to multiple parent
  tables.
- Cursor-based delete (keyset pagination): viable alternative but subquery LIMIT pattern is simpler
  and equivalent for this dataset size. Can be upgraded to keyset if performance issues emerge.

---

## 5. Coverage Calculation: Query-Time vs Redis Cache

### Decision

**Hybrid**: query-time aggregation for correctness, with optional Redis cache per
`(workspace_id, entity_type, language_code)` scoped to tenant.

### Primary Approach: Query-Time Aggregation

```sql
SELECT COUNT(*) AS translated_count
FROM translations
WHERE entity_type = $1 AND language_code = $2
```

This uses `idx_translations_coverage` (composite index on entity_type, language_code) as an
index-only scan at scale. The denominator comes from `TRANSLATABLE_FIELDS[entity_type].length` — a
pure constant, zero DB overhead (per spec Q5 clarification).

Coverage % = `(translated_count / (entity_count * TRANSLATABLE_FIELDS[entity_type].length)) * 100`

Note: `entity_count` is the count of entities of that type in the tenant DB. This requires one
additional query: `SELECT COUNT(*) FROM <entity_table>`. Alternatively, coverage can be simplified
to:

Coverage % = `(translated_count / (total_possible = entity_count_for_type * field_count)) * 100`

The implementation must use the coverage index to avoid full-table scans (FR-022).

### Optional Redis Cache Layer

- Cache key: `coverage:{workspace_id}:{entity_type}:{language_code}`
- TTL: 300 seconds (5 min) — serves as a soft invalidation backstop
- Hard invalidation: on any translation write (upsert or delete) affecting the same
  `(entity_type, language_code)` scope, the cache key is deleted
- Hard invalidation: on any language configuration change (language added/removed)
- **Tenant isolation**: workspace_id is part of the cache key — no cross-tenant keys (FR-023)

### Decision Rationale

Query-time is the source of truth. Redis cache reduces load on the DB for frequent coverage
dashboard polls. The `coverage.service.ts` will check Redis first, fall back to query, then write to
cache. Cache misses are transparent to callers.

### Alternatives Considered

- Materialized view: would require manual refresh on every translation write — too much complexity
  for the coverage use case.
- Counters in workspace_settings: denormalized; would go stale on any batch delete. Rejected.
- Coverage-only table: premature optimization — adds write overhead on every translation upsert.

---

## 6. Existing workspace_settings Schema: language_settings

### Current Structure (from `workspace-settings.types.ts`)

```typescript
export interface LanguageSettings {
  default_language: string; // ISO 639-1 code, e.g. "ar"
  supported_languages: string[]; // e.g. ["ar", "en", "fr"]
}
```

Stored in `workspace_settings.language_settings` as JSONB. Singleton row enforced by
`singleton_key = 'SETTINGS'` unique constraint.

### Required Addition for Translation System (Q3 Clarification)

The async language removal flow requires tracking languages currently being drained. This is added
as a new optional field to `LanguageSettings`:

```typescript
export interface LanguageSettings {
  default_language: string;
  supported_languages: string[];
  language_status?: Record<string, "active" | "removing">;
  // Keys: language_code strings
  // Values: 'active' (normal) | 'removing' (async drain in progress)
  // Absence of a key = 'active' (backward-compatible default)
}
```

**Important**: `language_status` is optional in the TypeScript type and defaults to `{}` (absent key
= active). This is backward-compatible — existing workspace_settings rows do not need to be
migrated, as JSONB null/absent keys are treated as `'active'`.

**Validation**: The workspace-settings validation schema (`workspace-settings.validation.ts`) must
be updated to:

- Accept `language_status` as optional `Record<string, z.enum(['active', 'removing'])>`
- Prevent write operations from setting `language_status[X] = 'removing'` via the public API (only
  the language removal endpoint and the drain job may set this)

### Migration Impact

No schema migration needed for `language_settings` itself — the column is JSONB and already exists.
The `LanguageSettings` TypeScript interface update is a domain-package code change, not a DB
migration. The `language_status` field is added with its first write by the language removal
endpoint. No existing data is invalid.

---

## 7. Existing Audit Log Patterns

### Pattern Found (workspace_settings_audit)

The existing audit table for workspace settings (`workspace_settings_audit`) is an append-only table
with:

- `id` UUID primary key
- `workspace_id` UUID (not FK — tenant DB, workspace ID passed as data)
- `user_id` UUID actor
- `settings_group` varchar(30) discriminator
- `config_version` integer (version at time of change)
- `changes` JSONB (diff record)
- `request_id` varchar(50) = correlation_id
- `ip_address` text
- `user_agent` text (truncated to 500 chars at app layer)
- `created_at` timestamptz NOT NULL defaultNow()

Immutability is enforced via a PostgreSQL trigger (`prevent_audit_update_delete`) that raises an
exception on any UPDATE or DELETE to the audit table — confirmed in `v1.0.0/triggers.sql`.

### Translation Audit Table Design

The `translation_audit_logs` table follows the same pattern:

- Append-only
- No FK references (tenant DB only)
- Immutability trigger on UPDATE/DELETE
- Composite index for entity-scoped pagination

### Key Differences from workspace_settings_audit

- Translation audit uses `entity_type`, `entity_id`, `field_name`, `language_code` as context (not
  `settings_group`)
- `action` field: `'created' | 'updated' | 'deleted'`
- `reason` field: optional string (e.g., `'language_removed'` for cascade deletes per FR-035)
- No `config_version` equivalent in translations — translations are not versioned

### Structured Logging Requirements

Per AGENTS.md, all services must log with: `timestamp`, `level`, `service`, `workspace_slug`,
`workspace_id`, `user_id`, `correlation_id`. For translation operations, additionally log:
`entity_type`, `entity_id`, `field_name` (for upsert), `language_code`.

The `translation.service.ts` must use the platform logger (`@zidney/logger`) and never
`console.log`.

---

## Resolution Summary

| Item                                        | Status      | Decision                                                                             |
| ------------------------------------------- | ----------- | ------------------------------------------------------------------------------------ |
| Drizzle upsert on composite unique key      | ✅ Resolved | `onConflictDoUpdate` targeting 4-column UNIQUE constraint                            |
| PostgreSQL index strategy at scale          | ✅ Resolved | 4 indexes: UNIQUE + entity + coverage + language                                     |
| Hono middleware chain position              | ✅ Resolved | Inherit backoffice group chain; new file in routes/backoffice/                       |
| DRAIN_LANGUAGE_TRANSLATIONS job pattern     | ✅ Resolved | Subquery LIMIT batch delete loop, idempotent retry                                   |
| Coverage calculation approach               | ✅ Resolved | Query-time aggregation on coverage index + optional Redis cache                      |
| workspace_settings.language_settings schema | ✅ Resolved | Add optional `language_status` Record field (JSONB backward-compatible)              |
| Existing audit log patterns                 | ✅ Resolved | Append-only table with immutability trigger; follow workspace_settings_audit pattern |

All NEEDS CLARIFICATION items are resolved. Phase 1 design may proceed.
