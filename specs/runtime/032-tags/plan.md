# Implementation Plan — Tags

**Phase:** 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION  
**Stage:** STAGE_32_TAGS  
**Spec File:** `specs/runtime/032-tags/spec.md`  
**Related ADR:** None required (no new architectural patterns introduced)  
**Plan Date:** 2026-03-23  
**Risk Level:** HIGH

---

## Stage Alignment

- **Phase:** 03_BACKOFFICE_CORE — 03_CONTENT_CLASSIFICATION
- **Stage:** STAGE_32_TAGS
- **Related Spec File:** `specs/runtime/032-tags/spec.md`
- **Related ADR:** None — implementation follows established Zidney patterns without novel architectural introduction.

---

## Architectural Scope Confirmation

| Rule                                | Confirmed                                                                   |
| ----------------------------------- | --------------------------------------------------------------------------- |
| No cross-tenant data access         | ✅ — `tags` and `tag_relations` tables reside exclusively in tenant DB      |
| No middleware bypass                | ✅ — Tenant resolver → license middleware mandatory on every route          |
| No direct DB instantiation          | ✅ — DB obtained from tenant context; no global singleton                   |
| No grading logic outside Worker     | ✅ — Feature has zero interaction with attempt/grading engine               |
| No weakening of snapshot integrity  | ✅ — Feature does not touch attempt snapshots                               |
| No weakening of version enforcement | ✅ — Migration bumps schema_version; runtime rejects incompatible tenants   |
| No layer boundary violation         | ✅ — Domain logic in `packages/domain-core/src/tags/`; no framework imports |

**No ADR required — all patterns confirmed established in prior stages.**

---

## Implementation Layers

### API Layer

**New routes (all under `/api/v1/backoffice/workspace/:slug`):**

| Method   | Path                                   | Handler                    | Write Guard                           |
| -------- | -------------------------------------- | -------------------------- | ------------------------------------- |
| `POST`   | `/tags`                                | `createTagHandler`         | `question_manage` OR `content_manage` |
| `GET`    | `/tags`                                | `listTagsHandler`          | `question_manage` OR `content_manage` |
| `GET`    | `/tags/:id`                            | `getTagHandler`            | `question_manage` OR `content_manage` |
| `PATCH`  | `/tags/:id`                            | `updateTagHandler`         | `question_manage` OR `content_manage` |
| `DELETE` | `/tags/:id`                            | `deleteTagHandler`         | `question_manage` OR `content_manage` |
| `POST`   | `/tag-relations`                       | `createTagRelationHandler` | entity-type-specific (below)          |
| `DELETE` | `/tag-relations/:id`                   | `deleteTagRelationHandler` | entity-type-specific (below)          |
| `GET`    | `/entities/:entityType/:entityId/tags` | `listEntityTagsHandler`    | entity-type-specific                  |
| `GET`    | `/tags/:id/entities`                   | `listTagEntitiesHandler`   | `question_manage` OR `content_manage` |

**Entity-type-specific permission guard:**

- `MCQ_QUESTION` / `TRADITIONAL_QUESTION` → `question_manage`
- `LIBRARY_FILE` → `content_manage`
- Checked at service layer immediately after entity existence validation.

**Middleware chain per request:**

```
correlationId → tenantResolver → licenseEnforcement → authentication → requireAnyPermission([…]) → handler
```

**Router file:** `apps/api/src/routes/backoffice/tags/index.ts`  
**Mounted in:** `apps/api/src/app.ts` after the `categoryValuesRouter` mount:

```typescript
// Tags endpoints — Stage 032, permission guard applied per write route
app.route("/api/v1/backoffice/workspace", tagsRouter);
```

**Validation package:** `packages/validation/src/backoffice/tags.schemas.ts`

**Transaction boundaries:**

- `createTag` — `BEGIN → normalized_name uniqueness check → INSERT tags → COMMIT`
- `updateTag` — `BEGIN → existence check → normalized_name uniqueness check (exclude self) → UPDATE tags → COMMIT`
- `deleteTag` — `BEGIN → existence check → count tag_relations → DELETE tags → COMMIT`
- `createTagRelation` — `BEGIN → tag existence+enabled check → entityType validation → entity existence check → duplicate check → INSERT tag_relations → COMMIT`
- `deleteTagRelation` — `BEGIN → relation existence check → DELETE tag_relations → COMMIT`

