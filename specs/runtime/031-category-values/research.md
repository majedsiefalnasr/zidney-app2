# Research: Category Values (Stage 031)

**Stage**: STAGE_31_CATEGORY_VALUES  
**Phase**: 03_BACKOFFICE_CORE / 03_CONTENT_CLASSIFICATION  
**Research Date**: 2026-03-22  
**Status**: COMPLETE — all unknowns resolved

---

## Research Summary

All NEEDS CLARIFICATION items from the Technical Context have been resolved by inspecting the
existing codebase. No external library research is required; this stage mirrors Stage 030
(Categories) patterns exactly.

---

## Decision 1: Migration Numbering

**Decision:** The migration file will be named `20260322_009_category_values.ts`

**Rationale:**  
Listing `apps/api/src/db/tenant/migrations/` in lexicographic sort order shows:

```
20260322_008_categories.ts   ← latest (Stage 030, bumped schema to 1.14.0)
```

The sequence is `YYYYMMDD_NNN_name.ts` where `NNN` is zero-padded 3 digits. The next slot is
`009`. The date stays `20260322` per the spec's explicit designation.

**Schema version bump:** `1.14.0 → 1.15.0` (Stage 030 used the `1.14.0` bump).

**Alternatives considered:**  
Using `20260323_009_...` (next calendar day) — rejected because the spec explicitly states
`20260322_009_category_values.ts` and Date 030 migrations already used `20260322`.

---

## Decision 2: Schema File Naming Convention

**Decision:** Three new schema files:

- `apps/api/src/db/tenant/schemas/category-values.schema.ts`
- `apps/api/src/db/tenant/schemas/category-value-subjects.schema.ts`
- `apps/api/src/db/tenant/schemas/category-value-divisions.schema.ts`

**Rationale:**  
Inspecting the existing schemas directory:

```
categories.schema.ts
category-subjects.schema.ts
category-divisions.schema.ts
```

Stage 030 used one file per table with kebab-case naming (not camelCase, not snake_case). The same
pattern applies: `{entity-name}.schema.ts`. Since `category_value_subjects` and
`category_value_divisions` are distinct tables, they get distinct files.

**Alternative:** Single `category-values.schema.ts` containing all three tables (as some older
modules did). Rejected — Stage 030 proved the one-file-per-table approach is current convention
and supports cleaner exports from `index.ts`.

---

## Decision 3: Route File Pattern

**Decision:** Route directory `apps/api/src/routes/backoffice/category-values/` with files:

```
index.ts                    ← router factory + mount
helpers.ts                  ← getDb, buildAuditCtx, success/error response helpers
list-category-values.ts     ← GET /category-values
create-category-value.ts    ← POST /category-values
get-category-value.ts       ← GET /category-values/:id
update-category-value.ts    ← PATCH /category-values/:id
delete-category-value.ts    ← DELETE /category-values/:id
__tests__/
  category-values.integration.test.ts
```

**Rationale:**  
Exact mirror of `apps/api/src/routes/backoffice/categories/`:

- `index.ts` — `Hono<BackofficeEnv>` router factory with explicit route ordering (static before
  parameterised)
- `helpers.ts` — `getDb(c)`, `buildAuditCtx(c)`, `successResponse()`, domain error ↔ HTTP mapper
- One handler file per route, named `{verb}-{resource}.ts`
- `__tests__/` for integration tests

No `get-category-values-tree.ts` equivalent (no tree endpoint for values — flat list only).

---

## Decision 4: Domain Package Structure

**Decision:** `packages/domain-core/src/category-values/` with files:

```
category-values.types.ts
category-values.errors.ts
category-values.repository.ts
category-values.service.ts
category-values.dependency-registry.ts
index.ts
__tests__/
  category-values.service.test.ts
```

**Rationale:**  
Exact mirror of `packages/domain-core/src/categories/`. File naming uses `category-values`
(kebab-case, hyphenated plural) matching `categories` (not `categoryValues` or `category_values`).

No `category-values.tree.ts` equivalent — no tree assembly needed for flat list of values.

**Translation handling:** Category Values have no `name`/`description` columns. Translations for
`entity_type = 'CATEGORY_VALUE'` live in the existing `translations` table. The repository
provides functions to read/upsert translations. The service joins translation data onto the
category value row before returning it.

---

## Decision 5: Translation Repository Pattern

**Decision:** Translation reads/writes are handled by repository functions within the
`category-values.repository.ts` file (not a separate shared translation helper).

**Rationale:**  
Examining `apps/api/src/routes/backoffice/translations/` and `packages/domain-core/src/`:
The `translations` package scope handles its own CRUD. However, for entity-specific reads, the
pattern observed in existing stages is to inline the translation query within the domain package's
repository module. The `translations.schema.ts` table uses:

- `entity_type: varchar(100)` — constant `"CATEGORY_VALUE"` for this domain
- `entity_id: uuid` — the `category_values.id` FK
- `field_name: varchar(100)` — `"name"` or `"description"`
- `language_code: varchar(10)` — e.g., `"ar"`, `"en"`
- `translated_value: text` — the text content

Upsert uses the `translations_composite_unique` constraint as conflict target:
`ON CONFLICT (entity_type, entity_id, field_name, language_code) DO UPDATE SET translated_value = EXCLUDED.translated_value, updated_at = NOW()`.

