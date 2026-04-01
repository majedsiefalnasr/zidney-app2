# Research — MCQ Exam Configuration

**Stage:** STAGE_36_MCQ_EXAM_CONFIG
**Phase:** 03_BACKOFFICE_CORE / 04_EXAM_ENGINE_CORE
**Created:** 2026-04-01

---

## 1. Existing Domain Entity Pattern (Reference: MCQ Questions)

All domain entities follow the same layered structure under `packages/domain-core/src/<entity>/`:

| File                              | Responsibility                                     |
| --------------------------------- | -------------------------------------------------- |
| `<entity>.types.ts`               | DbClient, AuditContext, domain enums, input/output |
| `<entity>.errors.ts`              | Error codes, HTTP status map, error class          |
| `<entity>.repository.ts`          | Pure SQL functions, no TX management               |
| `<entity>.service.ts`             | Business logic orchestrator, TX management         |
| `<entity>.validators.ts`          | Domain-level validation (not Zod — business rules) |
| `<entity>.dependency-registry.ts` | Extensible deletion guard pattern                  |
| `index.ts`                        | Public API barrel                                  |

**Key observations from MCQ Questions:**

- `DbClient` interface: `query<T>(text, values) → { rows, rowCount }` + optional `connect()` for TX
- `AuditContext`: `user_id`, `correlation_id`, `workspace_slug`, `workspace_id`, `caller_permissions`
- Service layer acquires `PoolClient` via `db.connect()`, manages `BEGIN/COMMIT/ROLLBACK`
- Repository functions are stateless — receive `db` as parameter, return typed rows
- Error class extends `Error` with a `code` property; HTTP mapping is a separate constant
- Dependency registry uses a push-based checker array for extensible deletion guards

## 2. API Route Pattern (Reference: MCQ Questions)

Routes are organized under `apps/api/src/routes/backoffice/<entity>/`:

| File                 | Responsibility                                                   |
| -------------------- | ---------------------------------------------------------------- |
| `index.ts`           | Hono router with permission guards per endpoint                  |
| `create-<entity>.ts` | POST handler — parse body, call service, return 201              |
| `list-<entity>s.ts`  | GET handler — parse query, call service, return paginated        |
| `get-<entity>.ts`    | GET handler — parse param, call service, return detail           |
| `update-<entity>.ts` | PATCH handler — parse body + param, call service                 |
| `delete-<entity>.ts` | DELETE handler — parse param, call service, return 204           |
| `helpers.ts`         | `getDb()`, `buildAuditCtx()`, `successResponse()`, error handler |

**Permission guard pattern:**

```typescript
const readGuard = requireAnyPermission(["exam_manage", "content_manage", "content_read"]);
const writeGuard = requireAnyPermission(["exam_manage", "content_manage"]);
const transitionGuard = requireAnyPermission(["exam_manage", "content_manage", "content_review"]);
```

**Handler pattern:**

```typescript
export async function createHandler(c: Context): Promise<Response> {
  try {
    const body = await c.req.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return errorResponse(c, parsed.error);
    const db = getDb(c);
    const audit = buildAuditCtx(c);
    const result = await serviceFunction(db, input, audit);
    return c.json(successResponse(result), 201);
  } catch (err) {
    return errorResponse(c, err);
  }
}
```

## 3. Drizzle Schema Pattern (Reference: MCQ Questions)

Schemas under `apps/api/src/db/tenant/schemas/<entity>.schema.ts`:

- Import from `drizzle-orm/pg-core`
- Use `pgTable` with column definitions
- Constraints via `check()`, `index()`, and `references(() => ...)` for FK
- Export inferred select/insert types
- Registered in `apps/api/src/db/tenant/schemas/index.ts` barrel export

**Note on partial unique indexes:** Drizzle cannot express `UNIQUE WHERE deleted_at IS NULL` —
these must be created in the migration SQL, not in the schema definition.

## 4. Migration Pattern (Reference: Migration 012)

Two-phase migrations:

- **Phase 1 (inside `BEGIN/COMMIT`):** DDL, FK constraints, B-tree indexes, schema version bump
- **Phase 2 (outside transaction):** `CONCURRENT` unique indexes (cannot run inside TX)

Migration file naming: `YYYYMMDD_NNN_<description>.ts`
Next migration: `20260401_014_mcq_exams.ts` (schema 1.19.0 → 1.20.0)

Each migration exports:

- `description: string` — human-readable description
- `up(client: PoolClient): Promise<void>` — forward migration
- `down(client: PoolClient): Promise<void>` — rollback

## 5. Validation Schema Pattern (Zod)

Zod schemas under `packages/validation/src/backoffice/<entity>.schemas.ts`:

- Path param schemas: `z.object({ id: z.string().uuid() })`
- Query schemas with `.transform()` for string→number conversion
- Body schemas with full field validation
- Exported from `packages/validation/src/backoffice/index.ts`

## 6. Workflow Engine Integration

**Entity registration:** Add `mcq_exam: 'mcq_exams'` to `ENTITY_TABLE_MAP` in
`packages/domain-core/src/workflow/workflow.engine.ts`.

**Entity type set:** Add `'mcq_exam'` to `WORKFLOW_ENTITY_TYPES` Set in
`packages/domain-core/src/workflow/workflow.states.ts`.

**Transition call pattern:**

```typescript
import { executeTransition } from "../workflow/workflow.engine";
import { WorkflowState } from "../workflow/workflow.states";

const result = await executeTransition(db, {
  entityType: "mcq_exam",
  entityId: examId,
  targetState: WorkflowState.UNDER_REVIEW,
  actorId: audit.user_id,
  permissions: audit.caller_permissions ?? [],
  reason: input.reason,
  correlationId: audit.correlation_id,
  workspaceSlug: audit.workspace_slug,
  workspaceId: audit.workspace_id,
});
```

**Pre-enable validation:** Must be implemented in the MCQ exam service layer before
calling `executeTransition()` when target state is `ENABLED`.

## 7. Array Column Pattern (uuid[])

PostgreSQL native `uuid[]` arrays for `mcq_exam_auto_criteria`:

- Drizzle column definition: custom SQL type or `text('col').array()` pattern
- Application-level validation: each UUID in the array is checked against referenced tables
- No FK constraint at DB level — enforced in service layer during criteria save
- GIN index can be added later if runtime selection needs array containment queries

## 8. Backoffice Router Registration

All backoffice entity routers are registered in the backoffice route index. The MCQ exams
router must be added to:
`apps/api/src/routes/backoffice/index.ts`
