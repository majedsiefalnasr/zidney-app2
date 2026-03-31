# Research — STAGE_34_MCQ_QUESTION_MODEL

**Stage**: STAGE_34_MCQ_QUESTION_MODEL  
**Branch**: `spec/034-mcq-question-model`  
**Date**: 2026-03-30

---

## R-001: Rich Text Sanitization Library

**Decision**: Use `sanitize-html` (npm) with a strict whitelist configuration.

**Rationale**: The spec requires server-side HTML sanitization using a whitelist approach for
question content, option content, and explanation fields. `sanitize-html` is the most widely
adopted server-side HTML sanitizer in the Node.js ecosystem (~8M weekly downloads), supports
configurable tag/attribute whitelists, and runs efficiently on the server without a DOM
dependency.

**Alternatives Considered**:

- `DOMPurify` — primarily browser-focused; requires `jsdom` for server-side use, adding unnecessary weight.
- `xss` — less configurable whitelist; tag-based rather than attribute-level control.
- Custom regex stripping — fragile and impossible to maintain safely against XSS vectors.

**Configuration**:

```ts
const SANITIZE_OPTIONS = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "ol",
    "ul",
    "li",
    "sub",
    "sup",
    "span",
    "div",
    "img",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "h1",
    "h2",
    "h3",
    "h4",
    "blockquote",
    "pre",
    "code",
  ],
  allowedAttributes: {
    img: ["src", "alt", "width", "height"],
    span: ["style", "class"],
    div: ["style", "class"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
    "*": ["dir"], // RTL/LTR support for Arabic content
  },
  allowedSchemes: ["https", "data"],
  disallowedTagsMode: "discard",
};
```

Sanitization will be implemented as a pure utility function in
`packages/domain-core/src/mcq-questions/sanitize.ts` and invoked in the service layer
before any DB write.

---

## R-002: Optimistic Concurrency Control Pattern

**Decision**: Use `updated_at` timestamp comparison in the UPDATE WHERE clause.

**Rationale**: The spec mandates optimistic concurrency via `updated_at`. This is the standard
pattern already in use across the Zidney codebase (e.g., basket updates). The client sends
`updatedAt` in the PATCH body; the service layer includes
`WHERE id = $1 AND updated_at = $2` in the UPDATE statement. If `rowCount === 0` and the
entity exists, a 409 `CONCURRENT_UPDATE_CONFLICT` is returned.

**Implementation Pattern**:

```sql
UPDATE mcq_questions
SET content = $2, updated_at = NOW(), updated_by = $3
WHERE id = $1 AND updated_at = $4
RETURNING *
```

If `RETURNING` yields 0 rows → SELECT to confirm existence → 409 if exists (stale), 404 if not.

**Alternatives Considered**:

- Version number column — adds complexity without benefit over `updated_at` for this use case.
- `SELECT FOR UPDATE` — pessimistic locking; unnecessary given the low-contention nature of
  question editing.

---

## R-003: Transaction Pattern for PATCH (Full Option Replacement)

**Decision**: Use raw SQL transaction via `db.connect()` → `BEGIN` → `COMMIT`/`ROLLBACK`
pattern (same as workflow engine).

**Rationale**: The spec requires a single atomic transaction covering metadata update + full
option replacement + type-specific validation. This matches the domain-core convention
established by the workflow engine and baskets module. The transaction sequence:

1. `BEGIN`
2. `UPDATE mcq_questions SET ... WHERE id = $1 AND updated_at = $2 RETURNING *`
3. If rowCount === 0 → ROLLBACK → check existence → 409 or 404
4. `DELETE FROM mcq_question_options WHERE question_id = $1`
5. `INSERT INTO mcq_question_options (...) VALUES ...` for each option
6. Validate type-specific option rules on the new option set
7. If validation fails → ROLLBACK → 422
8. `COMMIT`

**Alternatives Considered**:

- Drizzle ORM `db.transaction()` — while Drizzle supports transactions, the codebase convention
  for domain-core packages uses raw `pg.Pool`/`PoolClient` with parameterized SQL for
  transactional operations. This maintains consistency with the workflow engine pattern.

---

## R-004: Deletion Guard — Reference Check Tables

**Decision**: Check three reference tables for exam references before allowing hard delete.