Workspace-supported languages are fetched from `workspace_settings.supported_languages` JSONB
column. The `findWorkspaceSupportedLanguages(db)` query reads this setting.

---

## Decision 6: Validation Schema Pattern

**Decision:** `packages/validation/src/backoffice/category-values.schemas.ts`

**Rationale:**  
Stage 030 uses `packages/validation/src/backoffice/categories.schemas.ts`. The validation package
uses Zod. Schemas are registered per-feature in the `backoffice/` subdirectory with kebab-case
naming. Zod v3 is used (confirmed via `packages/validation/` package.json and existing schemas).

---

## Decision 7: Workspace Language Validation Strategy

**Decision:** Language validation is performed at the service layer by querying
`workspace_settings` for `supported_languages`. Any `language_code` in a translation payload not
present in this set causes a `UNSUPPORTED_LANGUAGE` error (422) before DB writes occur.

**Rationale:**  
The `workspace_settings` table has a `settings` JSONB column containing `supported_languages`
(array of language code strings). The `findWorkspaceSupportedLanguages` function reads:

```sql
SELECT settings->>'default_language' AS default_language,
       settings->'supported_languages' AS supported_languages
FROM workspace_settings
WHERE id = (SELECT id FROM workspace_settings LIMIT 1)
```

This approach is used by the translation system already.

---

## Decision 8: Status Workflow Integration

**Decision:** Status validation is implemented inline in `category-values.service.ts` using a
statically-defined transition table (map of `from → Set<to>`). No dependency on the workflow
engine package is required for this stage.

**Rationale:**  
Examining `packages/domain-core/src/workflow/` — the workflow engine provides a generic state
machine but Category Values use a simple 6-entry transition table that is cleaner to own locally.
Stage 030 (Categories) uses simple `ENABLED/DISABLED` inline logic. Stage 031 uses a 6-state
table — still simple enough to own directly. The workflow engine is only mandatory for complex
multi-stage async processes (e.g., attempt lifecycle).

Transition map:

```typescript
const ALLOWED_TRANSITIONS: Record<CategoryValueStatus, Set<CategoryValueStatus>> = {
  COMPLETED: new Set(["UNDER_REVIEW"]),
  UNDER_REVIEW: new Set(["APPROVED"]),
  APPROVED: new Set(["ENABLED", "DISABLED"]),
  ENABLED: new Set(["DISABLED"]),
  DISABLED: new Set(["ENABLED"]),
};
```

---

## Decision 9: Scope Validation (Parent Scope Containment)

**Decision:** Before inserting scope rows, the service fetches the parent Category's scope
(subject_ids and division_ids) and validates that the provided IDs are a strict subset.

**Rationale:**  
Per spec BR-07 and US-01 AC#5-6: if a Category has subject scope `[A, B]`, a Category Value
cannot have `[A, C]` because `C` is outside the parent's restriction. Empty parent scope = global
scope = any IDs are valid. Empty value scope = inherits parent scope entirely.

Implementation: `findCategorySubjectScope(db, categoryId)` + `findCategoryDivisionScope(db, categoryId)`
fetch the parent's scope sets. If parent set is non-empty, value set must be subset of parent set.

---

## Decision 10: Soft-Delete Dependency Check

**Decision:** `category-values.dependency-registry.ts` provides an extensible registry stub
(same as `categories.dependency-registry.ts`). Initially empty — downstream MCQ/TQ stages
register their dependency functions.

**Rationale:**  
At Stage 031, no MCQ or traditional question tables exist yet. The dependency check is structurally
required by spec BR-05 (US-06 AC#2: `CATEGORY_VALUE_IN_USE`). The registry pattern allows future
stages to register their check functions without modifying this file. Until registered, all delete
operations succeed (dependency count = 0).

---

## Decision 11: Search on Translated Name

**Decision:** The LIST endpoint `search` query joins the `translations` table to filter by
translated `name` rather than searching a column on `category_values`.

**Rationale:**  
Since `name` is stored only in `translations`, a search for `"easy"` must JOIN:

```sql
LEFT JOIN translations t
  ON t.entity_type = 'CATEGORY_VALUE'
  AND t.entity_id = cv.id
  AND t.field_name = 'name'
  AND t.language_code = $language
WHERE t.translated_value ILIKE $pattern
```

This is parameterised (`pattern = '%easy%'`) to prevent injection. If no `language` is specified,
join on the workspace default language.

---

## All Unknowns Resolved

| Unknown                      | Resolution                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| Exact migration filename     | `20260322_009_category_values.ts`                                                                      |
| Schema version to bump       | `1.14.0 → 1.15.0`                                                                                      |
| Schema file naming           | `category-values.schema.ts`, `category-value-subjects.schema.ts`, `category-value-divisions.schema.ts` |
| Route file structure         | Mirror of `categories/` directory, one handler per route                                               |
| Domain package location      | `packages/domain-core/src/category-values/`                                                            |
| Translation read pattern     | Inline in repository, join on `translations` table                                                     |
| Validation schema location   | `packages/validation/src/backoffice/category-values.schemas.ts`                                        |
| Language validation          | Query `workspace_settings.settings->supported_languages`                                               |
| Status workflow              | Inline transition table in service file                                                                |
| Scope validation             | Parent scope fetch + subset check before insert                                                        |
| Soft-delete dependency check | Registry stub (empty until downstream stages)                                                          |
| Search on name               | JOIN translations + ILIKE on parameterised pattern                                                     |