### Worker Layer

**Not applicable.** All tag operations are synchronous. No background jobs required.

### Frontend Layer

**Not part of this stage.** Tags are a Backoffice classification tool. No Frontoffice exposure.

### Backoffice UI (apps/backoffice)

**Not included in API stage.** Tag API contract delivered here; UI integration is a downstream UI stage.

---

## Database Impact

### Master DB

- **Tables touched:** None
- **Migration required:** No

### Tenant DB

- **Tables introduced:** `tags`, `tag_relations`
- **Migration required:** Yes — `apps/api/src/db/tenant/migrations/20260323_010_tags.ts`
- **Schema version:** `1.15.0 → 1.16.0`
- **Product version compatibility:** Enforced at request boundary — incompatible schema_version rejects requests with `426`.

**Drizzle schema files:**

- `apps/api/src/db/tenant/schemas/tags.schema.ts`
- `apps/api/src/db/tenant/schemas/tag-relations.schema.ts`

---

## Data Model (Drizzle)

### `tags.schema.ts`

```typescript
import { check, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    normalized_name: varchar("normalized_name", { length: 255 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("ENABLED"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    created_by: uuid("created_by"),
    updated_by: uuid("updated_by"),
  },
  (table) => ({
    statusCheck: check("tags_status_check", `${table.status.name} IN ('ENABLED', 'DISABLED')`),
    statusIdx: index("idx_tags_status").on(table.status),
    // UNIQUE (normalized_name): migration-owned CONCURRENT index
    // FK constraints (created_by, updated_by): migration-owned
  }),
);

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
```

### `tag-relations.schema.ts`

```typescript
import { check, index, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const tagRelations = pgTable(
  "tag_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tag_id: uuid("tag_id").notNull(),
    entity_type: varchar("entity_type", { length: 40 }).notNull(),
    entity_id: uuid("entity_id").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    entityTypeCheck: check(
      "tag_relations_entity_type_check",
      `${table.entity_type.name} IN ('MCQ_QUESTION', 'TRADITIONAL_QUESTION', 'LIBRARY_FILE')`,
    ),
    tagIdIdx: index("idx_tag_relations_tag_id").on(table.tag_id),
    entityIdx: index("idx_tag_relations_entity").on(table.entity_type, table.entity_id),
    // UNIQUE (tag_id, entity_type, entity_id): migration-owned
    // FK tag_id → tags.id ON DELETE CASCADE: migration-owned
  }),
);

export type TagRelation = typeof tagRelations.$inferSelect;
export type NewTagRelation = typeof tagRelations.$inferInsert;
```

---

## Migration Design (`20260323_010_tags.ts`)

**Two-phase approach** (identical to `20260322_009_category_values.ts`):

### Phase 1 (inside `BEGIN / COMMIT`)

1. `CREATE TABLE IF NOT EXISTS tags (…)`  
   — `id`, `name`, `normalized_name`, `status` (CHECK IN ENABLED/DISABLED), `created_at`, `updated_at`, `created_by`, `updated_by`
2. `CREATE TABLE IF NOT EXISTS tag_relations (…)`  
   — `id`, `tag_id`, `entity_type` (CHECK IN MCQ_QUESTION/TRADITIONAL_QUESTION/LIBRARY_FILE), `entity_id`, `created_at`
3. FK: `tag_relations.tag_id → tags.id ON DELETE CASCADE`
4. FK: `tags.created_by → users.id` (nullable)
5. FK: `tags.updated_by → users.id` (nullable)
6. B-tree index: `idx_tags_status ON tags(status)`
7. B-tree index: `idx_tag_relations_tag_id ON tag_relations(tag_id)`
8. Composite B-tree index: `idx_tag_relations_entity ON tag_relations(entity_type, entity_id)`
9. Schema version bump: `1.15.0 → 1.16.0`

### Phase 2 (outside transaction — `CREATE INDEX CONCURRENTLY`)

1. `UNIQUE INDEX CONCURRENTLY unique_tags_normalized_name ON tags(normalized_name)`

### `down()` function

```sql
DROP TABLE IF EXISTS tag_relations CASCADE;
DROP TABLE IF EXISTS tags CASCADE;
-- revert schema_version to 1.15.0
```

---

## Domain Package Layout

All files under `packages/domain-core/src/tags/`:

```
packages/domain-core/src/tags/
├── tags.errors.ts                   ← DomainError subclass, TAG_* error codes
├── tags.types.ts                    ← Input/output types, DbClient, AuditContext
├── tags.repository.ts               ← All SQL via Drizzle; no business logic
├── tags.service.ts                  ← Business logic, transaction orchestration
├── tags.dependency-registry.ts      ← Checks tags package has no extra deps
├── index.ts                         ← Public exports
└── __tests__/
    ├── tags.service.test.ts         ← Unit tests (mock repository)
    └── tags.repository.test.ts      ← Integration tests (real tenant DB)
```

**Package registration:**  
`packages/domain-core/src/index.ts` — add `export * from './tags'`

### `tags.errors.ts` — Error Code Mapping

| Error Code                         | HTTP | Thrown by                                                  |
| ---------------------------------- | ---- | ---------------------------------------------------------- |
| `TAG_NOT_FOUND`                    | 404  | `findTagById` returns null                                 |
| `TAG_DUPLICATE`                    | 409  | normalized_name exists OR `err.code === '23505'` catch     |
| `TAG_DISABLED`                     | 422  | Assignment to tag with `status = DISABLED`                 |
| `TAG_HAS_RELATIONS`                | 422  | Delete attempted when `count(tag_relations) > 0`           |
| `TAG_RELATION_NOT_FOUND`           | 404  | `findTagRelationById` returns null                         |
| `TAG_RELATION_DUPLICATE`           | 409  | Composite unique violation OR `err.code === '23505'` catch |
| `TAG_RELATION_ENTITY_NOT_FOUND`    | 422  | Entity not found at assignment time                        |
| `TAG_RELATION_INVALID_ENTITY_TYPE` | 422  | `entityType` not in allowed set                            |
| `FORBIDDEN`                        | 403  | Permissions check fails                                    |
| `VALIDATION_ERROR`                 | 422  | Zod validation failure (route layer)                       |

### `tags.service.ts` — Operation Signatures

```typescript
// Tag CRUD
export async function createTag(
  db: DbClient,
  input: CreateTagInput,
  audit: AuditContext,
): Promise<TagRow>;
export async function listTags(
  db: DbClient,
  input: ListTagsInput,
  audit: AuditContext,
): Promise<ListTagsResult>;
export async function getTag(db: DbClient, id: string, audit: AuditContext): Promise<TagRow>;
export async function updateTag(
  db: DbClient,
  id: string,
  input: UpdateTagInput,
  audit: AuditContext,
): Promise<TagRow>;
export async function deleteTag(
  db: DbClient,
  id: string,
  audit: AuditContext,
): Promise<{ deleted: true }>;

// Tag Relations
export async function createTagRelation(
  db: DbClient,
  input: CreateTagRelationInput,
  audit: AuditContext,
): Promise<TagRelationRow>;
export async function deleteTagRelation(
  db: DbClient,
  id: string,
  audit: AuditContext,
): Promise<{ deleted: true }>;
export async function listEntityTags(
  db: DbClient,
  input: ListEntityTagsInput,
  audit: AuditContext,
): Promise<ListEntityTagsResult>;
export async function listTagEntities(
  db: DbClient,
  input: ListTagEntitiesInput,
  audit: AuditContext,
): Promise<ListTagEntitiesResult>;
```

### Entity Existence Validation Strategy

`createTagRelation` must verify the target entity exists before inserting. Since entity types exist in different tables:

```typescript
const ENTITY_TABLE_MAP: Record<string, string> = {
  MCQ_QUESTION: "mcq_questions",
  TRADITIONAL_QUESTION: "traditional_questions",
  LIBRARY_FILE: "library_files",
};
```

Entity tables may not exist yet (MCQ questions, library files are future stages). The repository must handle the case where the table does not exist gracefully:

- Run `SELECT 1 FROM <table> WHERE id = $1` inside the transaction.
- If PostgreSQL throws `42P01` (undefined_table) → catch and throw `TAG_RELATION_ENTITY_NOT_FOUND`.
- This preserves forward-compatibility: once entity tables are created, existence checks automatically begin resolving correctly.

**This is intentional architecture:** the entity existence check compiles correctly today; functional validation begins when the entity tables are provisioned.

---

## Transaction Design