**Rationale**: The spec requires a deletion guard that blocks deletion for questions referenced
in active attempts, exam configurations, or scheduled exams. Since these tables don't yet exist
(they're in future stages), the deletion guard will be designed with a pluggable/extensible
check pattern using a dependency registry (same pattern as baskets).

**Reference Check Sequence** (when exam tables exist):

1. Check `attempt_questions` (or snapshot table) — if active attempt references exist → 409 block all deletion
2. Check `exam_config_questions` — if exam config references exist → soft delete only
3. Check `scheduled_exam_questions` — if scheduled exam references exist → soft delete only
4. If no references + status = DRAFT → hard delete allowed
5. All other cases → soft delete

**Current Stage Implementation**: Since exam configuration tables don't exist yet, the deletion
guard will implement a dependency registry pattern where reference checks can be registered
by future stages. For now, the guard defaults to:

- DRAFT with no registered references → hard delete
- All other statuses → soft delete

---

## R-005: Academic Boundary Enforcement Pattern

**Decision**: Validate hierarchical consistency via targeted SELECT queries within the
create/update transaction.

**Rationale**: The spec requires:

- `subject_id` must reference an existing subject in the tenant
- `division_id` (when set) must belong to the workspace scope
- `lesson_id` (when set) must belong to the same subject as the question

These checks use targeted SELECT queries:

```sql
-- Subject existence
SELECT id FROM subjects WHERE id = $1 AND deleted_at IS NULL

-- Lesson-subject consistency
SELECT id FROM lessons WHERE id = $1 AND subject_id = $2

-- Division scope (division belongs to workspace)
SELECT id FROM divisions WHERE id = $1
```

These are lightweight indexed lookups executed within the creation/update transaction.

**Alternatives Considered**:

- FK constraints alone — insufficient for hierarchical cross-table validation (lesson→subject
  matching requires application logic).
- Stored procedures — violates the domain-in-code convention.

---

## R-006: Soft Delete Implementation

**Decision**: Use a `deleted_at` TIMESTAMPTZ column on `mcq_questions`.

**Rationale**: The spec describes soft delete as "sets the question status to a terminal
deleted state." Looking at the existing codebase pattern (subjects use `deleted_at`), the
most consistent approach is adding a `deleted_at` column. Soft-deleted questions have
`deleted_at IS NOT NULL` and are excluded from all list queries via
`WHERE deleted_at IS NULL`.

This is preferred over a status-based approach because:

1. It's consistent with the existing subjects pattern
2. It preserves the workflow status for audit purposes
3. It cleanly separates "active lifecycle status" from "existence status"

**Implementation**:

- Add `deleted_at TIMESTAMPTZ` column (nullable, default NULL)
- All list queries add `WHERE deleted_at IS NULL`
- Soft delete: `UPDATE mcq_questions SET deleted_at = NOW() WHERE id = $1`
- Hard delete: `DELETE FROM mcq_questions WHERE id = $1` (cascades handle options/links)

---

## R-007: Classification Filter Performance (Subquery vs JOIN)

**Decision**: Use EXISTS subqueries for classification filters.

**Rationale**: The spec specifies subquery-based classification filters. EXISTS subqueries
are optimal here because:

1. Each classification filter is optional and independently applied
2. EXISTS short-circuits on first match (no duplicate rows from multi-join)
3. The join table indexes (`idx_mcq_question_categories_category_value_id`, etc.)
   ensure indexed lookups in the subquery

**Pattern**:

```sql
SELECT q.* FROM mcq_questions q
WHERE q.deleted_at IS NULL
  AND ($1::uuid IS NULL OR q.subject_id = $1)
  AND ($2::uuid IS NULL OR EXISTS (
    SELECT 1 FROM mcq_question_categories c
    WHERE c.question_id = q.id AND c.category_value_id = $2
  ))
  ...
ORDER BY q.created_at DESC
LIMIT $n OFFSET $m
```

---

## R-008: Basket Max Questions Enforcement

**Decision**: Use a COUNT + SELECT within the link transaction.

**Rationale**: When linking a question to a basket, the spec requires checking that the basket's
`max_questions` limit is not exceeded. This follows the same pattern used in the baskets module's
`linkQuestion` function:

```sql
SELECT max_questions FROM mcq_baskets WHERE id = $1
SELECT COUNT(*) FROM mcq_question_baskets WHERE basket_id = $1
```

If `max_questions IS NOT NULL AND count >= max_questions` → 422.

---

## R-009: Migration Naming Convention

**Decision**: Next migration file: `20260330_012_mcq_questions.ts`

**Rationale**: The latest tenant migration is `20260323_011_mcq_baskets.ts`. Following the
established convention: `{YYYYMMDD}_{sequence}_{description}.ts`.

The migration will:

1. Create `mcq_questions` table with all columns, CHECK constraints, and indexes
2. Create `mcq_question_options` table with FK, UNIQUE, and indexes
3. Create `mcq_question_categories` join table
4. Create `mcq_question_tags` join table
5. Create `mcq_question_baskets` join table
6. Bump `schema_version`

All tables created with `CREATE TABLE IF NOT EXISTS` for idempotency.

---

## R-010: Workflow Engine Entity Type Registration

**Decision**: `mcq_question` is already registered in the workflow engine's `ENTITY_TABLE_MAP`.

**Rationale**: Examining the workflow engine source
(`packages/domain-core/src/workflow/workflow.engine.ts`), the `ENTITY_TABLE_MAP` already
contains `mcq_question: 'mcq_questions'`. This means STAGE_34 does NOT need to modify the
workflow engine — it's already configured for MCQ questions.

The `mcq_questions` table needs `status`, `status_updated_at`, and `status_updated_by` columns
(consistent with the spec), which the workflow engine expects on any entity it manages.

**Workflow transition endpoint**: The shared workflow endpoint at
`POST /api/backoffice/:workspaceSlug/workflow/:entityType/:entityId/transition` already
handles `mcq_question` entity type. STAGE_34 may optionally add a convenience alias route at
`POST /workspace/:slug/mcq-questions/:questionId/workflow/transition` that delegates to the
same workflow engine.

---

## R-011: ENABLED Transition Guard

**Decision**: Implement a pre-transition guard hook that validates option requirements.

**Rationale**: The spec requires that the `APPROVED → ENABLED` transition validates type-specific
option rules. The workflow engine supports entity-specific guard checks. The guard function
will be registered as a pre-transition validator:

```ts
async function enabledTransitionGuard(db: DbClient, entityId: string): Promise<void> {
  // 1. Fetch question type
  // 2. Fetch option count and correct count
  // 3. Validate against type-specific rules
  // 4. Throw INVALID_OPTION_CONFIGURATION or QUESTION_HAS_NO_OPTIONS if invalid
}
```

This guard is invoked ONLY for `target_state = ENABLED` transitions.
