# Feature Specification: Translation System

**Feature Branch**: `019-translation-system`  
**Created**: 2026-03-01  
**Status**: Draft  
**Input**: User description: "Tenant-scoped entity-level translation system supporting dynamic
language configuration per workspace, strict tenant isolation, deterministic fallback behavior,
coverage analytics, and scale to millions of translation rows."

---

## User Scenarios & Testing

### User Story 1 – Translate Entity Fields into Supported Languages (Priority: P1)

A content author working in the Backoffice opens an entity (such as a subject, category, or exam)
and enters translated values for its translatable fields (e.g., title, description) in each
supported workspace language. The system stores each translated value linked to the entity, the
specific field, and the language — while the default language content remains in the base entity
record.

**Why this priority**: This is the core write path of the translation system. Without it, no
translations exist, no fallback can occur, and no coverage can be tracked. Every other story depends
on translations being created and stored correctly.

**Independent Test**: Can be tested by saving a translated value for a single entity field in a
non-default language, then retrieving the entity in that language and verifying the translated value
is returned. Independently verifies write, read, and tenant isolation in one flow.

**Acceptance Scenarios**:

1. **Given** an authenticated content author in the Backoffice, **When** they submit a translated
   value for `entity_type="subject"`, `entity_id=<UUID>`, `field_name="title"`,
   `language_code="ar"`, **Then** the system upserts the translation row, updates `updated_at` to
   server time, creates an audit log entry, and returns success.
2. **Given** a translation already exists for the same composite key (entity_type, entity_id,
   field_name, language_code), **When** the author saves a new value, **Then** the system updates
   the existing row (upsert) rather than inserting a duplicate, and the unique constraint is not
   violated.
3. **Given** a content author submitting a translation for a language code not in the workspace's
   supported languages, **When** the save is attempted, **Then** the system rejects the request with
   a validation error identifying the unsupported language.
4. **Given** a content author submitting a translation for an entity_id that does not exist,
   **When** the save is attempted, **Then** the system rejects the request with a validation error
   identifying the missing entity.
5. **Given** a content author submitting a translation with `language_code` equal to the workspace
   default language, **When** the save is attempted, **Then** the system rejects the request because
   default-language values must live in the base entity table, not the translations table.
6. **Given** a valid translation save, **When** the operation completes, **Then** the response
   includes the saved translation record with server-authoritative timestamps.

---

### User Story 2 – Retrieve Entity with Language-Aware Fallback (Priority: P1)

A student or staff member requests an entity in a specific language. The system resolves the correct
value for each translatable field: returning the translation if available, or falling back to the
default-language value from the base entity record if no translation exists. Fallback is
deterministic, silent, and consistent across all entity types.

**Why this priority**: This is the core read path. Every content display in the platform uses
language-aware resolution. Incorrect or non-deterministic fallback would cause content gaps or
inconsistent behavior for students and authors.

**Independent Test**: Can be tested by requesting an entity in a language that has a partial
translation (some fields translated, some not), and verifying that translated fields return
translated values while untranslated fields return the default-language value.

**Acceptance Scenarios**:

1. **Given** a request for `entity_type="subject"`, `entity_id=<UUID>` in `language_code="ar"` where
   `"ar"` is the workspace default, **When** the resolution runs, **Then** the base entity field
   values are returned directly without querying the translations table.
2. **Given** a request in `language_code="fr"` where a translation row exists for all requested
   fields, **When** the resolution runs, **Then** translated values are returned for all fields.
3. **Given** a request in `language_code="fr"` where a translation row exists for `title` but not
   for `description`, **When** the resolution runs, **Then** `title` returns the `fr` translated
   value and `description` falls back to the default-language base entity value.
4. **Given** a request in `language_code="es"` where no translation rows exist for the entity,
   **When** the resolution runs, **Then** all fields fall back to the default-language base entity
   values.
5. **Given** a base entity field that is somehow missing its default value (invalid data state),
   **When** fallback triggers for that field, **Then** the system returns an empty string for that
   field and records a structured warning log entry (including entity_type, entity_id, field_name).
6. **Given** a batch request for multiple entity IDs of the same entity_type in a specific language,
   **When** translations are resolved, **Then** the system loads all translations in a single
   indexed batch query (not N individual queries).

---

### User Story 3 – Manage Workspace Languages (Priority: P1)

