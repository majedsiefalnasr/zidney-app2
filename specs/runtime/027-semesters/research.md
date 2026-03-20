# Research: Semesters (STAGE_27)

**Phase:** 03_BACKOFFICE_CORE / 02_ACADEMIC_STRUCTURE  
**Researcher:** Zidney Orchestrator  
**Date:** 2026-03-20

---

## 1. Migration Pattern Research

### Reference File

`apps/api/src/db/tenant/migrations/20260319_004_teams.ts`

### Findings

```
export const description = '...'
export async function up(client: PoolClient) {
  await client.query('BEGIN')
  try {
    // DDL steps
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
}
```

Key observations:

- All DDL inside a single `BEGIN/COMMIT` block (no nested transactions)
- `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` for idempotency
- Schema version bump performed as final step
- Teams migration bumped: `1.9.0 → 1.10.0`
- **Conclusion: Semesters migration must bump `1.10.0 → 1.11.0`**
- **File naming: `20260320_005_semesters.ts`** (confirmed next sequence)

---

## 2. Drizzle Schema Pattern Research

### Reference Files

- `apps/api/src/db/tenant/schemas/teams.schema.ts`
- `apps/api/src/db/tenant/schemas/students.schema.ts`

### Findings

- `pgTable('table_name', { columns }, (table) => ({ indexes }))` pattern
- Status columns use `varchar` with CHECK constraint (not pgEnum) — enforced in migration DDL
- Partial functional unique index (`LOWER(name) WHERE deleted_at IS NULL`) is NOT declarable in
  Drizzle schema — owned exclusively by the migration file
- `deleted_at TIMESTAMPTZ` for soft delete — `timestamp('deleted_at', { withTimezone: true })`
- FK references: `.references(() => otherTable.id, { onDelete: 'restrict' })` pattern
- `students.schema.ts` currently has `division_id`, `department_id`, `group_id` FKs  
  **No `semester_id` column present** — will be added by STAGE_27 migration + schema file

---

## 3. Route Handler Pattern Research

### Reference Files

- `apps/api/src/routes/backoffice/teams/helpers.ts`
- `apps/api/src/routes/backoffice/teams/list-teams.ts`
- `apps/api/src/routes/backoffice/teams/delete-team.ts`
- `apps/api/src/routes/backoffice/teams/index.ts`

### Findings

#### helpers.ts

```typescript
export function getDb(c: Context<BackofficeEnv>): DbClient {
  return c.get("tenant").pool;
}
export function buildAuditCtx(c: Context<BackofficeEnv>): AuditContext {
  const user = c.get("user");
  const workspace = c.get("workspace");
  return {
    user_id: user.id,
    correlation_id: c.get("requestId"),
    workspace_slug: workspace.slug,
    workspace_id: workspace.id,
  };
}
export function successResponse<T>(data: T) {
  return { success: true, data, error: null };
}
export function teamsErrorResponse(c, err) {
  if (err instanceof TeamsError) {
    return c.json(
      { success: false, data: null, error: { code: err.code, message: err.message } },
      err.httpStatus,
    );
  }
  // ZodError → 422; unknown → 500
}
```

#### list handler

```typescript
const input = await listTeamsQuerySchema.parseAsync(c.req.query());
const result = await listTeams(db, input);
return c.json(successResponse(result), 200);
```

#### delete handler

```typescript
const { id } = await teamsParamsSchema.parseAsync(c.req.param());
await deleteTeam(db, id, audit);
return c.json(successResponse({ deleted: true }), 200);
```

#### index.ts (router factory)

```typescript
export function createTeamsRouter() {
  const router = new Hono<BackofficeEnv>();
  router.get("/team-types", listTeamTypesHandler);
  router.post("/team-types", createTeamTypeHandler);
  // ...
  return router;
}
export const teamsRouter = createTeamsRouter();
```

---

## 4. Domain Service Pattern Research

### Reference File

`packages/domain-core/src/teams/teams.service.ts`

### Findings (Transaction Pattern)

```typescript
export async function createTeamType(
  db: DbClient,
  input: { name: string },
  audit: AuditContext,
): Promise<TeamTypeRow> {
  await db.query("BEGIN");
  try {
    // business logic + repository calls
    await db.query("COMMIT");
    return result;
  } catch (err) {
    await db.query("ROLLBACK");
    throw err;
  }
}
```

- Domain service calls `db.query('BEGIN')` directly — never creates a DB connection
- `DbClient` is a structural interface (not imported from `pg`) with `query(text, values?)` method
- Read operations (list, getById) have no transaction
- `SELECT ... FOR UPDATE` row lock used in delete operation before any mutation

---

## 5. Domain Types Pattern Research

### Reference File

`packages/domain-core/src/teams/teams.types.ts`

### Findings

```typescript
export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
}
export interface AuditContext {
  user_id: string;
  correlation_id: string;
  workspace_slug: string;
  workspace_id: string;
}
export enum TeamStatus {
  ENABLED = "ENABLED",
  DISABLED = "DISABLED",
}
```

- `DbClient` is structural — no `pg` import in the domain package
- `AuditContext` fields: `user_id`, `correlation_id`, `workspace_slug`, `workspace_id`
- Status enum values: `'ENABLED'` and `'DISABLED'`

---

## 6. Error Handling Pattern Research

### Reference File

`packages/domain-core/src/teams/teams.errors.ts`

### Findings