| Operation           | Inside TX | Isolation      | Concurrency Guard                                                  |
| ------------------- | --------- | -------------- | ------------------------------------------------------------------ |
| `createTag`         | Yes       | READ COMMITTED | `UNIQUE(normalized_name)` — app check + DB backstop                |
| `updateTag`         | Yes       | READ COMMITTED | `UNIQUE(normalized_name)` self-exclude + DB backstop               |
| `deleteTag`         | Yes       | READ COMMITTED | `COUNT(tag_relations)` gate inside TX                              |
| `createTagRelation` | Yes       | READ COMMITTED | `UNIQUE(tag_id, entity_type, entity_id)` + app check + DB backstop |
| `deleteTagRelation` | Yes       | READ COMMITTED | Existence check inside TX                                          |
| Read operations     | No        | N/A            | No write conflict possible                                         |

**Transaction pattern (consistent with `category-values.service.ts`):**

```typescript
await db.query("BEGIN");
try {
  // … preconditions → writes …
  await db.query("COMMIT");
} catch (err) {
  await db.query("ROLLBACK");
  // catch 23505 → TAG_DUPLICATE / TAG_RELATION_DUPLICATE
  throw err;
}
```

---

## Idempotency Plan

| Operation           | Idempotency Mechanism                                              |
| ------------------- | ------------------------------------------------------------------ |
| `createTag`         | Application-level normalized_name check (409) + DB unique backstop |
| `createTagRelation` | Application-level duplicate check (409) + DB unique backstop       |
| `deleteTag`         | Idempotent by design: missing ID returns 404 (not 200)             |
| `deleteTagRelation` | Idempotent by design: missing ID returns 404 (not 200)             |
| `updateTag`         | Same-value updates are safe (no state corruption)                  |

No DLQ or worker deduplication required — all operations are synchronous.

---

## Normalization Strategy

`normalizedName` computation: `name.trim().toLowerCase()`

Rules:

- Computed server-side; never accepted from client.
- Empty/whitespace-only `name` rejected by Zod validation BEFORE normalization.
- Self-update safe: when updating a tag's name, the uniqueness check uses:
  ```sql
  WHERE normalized_name = $input_normalized AND id != $tag_id
  ```
  This prevents "Algebra" → "Algebra" from falsely reporting a conflict.

---

## Validation Schema (`packages/validation/src/backoffice/tags.schemas.ts`)

```typescript
const MAX_TAG_NAME_LENGTH = 255;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

export const tagParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createTagBodySchema = z.object({
  name: z.string().trim().min(1, "name must not be blank").max(MAX_TAG_NAME_LENGTH),
});

export const updateTagBodySchema = z.object({
  name: z.string().trim().min(1).max(MAX_TAG_NAME_LENGTH).optional(),
  status: z.enum(["ENABLED", "DISABLED"]).optional(),
});

export const listTagsQuerySchema = z.object({
  status: z.enum(["ENABLED", "DISABLED"]).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
});

export const createTagRelationBodySchema = z.object({
  tagId: z.string().uuid(),
  entityType: z.enum(["MCQ_QUESTION", "TRADITIONAL_QUESTION", "LIBRARY_FILE"]),
  entityId: z.string().uuid(),
});

export const tagRelationParamsSchema = z.object({
  id: z.string().uuid(),
});

export const entityTagsParamsSchema = z.object({
  entityType: z.enum(["MCQ_QUESTION", "TRADITIONAL_QUESTION", "LIBRARY_FILE"]),
  entityId: z.string().uuid(),
});

export const listTagEntitiesQuerySchema = z.object({
  entityType: z.enum(["MCQ_QUESTION", "TRADITIONAL_QUESTION", "LIBRARY_FILE"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(MAX_PER_PAGE).default(DEFAULT_PER_PAGE),
});
```

---

## Tag Filtering on Entity Endpoints

**Deferred implementation** — MCQ questions, traditional questions, and library files do not yet have endpoints in this codebase. The tag filtering contract is documented here and in `spec.md`, and will be integrated when those entity domains are implemented.

**Contractual specification** (to be implemented per entity domain):

- Query parameter: `tagIds[]` (array of UUIDs)
- Logic: AND — entity must have ALL specified tags assigned
- SQL pattern:
  ```sql
  SELECT e.*
  FROM <entity_table> e
  WHERE e.id IN (
    SELECT entity_id FROM tag_relations
    WHERE entity_type = '<TYPE>'
      AND tag_id = $tagId1
    INTERSECT
    SELECT entity_id FROM tag_relations
    WHERE entity_type = '<TYPE>'
      AND tag_id = $tagId2
  )
  ```