An institution administrator adds new supported languages, removes existing languages, or changes
the default language via workspace settings. Language management cascades correctly: removing a
language safely deletes its translation rows; the default language is always protected from removal.

**Why this priority**: Language configuration governs what translations are valid and what fallback
applies. Misconfiguration here corrupts translation integrity for all entities. This story is
foundational for both write and read correctness.

**Independent Test**: Can be tested by adding a new language, verifying translations can now be
saved in it; then removing that language and verifying its translations are deleted and the language
no longer accepts new translations.

**Acceptance Scenarios**:

1. **Given** a workspace with supported languages `["ar", "en"]` and default_language `"ar"`,
   **When** an admin adds `"fr"` to supported languages and saves, **Then** `"fr"` becomes a valid
   language for translations, and translation coverage is recalculated.
2. **Given** a workspace with supported languages `["ar", "en", "fr"]`, **When** an admin removes
   `"fr"` from supported languages, **Then** all translation rows with `language_code="fr"` are
   deleted from the tenant database within the same transaction, and `"fr"` is no longer accepted in
   translation write operations.
3. **Given** a workspace with default_language `"ar"`, **When** an admin attempts to remove `"ar"`
   from supported languages, **Then** the system rejects the request with a clear error stating the
   default language cannot be removed.
4. **Given** an admin changes the default language from `"ar"` to `"en"`, **When** the change is
   saved, **Then** the workspace default language is updated, no existing base entity field values
   are migrated automatically, and the audit log records the change.
5. **Given** a language removal for a language that has zero translation rows, **When** the removal
   is saved, **Then** the operation completes successfully with no errors and no orphaned data.

---

### User Story 4 – View Translation Coverage per Language and Entity Type (Priority: P2)

A content manager views a coverage dashboard showing what percentage of translatable fields have
been translated per entity type (subjects, categories, questions, etc.) and per language. Coverage
data helps prioritize translation work and ensures completeness before publishing in a new language.

**Why this priority**: Coverage tracking is a key decision tool for content managers. Without it,
institutions cannot know how ready a language is for student use. It is not blocking for basic
translation read/write but is required for the full workflow.

**Independent Test**: Can be tested by creating a controlled set of entities with known translation
completeness, then querying coverage for a specific entity_type and language, and verifying the
returned percentage matches the expected calculation.

**Acceptance Scenarios**:

1. **Given** 10 subjects each with 3 translatable fields, and 15 of 30 total field slots translated
   in `"fr"`, **When** coverage is requested for `entity_type="subject"`, `language_code="fr"`,
   **Then** the system returns `50%` coverage.
2. **Given** a language with zero translations for an entity type, **When** coverage is requested
   for that entity_type and language, **Then** the system returns `0%` coverage without errors.
3. **Given** the default language is requested in coverage, **When** the coverage query runs,
   **Then** the system excludes the default language from coverage results (default language content
   lives in base tables, not translations).
4. **Given** a new translation is saved for an entity field in `"fr"`, **When** coverage is
   subsequently queried for `entity_type` and `"fr"`, **Then** the coverage percentage reflects the
   newly added translation (either via fresh computation or cache-invalidated re-computation).
5. **Given** a language is removed from workspace settings, **When** coverage is queried after the
   removal, **Then** no coverage data is returned for that language.

---

### User Story 5 – Bulk Manage Translations per Entity (Priority: P2)

A content author opens a translation management panel for a specific entity and sees all its
translatable fields across all supported languages in a paginated, navigable interface. The author
can update multiple field translations for a given language in one save operation, with each update
audited individually.

**Why this priority**: Bulk management dramatically improves translator productivity. Translating
fields one by one is impractical at scale. This is essential for institutions managing large content
libraries.

**Independent Test**: Can be tested by loading the translation panel for a single entity and
verifying all translatable fields x all supported languages are listed, then saving multiple
translations in one operation and verifying each is stored and each has an audit log entry.

**Acceptance Scenarios**:

1. **Given** an entity with 5 translatable fields and a workspace with 3 non-default supported
   languages, **When** the translation panel for that entity is loaded, **Then** up to 15
   translation slots are displayed (5 fields × 3 languages), showing current values where they exist
   and empty states where they do not.
2. **Given** a content author saves 5 field translations for `language_code="fr"` in one operation,
   **When** the save completes, **Then** all 5 rows are upserted, 5 audit log entries are created,
   and the response confirms all 5 were saved.