```typescript
export type TeamsErrorCode =
  | 'TEAM_NOT_FOUND'
  | 'TEAM_NAME_DUPLICATE'
  // ...

export const TEAMS_ERROR_HTTP_STATUS: Record<TeamsErrorCode, number> = {
  TEAM_NOT_FOUND: 404,
  TEAM_NAME_DUPLICATE: 409,
  // ...
}
export const TEAMS_ERROR_MESSAGES: Record<TeamsErrorCode, string> = { ... }
export class TeamsError extends Error {
  constructor(public readonly code: TeamsErrorCode, message?: string) {
    super(message ?? TEAMS_ERROR_MESSAGES[code])
    this.name = 'TeamsError'
  }
  get httpStatus(): number { return TEAMS_ERROR_HTTP_STATUS[this.code] }
}
```

Pattern copied verbatim for `SemestersError` with `SemestersErrorCode`.

---

## 7. Validation Schema Pattern Research

### Reference File

`packages/validation/src/backoffice/teams.schemas.ts`

### Findings

```typescript
export const listTeamsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
  status: z.enum(["ENABLED", "DISABLED"]).optional(),
  search: z.string().trim().optional(),
});
export const updateTeamBodySchema = z
  .object({
    name: z.string().trim().min(1).max(255).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
  })
  .refine((d) => Object.keys(d).some((k) => d[k as keyof typeof d] !== undefined), {
    message: "At least one field must be provided",
    path: ["_body"],
  });
```

Key findings:

- `limit` uses `.pipe()` for transform + validation chain — not `.transform()` alone
- `refine` on update schemas to enforce at least one field
- Date fields use `z.string().regex()` — cross-field ordering validated in service layer

---

## 8. Domain-Core Package Exports Research

### Reference File

`packages/domain-core/package.json`

### Finding — MISSING `"./teams"` EXPORT

Discovered that `"./teams"` is **absent** from the `exports` map in `package.json`.

Current exports include: `"./departments"`, `"./divisions"`, `"./groups"`, `"./hierarchy"`, but NOT `"./teams"`.

This means any `import from '@zidney/domain-core/teams'` in route handlers may currently resolve
via a different mechanism (TypeScript path aliases or workspace package source resolution) but the
export map is incomplete.

**Action Required:** STAGE_27 MUST add both:

- `"./teams": "./src/teams/index.ts"` (fix STAGE_26 omission)
- `"./semesters": "./src/semesters/index.ts"` (new for STAGE_27)

---

## 9. App.ts Route Registration Research

### Reference File

`apps/api/src/app.ts`

### Findings

```
import { teamsRouter } from './routes/backoffice/teams/index'    // line ~50
// ...
app.route('/api/v1/backoffice/workspace', teamsRouter)            // line ~164
```

Mount pattern is: `app.route('/api/v1/backoffice/workspace', <domainRouter>)`

The semesters router must be registered immediately after the teams router registration.

---

## 10. Test Pattern Research

### Reference File

`apps/api/src/routes/backoffice/teams/__tests__/teams.integration.test.ts`

### Findings

```typescript
vi.mock('@zidney/domain-core/teams', () => ({
  listTeams: vi.fn(),
  createTeam: vi.fn(),
  // ...
}))
vi.mock('@zidney/logger', () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn() }) }))
vi.mock('../helpers', () => ({
  getDb: vi.fn(() => ({})),
  buildAuditCtx: vi.fn(() => ({})),
  successResponse: vi.fn(data => ({ success: true, data, error: null })),
  teamsErrorResponse: vi.fn(...),
}))

describe('Teams Handlers', () => {
  describe('GET /team-types', () => {
    it('returns 200 with team types list', async () => {
      vi.mocked(listTeamTypes).mockResolvedValue([...])
      const res = await listTeamTypesHandler(mockContext())
      expect(res.status).toBe(200)
    })
  })
})
```

Integration tests mock:

1. Domain service module (resolved as `@zidney/domain-core/teams`)
2. `@zidney/logger`
3. Route handler's own `./helpers` module
4. Each test instantiates a mock Hono `Context` with `getBodyOrQuery` as needed

---

## 11. Pagination Pattern Decision

### Context

The spec for STAGE_27 explicitly uses `page` and `limit` in both query parameters and response body
(`{ items, total, page, limit }`). This differs from the cursor-based pagination used in some other
list endpoints.

### Decision

**Offset-based pagination (page/limit)**.

- SQL: `OFFSET (page - 1) * limit LIMIT limit`
- Default: `page=1`, `limit=20`, `max limit=100`
- `total` is always returned via a separate `SELECT COUNT(*)` query with the same filters

### Rationale

Semesters are a bounded, stable set (typically ≤ 20–50 per workspace). Administrators need
random-access pagination (e.g., jump to page 3). Cursor-based pagination is optimized for
sequential/infinite scroll, which is inappropriate for this admin list use case.

---

## 12. Subjects FK Deferral Rationale

The `subjects` table does not exist until STAGE_28. STAGE_27 explicitly excludes:

- Any CREATE TABLE for subjects
- Any `semester_id` column on a subjects table
- Any reference check against subjects in `deleteSemester`

The `SEMESTER_HAS_SUBJECTS` error code is declared in the error map for future use but the delete
service function in STAGE_27 does NOT guard on subjects. A comment in `deleteSemester` is
sufficient:

```typescript
// subjects guard — wired in STAGE_28 when subjects table is added
```

When STAGE_28 introduces the subjects table with `semester_id FK`, the service function must be
updated to call `countSubjectsForSemester(db, id)` before soft-delete.

---

_Research complete. Plan.md generated. Proceeding to Step 3 completion._