- Index dependency: `idx_tag_relations_tag_id`, `idx_tag_relations_entity`

---

## Version Enforcement Strategy

- `schema_version` validated at tenant resolver middleware (existing platform middleware)
- Migration `20260323_010_tags.ts` bumps schema to `1.16.0`
- Tenants on schemas < `1.16.0` will hit `426 Upgrade Required` until migrated
- `product_version` enforced at request boundary per Constitution ADR-0007

---

## Authoritative Time Handling

- All `created_at` / `updated_at` set via `DEFAULT NOW()` in migration and via `defaultNow()` in Drizzle schema
- No client-supplied timestamps accepted
- No expiration, deadline, or grace logic — feature is purely synchronous

---

## Observability & Logging

**All log calls use `@zidney/logger` structured logger. No `console.log`.**

Required structured log fields per operation:

| Event                  | Fields                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------- |
| `tag.created`          | `tag_id`, `workspace_id`, `correlation_id`, `caller_id`                               |
| `tag.updated`          | `tag_id`, `workspace_id`, `correlation_id`, `caller_id`, `changes`                    |
| `tag.deleted`          | `tag_id`, `workspace_id`, `correlation_id`, `caller_id`                               |
| `tag-relation.created` | `relation_id`, `tag_id`, `entity_type`, `entity_id`, `workspace_id`, `correlation_id` |
| `tag-relation.deleted` | `relation_id`, `workspace_id`, `correlation_id`, `caller_id`                          |

Log format: `'tags:service'` logger category across all operations.

---

## Rate Limiting

No new rate limit thresholds introduced. Existing platform rate limiter (backoffice middleware) applies. Tag management is a low-frequency management operation.

---

## Failure Modes

| Mode                                        | Behaviour                                                                         |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| DB unavailable                              | Tenant resolver middleware returns `503` before any route handler executes        |
| Normalized_name collision (concurrent)      | `err.code === '23505'` caught → `409 TAG_DUPLICATE`                               |
| Duplicate tag-relation (concurrent)         | `err.code === '23505'` caught → `409 TAG_RELATION_DUPLICATE`                      |
| Invalid entityType `23514` (DB CHECK fires) | Caught → `422 TAG_RELATION_INVALID_ENTITY_TYPE`                                   |
| Entity table does not exist (`42P01`)       | Caught → `422 TAG_RELATION_ENTITY_NOT_FOUND`                                      |
| License blocked                             | License middleware returns `423` (SOFT_LOCKED) or `403` (ARCHIVED) before handler |
| Schema version mismatch                     | Tenant resolver returns `426`                                                     |
| Partial transaction failure                 | `ROLLBACK` in catch block — no partial writes                                     |

---

## Security Review

| Check                           | Status                                                   |
| ------------------------------- | -------------------------------------------------------- |
| RBAC enforcement server-side    | ✅ — `requireAnyPermission` middleware applied per route |
| No role checks in frontend      | ✅ — No frontend in this stage                           |
| No secrets exposed in responses | ✅ — Tag payloads contain no credentials                 |
| JWT workspace scope enforced    | ✅ — Tenant resolver validates workspace membership      |
| No sensitive data in logs       | ✅ — Only IDs and operation names logged                 |
| Input length bounded            | ✅ — `name` max 255 chars via Zod                        |
| SQL injection mitigated         | ✅ — All queries via Drizzle ORM parameterized queries   |

---

## Test Strategy

### Unit Tests (`packages/domain-core/src/tags/__tests__/tags.service.test.ts`)

- `normalizedName` derivation: lowercase, trim, empty/whitespace rejected
- Duplicate detection with self-exclusion on update
- Transaction rollback on `23505` — returns `TAG_DUPLICATE`
- Transaction rollback on `23505` for relations — returns `TAG_RELATION_DUPLICATE`
- Entity existence check: `42P01` table-not-found → `TAG_RELATION_ENTITY_NOT_FOUND`
- `TAG_HAS_RELATIONS` prevents delete
- `TAG_DISABLED` prevents assignment
- `TAG_RELATION_INVALID_ENTITY_TYPE` for unsupported entityType

### Integration Tests (`packages/domain-core/src/tags/__tests__/tags.repository.test.ts`)