3. **Given** a large entity set requiring translation management, **When** the translation list is
   requested, **Then** results are paginated with a maximum page size enforced by the system to
   prevent unbounded response sizes.
4. **Given** a save operation containing one invalid field (language not in workspace settings),
   **When** the batch is submitted, **Then** the entire batch is rejected as a unit — no partial
   saves are committed.

---

### User Story 6 – Audit Trail for All Translation Changes (Priority: P1)

Every translation save, update, or delete creates an immutable audit log entry recording who made
the change, which entity was affected, which field and language, and when the change occurred. The
audit trail is scoped to the tenant database and never exposes sensitive data.

**Why this priority**: Auditability is a constitutional requirement. Translation changes affect
content that students see in exams and courses. Every change must be traceable for compliance,
rollback investigation, and accountability.

**Independent Test**: Can be tested by performing a translation upsert and then querying the audit
log for that entity_id, verifying the log entry contains entity_type, entity_id, field_name,
language_code, user_id, and timestamp.

**Acceptance Scenarios**:

1. **Given** a translation upsert completes successfully, **When** the audit log is queried for the
   affected entity, **Then** an entry exists with entity_type, entity_id, field_name, language_code,
   user_id (staff who made the change), and a server-authoritative timestamp.
2. **Given** a language removal that cascades to delete multiple translation rows, **When** the
   deletion completes, **Then** audit log entries are created recording that the translations were
   deleted as part of a language removal operation.
3. **Given** multiple sequential translation updates to the same field, **When** the audit log is
   queried, **Then** each update has a distinct immutable entry in chronological order.
4. **Given** an audit log query for a specific entity, **When** the log is returned, **Then**
   entries cannot be modified or deleted — the log is append-only.

---

### Edge Cases

- What happens when an entity is deleted from the base table? All orphaned translation rows for that
  entity must be cleaned up either via cascading foreign key constraint enforcement or a cleanup job
  — translations must never reference non-existent entities.
- What happens when two staff members simultaneously update the same translation field for the same
  entity and language? The system must handle this transactionally — one update wins (last write
  wins for translations is acceptable given upsert semantics), and both are audited.
- What happens when a workspace changes its default language and content exists only in the old
  default language? The base entity values remain unchanged in the entity table — no automatic
  migration occurs. The new default becomes the fallback anchor, but old content is not
  automatically copied.
- What happens when coverage is computed for an entity type that has been entirely deleted? Coverage
  returns 0% or empty without errors.
- What happens when the translations table grows beyond expected scale (tens of millions of rows)?
  Indexed queries must remain performant; if query times degrade, partitioning by language_code or
  entity_type must be eligible as a forward-compatible upgrade path.
- What happens when a translation value is submitted as an empty string? Empty strings are valid
  translation values (allowing explicit "blank" translations). NULL values should not be used for
  translated_value — empty string is the correct representation of intentional blank.

---

## Requirements

### Functional Requirements

**Translation Storage**

- **FR-001**: System MUST store translations exclusively in the tenant database. No translation data
  is allowed in the master database or any shared database.
- **FR-002**: The `translations` table MUST have columns: `id` (UUID, primary key), `entity_type`
  (varchar, non-null), `entity_id` (UUID, non-null), `field_name` (varchar, non-null),
  `language_code` (varchar, non-null), `translated_value` (text, non-null), `created_at` (timestamp
  with time zone), `updated_at` (timestamp with time zone).
- **FR-003**: The `translations` table MUST enforce a unique constraint on
  `(entity_type, entity_id, field_name, language_code)`.
- **FR-004**: The `translations` table MUST have the following indexes: composite index on
  `(entity_type, entity_id)`, composite index on `(entity_type, language_code)`, and index on
  `(language_code)` for coverage queries.
- **FR-005**: System MUST NOT store default-language values in the `translations` table.
  Default-language content lives exclusively in base entity table columns.

**Default Language Strategy**

- **FR-006**: System MUST identify the workspace default language from
  `workspace_settings.language_settings.default_language`.
- **FR-007**: When resolving entity fields for the default language, the system MUST read values
  from the base entity table and MUST NOT query the translations table for those fields.
- **FR-008**: System MUST reject any translation write request where `language_code` equals the
  workspace's current default language.

**Fallback Logic**

- **FR-009**: Translation resolution MUST occur exclusively in the API layer. No database triggers,
  stored procedures, or database-level computed columns may perform fallback logic.
- **FR-010**: When a requested language is not the default and a translation row exists, the system
  MUST return the `translated_value` from the translations table.
- **FR-011**: When a requested language is not the default and no translation row exists for a
  field, the system MUST fall back to the base entity field value for that field (default-language
  content).
- **FR-012**: When fallback occurs due to a missing base entity default value (invalid data state),
  the system MUST return an empty string for that field and MUST emit a structured warning log entry
  containing entity_type, entity_id, and field_name.
- **FR-013**: Fallback behavior MUST be deterministic and identical across all entity types that use
  the translations system.

**Language Management**

- **FR-014**: Supported languages and the default language for a workspace MUST be managed via
  `workspace_settings.language_settings` — no separate language management table is used.
- **FR-015**: System MUST reject any translation write where `language_code` is not present in
  `workspace_settings.language_settings.supported_languages`.
- **FR-016**: When a language is removed from supported languages, the system MUST delete all
  `translations` rows with that `language_code` within the same database transaction as the settings
  update.
- **FR-017**: System MUST reject any workspace settings update that attempts to remove the current
  default language from supported languages.
- **FR-018**: Changing the default language MUST NOT trigger automatic migration of base entity
  content. Base entity field values remain unchanged.

**Coverage Tracking**

- **FR-019**: The system MUST provide coverage data per `(entity_type, language_code)` pair,
  calculated as:
  `(count of translated fields) / (total translatable fields for that entity_type) × 100`.
- **FR-020**: Coverage data MUST exclude the workspace default language (its content lives in base
  tables, not translations).
- **FR-021**: Coverage MUST be computable at query time via indexed aggregation OR cached per
  `(workspace_id, entity_type, language_code)` with invalidation on any translation write or
  language configuration change for that scope.
- **FR-022**: Coverage computation MUST NOT perform full-table scans. All coverage queries MUST use
  the composite index on `(entity_type, language_code)`.
- **FR-023**: If coverage uses a cache, the cache MUST be scoped per tenant — no cross-tenant
  coverage cache is permitted.

**Write Rules**

- **FR-024**: All translation writes MUST be executed as upserts: insert if the composite key
  `(entity_type, entity_id, field_name, language_code)` does not exist; update if it does.
- **FR-025**: Before saving a translation, the system MUST validate that the `language_code` exists
  in the workspace's supported languages.
- **FR-026**: Before saving a translation, the system MUST validate that the referenced entity
  (entity_type + entity_id) exists.
- **FR-027**: All translation write operations MUST execute within a database transaction.
- **FR-028**: `updated_at` MUST be set to server-authoritative time on every write.
- **FR-029**: Batch write operations MUST be committed or rejected as a unit — partial saves within
  a batch are not permitted.
- **FR-030**: Critical translation endpoints MUST be idempotent — submitting the same upsert twice
  produces the same final state without error.

**Audit Logging**

- **FR-031**: Every translation write (create, update, or delete) MUST produce an immutable audit
  log entry in the tenant database.
- **FR-032**: Each audit log entry MUST contain: entity_type, entity_id, field_name, language_code,
  action (created/updated/deleted), user_id (staff actor), workspace_id, and server-authoritative
  timestamp.
- **FR-033**: Each audit log entry MUST include the request correlation_id.
- **FR-034**: Audit log entries MUST be append-only and MUST NOT be modified or deleted.
- **FR-035**: Language removal cascade-deletes MUST produce audit log entries for the deleted
  translations, recording the reason as "language_removed".

**Performance & Scale**

- **FR-036**: All translation lookups MUST use indexed queries. No full-table scans are permitted in
  production translation read or write paths.
- **FR-037**: Batch translation loading for entity lists MUST load all translations in a single
  indexed query per entity_type (no N+1 queries).
- **FR-038**: Translation management APIs MUST support pagination with a server-enforced maximum
  page size.
- **FR-039**: The translations table schema MUST support a future partitioning strategy (by
  `language_code` or `entity_type`) without requiring application-level changes when partitioning is
  introduced.

**Access Control**

- **FR-040**: All translation routes MUST pass through tenant resolver middleware before any
  database access.
- **FR-041**: All translation routes MUST pass through license enforcement middleware before any
  business logic executes.
- **FR-042**: Translation read operations MUST be scoped to authenticated users with appropriate
  workspace access. Translation write operations MUST require staff-level permissions.

### Key Entities