- Create tag → verify `normalized_name` and indexes in real DB
- Unique constraint enforcement on `normalized_name`
- Cascading delete: `tags.id` deletion cascades to `tag_relations`
- Composite unique index: prevents duplicate `(tag_id, entity_type, entity_id)`

### API Integration Tests (`tests/tags.integration.test.ts`)

Full CRUD flow, permission enforcement, tenant isolation, lifecycle scenarios — per all 7 User Stories in spec.md.

### Migration Tests

- Migration creates both tables with correct constraints
- `UNIQUE(normalized_name)` present and enforced
- `UNIQUE(tag_id, entity_type, entity_id)` present
- `ON DELETE CASCADE` on `tag_relations.tag_id` enforced

---

## Rollback Strategy

- Migration `down()` function drops `tag_relations` then `tags` (CASCADE to handle FK order)
- Feature has no Worker state, no Redis keys, no external side effects
- Safe to roll back without data residue risk
- No feature flag required — backoffice-only, no student-facing exposure

---

## File Creation Checklist

| File                                                              | Action                                |
| ----------------------------------------------------------------- | ------------------------------------- |
| `apps/api/src/db/tenant/migrations/20260323_010_tags.ts`          | Create                                |
| `apps/api/src/db/tenant/schemas/tags.schema.ts`                   | Create                                |
| `apps/api/src/db/tenant/schemas/tag-relations.schema.ts`          | Create                                |
| `packages/domain-core/src/tags/tags.errors.ts`                    | Create                                |
| `packages/domain-core/src/tags/tags.types.ts`                     | Create                                |
| `packages/domain-core/src/tags/tags.repository.ts`                | Create                                |
| `packages/domain-core/src/tags/tags.service.ts`                   | Create                                |
| `packages/domain-core/src/tags/tags.dependency-registry.ts`       | Create                                |
| `packages/domain-core/src/tags/index.ts`                          | Create                                |
| `packages/domain-core/src/tags/__tests__/tags.service.test.ts`    | Create                                |
| `packages/domain-core/src/tags/__tests__/tags.repository.test.ts` | Create                                |
| `packages/validation/src/backoffice/tags.schemas.ts`              | Create                                |
| `apps/api/src/routes/backoffice/tags/index.ts`                    | Create                                |
| `apps/api/src/routes/backoffice/tags/helpers.ts`                  | Create                                |
| `apps/api/src/routes/backoffice/tags/create-tag.ts`               | Create                                |
| `apps/api/src/routes/backoffice/tags/list-tags.ts`                | Create                                |
| `apps/api/src/routes/backoffice/tags/get-tag.ts`                  | Create                                |
| `apps/api/src/routes/backoffice/tags/update-tag.ts`               | Create                                |
| `apps/api/src/routes/backoffice/tags/delete-tag.ts`               | Create                                |
| `apps/api/src/routes/backoffice/tags/create-tag-relation.ts`      | Create                                |
| `apps/api/src/routes/backoffice/tags/delete-tag-relation.ts`      | Create                                |
| `apps/api/src/routes/backoffice/tags/list-entity-tags.ts`         | Create                                |
| `apps/api/src/routes/backoffice/tags/list-tag-entities.ts`        | Create                                |
| `tests/tags.integration.test.ts`                                  | Create                                |
| `packages/domain-core/src/index.ts`                               | Modify — add `export * from './tags'` |
| `apps/api/src/app.ts`                                             | Modify — import + mount `tagsRouter`  |

---

## Non-Goals

- Hierarchical tags (parent/child) — explicitly forbidden
- Cross-tenant tag sharing or global catalog
- Frontoffice tag exposure
- Bulk tag assignment (multi-tag-to-entity in one request)
- Tag import/export
- Tag usage analytics
- Soft delete for tags
- Tag filtering integrated into MCQ / library file entity endpoints (deferred — those domains don't exist yet)
- OR-logic multi-tag filtering (AND is the only supported mode)

---

## Final Compliance Statement

Implementation plan compliant with Zidney Constitution v1.2.0 — No violations detected.

All API routes enforce tenant resolver + license middleware. All write operations run inside transactions. Server-authoritative timestamps only. Unique constraint violations properly caught and mapped to structured error codes. No cross-tenant data access. No worker interaction. No attempt-engine impact. Schema 1.15.0 → 1.16.0 via forward-only migration.