- **Translation**: A single translated value for one field of one entity in one language. Identified
  by the composite key `(entity_type, entity_id, field_name, language_code)`. Stores the translated
  text, server timestamps, and is linked to the tenant workspace. Never holds default-language
  values.
- **Translation Audit Entry**: An immutable record of a translation change event. Captures actor
  identity (user_id), workspace context, the full composite key of the affected translation, the
  type of action, request correlation ID, and server-authoritative timestamp. Lives exclusively in
  the tenant database.
- **Translation Coverage Record**: A computed or cached summary of translation completeness per
  `(entity_type, language_code)` pair within a workspace. Expresses completeness as a percentage.
  Always excludes the default language. Subject to invalidation on any relevant translation write or
  language configuration change.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Content authors can save or update a translation for any entity field in any supported
  language and see the saved value reflected in subsequent reads within the same session — 100%
  write-read consistency.
- **SC-002**: Translation resolution for all translatable fields of a single entity completes within
  50ms under normal load conditions, with fallback to default-language values applying where
  translations are absent.
- **SC-003**: Batch translation loading for a list of up to 100 entities of the same type completes
  in a single database round-trip — zero N+1 query patterns are present in translation reads.
- **SC-004**: Every translation write produces a verifiable audit log entry — 100% of writes are
  audited with no silent mutations.
- **SC-005**: Removing a language from workspace settings safely removes all associated translation
  rows — within the same transaction (≤10,000 rows) or via the async DRAIN flow for large datasets
  (>10,000 rows) — zero orphaned translation rows remain after a language removal.
- **SC-006**: Coverage calculation for any `(entity_type, language_code)` pair is accurate to within
  1% of the actual count at time of computation — verified by creating a controlled entity set with
  known completeness.
- **SC-007**: Translation system supports a dataset of 5 million rows per tenant without query time
  regression — all indexed lookups remain within the 50ms target at this scale.
- **SC-008**: No translation data from one tenant is accessible, visible, or leaked to any other
  tenant — verified via cross-tenant isolation tests.
- **SC-009**: Default-language content is never stored in the `translations` table — verified by
  schema constraint enforcement and integration tests.
- **SC-010**: Fallback behavior is deterministic — when a translation is absent for a field, the
  default-language base entity value is served 100% of the time, regardless of entity type.

---

## Assumptions

- `entity_type` values (e.g., "subject", "category", "question") are defined by the consuming domain
  and registered as constants in the translation system — the translations table accepts any string
  value for entity_type (open-ended registry pattern).
- The list of translatable fields per entity_type is defined by the domain layer, not stored in the
  translations table itself. Coverage calculation uses the domain's declared field count as the
  denominator.
- Translation writes are initiated by authenticated Backoffice staff users only. Student-facing
  frontoffice does not write translations.
- The `workspace_settings` record for a workspace always exists before translation operations begin
  (guaranteed by workspace provisioning).
- `translated_value` is always stored as text. Rich-text or structured content serialization is the
  responsibility of the caller; the translation system treats all values as opaque strings.
- No translation versioning (history of past translation values) is required at this stage — the
  audit log provides a change trail but the translations table stores only the current value.
- Translation system is used by Backoffice content modules (subjects, categories, etc.) at this
  stage. Frontoffice reads resolved translations served by the API layer.

---

## Clarifications

### Session 2026-03-01

- Q: What is the strategy for cleaning up orphaned translation rows when a base entity (subject,
  category, question, etc.) is deleted — FK constraint cascade or a background cleanup job? → A:
  Application-layer explicit delete within the same database transaction as entity deletion (no FK
  cascade, no background job).
- Q: What HTTP status codes and structured error codes must be returned for the three primary
  validation rejections (unsupported language, missing entity, default language write attempt)? → A:
  422 Unprocessable Entity + error code `UNSUPPORTED_LANGUAGE` for language not in
  supported_languages; 404 Not Found + error code `ENTITY_NOT_FOUND` for entity_type+entity_id that
  does not exist; 422 Unprocessable Entity + error code `DEFAULT_LANGUAGE_WRITE` for language_code
  equal to the workspace default language.
- Q: What happens when a language removal cascade exceeds transaction safety limits (e.g., millions
  of rows) — synchronous in-transaction or hybrid threshold-based? → A: Hybrid row-count threshold:
  if `COUNT(translations WHERE language_code = X) > 10,000`, reject the synchronous removal and
  require an async removal flow (language marked `removing`, Worker drains rows, then language is
  removed); below the threshold, synchronous in-transaction deletion proceeds.
- Q: What is the idempotency key for translation upsert operations — composite key only, composite
  key + value, or client-provided idempotency header? → A: The composite key
  `(entity_type, entity_id, field_name, language_code)` is the idempotency key. Re-submitting the
  same composite key with any value (same or different) is always safe — it is an upsert, not an
  error. No client-provided idempotency header is required.
- Q: What is the mechanism by which the total translatable field count per entity_type is maintained
  for coverage denominator calculation — hardcoded domain constant, config file, or database
  registry table? → A: Static constant map (`TRANSLATABLE_FIELDS`) in the domain-core package, keyed
  by entity_type string (e.g., `{ subject: ['title', 'description'], category: ['name'], ... }`).
  Coverage denominator is a pure function call — zero runtime DB overhead. Adding a translatable
  field requires a domain-package code change plus a migration, enforcing governance.

---

### Clarification Implications for Technical Planning

**Q1 — Entity Deletion (Application-layer explicit delete in same transaction)**

- The API route that deletes a base entity (subject, category, etc.) MUST issue a
  `DELETE FROM translations WHERE entity_type = X AND entity_id = Y` within the same database
  transaction before or alongside the entity deletion.
- No database-level FK with `ON DELETE CASCADE` is added to the `translations` table (it cannot
  point to multiple parent tables).
- The domain deletion service is responsible for orchestrating this. It is NOT delegated to the
  Worker.
- Tests MUST verify that after entity deletion zero translation rows remain for that entity_id, and
  that the operation is atomic (failure of either delete rolls back both).

**Q2 — Error Contract (422 / 404 with error codes)**

- API route handlers for translation write endpoints MUST return the following structured errors per
  the platform error contract (`{ success: false, data: null, error: { code, message } }`):
  - `UNSUPPORTED_LANGUAGE` → HTTP 422
  - `ENTITY_NOT_FOUND` → HTTP 404
  - `DEFAULT_LANGUAGE_WRITE` → HTTP 422
- These error codes MUST be defined as constants in the domain-core or validation package (not
  inline strings).
- Tests MUST assert the exact HTTP status code and error code for each rejection scenario.

**Q3 — Transaction Boundaries for Large Language Removal Cascade**

- Language removal endpoint MUST perform a row count check BEFORE entering the deletion transaction:
  `SELECT COUNT(*) FROM translations WHERE language_code = X`.
- If count > 10,000: return HTTP 409 Conflict with error code `LANGUAGE_REMOVAL_REQUIRES_ASYNC` and
  transition the language status to `removing` in `workspace_settings`.
- Worker picks up `removing` languages and drains rows in batches (configurable batch size, default
  1,000) using idempotent `DELETE … LIMIT N` loops, then sets the language to removed.
- If count ≤ 10,000: execute deletion synchronously within the settings update transaction (FR-016
  satisfied).
- SC-005 must be updated to reflect the threshold: "within the same transaction OR via the async
  drainage flow for large datasets."
- Audit log entries for cascade-deleted translations (FR-035) apply to both paths.

**Q4 — Idempotency (Composite key is the idempotency key)**

- FR-030 is clarified: "same request" means same
  `(entity_type, entity_id, field_name, language_code)` composite key, regardless of
  `translated_value`.
- Upsert is always safe to retry — the server returns HTTP 200 (not 201) for both create and update
  paths to signal idempotency.
- No client-side idempotency-key header is required or validated.
- Tests MUST verify that submitting the identical composite key twice in rapid succession does not
  produce a duplicate row or a unique-constraint error, and that the final `translated_value`
  reflects the last submitted value.

**Q5 — Coverage Denominator (Static domain constant map)**

- A `TRANSLATABLE_FIELDS` constant record MUST be defined in the domain-core package (e.g.,
  `packages/domain-core/src/translation/translatable-fields.ts`).
- Coverage denominator = `TRANSLATABLE_FIELDS[entity_type].length`. If `entity_type` is absent from
  the map, coverage returns 0% with a structured warning log (not an error).
- Adding a new entity_type or new field to an existing entity_type requires: (a) updating the
  constant map, (b) a domain-package version bump, (c) no migration required (the translations table
  is already open-ended for entity_type strings).
- Tests MUST verify coverage computation against a known constant map entry and verify the warning
  path for unknown entity types.
