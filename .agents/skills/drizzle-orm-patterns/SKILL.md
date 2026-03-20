---
name: drizzle-orm-patterns
description: Drizzle ORM schema definition, query patterns, and tenant-scoped repository patterns for Zidney
metadata:
  category: database
  scope: backend
  capabilities:
    - schema definition patterns
    - query patterns
    - migration file format
    - tenant-scoped repository patterns
    - type inference
---

# Drizzle ORM Patterns Skill

Zidney uses **Drizzle ORM** with PostgreSQL for all database operations. This skill defines authoritative patterns for schema definitions, queries, and repository design.

---

## Schema File Location

```
apps/api/src/db/master/schema/    ← Master DB schema (platform-level tables)
apps/api/src/db/tenant/schema/    ← Tenant DB schema (tenant-level tables)
```

AI must never define schemas outside these directories.

---

## Schema Definition Pattern

```typescript
import { pgTable, uuid, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

export const exams = pgTable('exams', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  is_active: boolean('is_active').notNull().default(true),
  duration_minutes: integer('duration_minutes').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

Rules:
- Use `uuid` for all primary keys with `defaultRandom()`
- Use `timestamp` with `{ withTimezone: true }` always
- Include `created_at` and `updated_at` on all tables
- Use `text()` for strings (not `varchar` unless there's a specific constraint)
- Use `notNull()` explicitly — never rely on database defaults for nullability

---

## Type Inference

```typescript
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export type Exam = InferSelectModel<typeof exams>;
export type NewExam = InferInsertModel<typeof exams>;
```

Export both select and insert types from every schema file.

---

## Query Patterns

### Select with conditions

```typescript
const result = await db
  .select()
  .from(exams)
  .where(and(
    eq(exams.is_active, true),
    eq(exams.workspace_id, tenantContext.workspaceId),
  ));
```

### Insert

```typescript
const [created] = await db
  .insert(exams)
  .values({ title: 'New Exam', duration_minutes: 60 })
  .returning();
```

### Update

```typescript
const [updated] = await db
  .update(exams)
  .set({ title: 'Updated Title', updated_at: new Date() })
  .where(eq(exams.id, examId))
  .returning();
```

### Always use `.returning()` for insert/update operations.

---

## Tenant-Scoped Repository Pattern

```typescript
export function createExamRepository(db: TenantDb) {
  return {
    async findById(id: string): Promise<Exam | null> {
      const [exam] = await db
        .select()
        .from(exams)
        .where(eq(exams.id, id))
        .limit(1);
      return exam ?? null;
    },
    
    async create(data: NewExam): Promise<Exam> {
      const [created] = await db
        .insert(exams)
        .values(data)
        .returning();
      return created;
    },
  };
}
```

Rules:
- Repository receives `db` (tenant-scoped connection) as parameter
- Repository NEVER resolves tenant context — it's passed in
- Repository functions are pure data access — no business logic
- Repository NEVER performs cross-tenant queries

---

## Relation Definitions

```typescript
import { relations } from 'drizzle-orm';

export const examsRelations = relations(exams, ({ many }) => ({
  questions: many(questions),
  attempts: many(attempts),
}));
```

Define relations alongside schema tables for type-safe joins.

---

## Forbidden Patterns

- **No raw SQL** unless absolutely necessary (use `sql` template tag when required)
- **No cross-tenant joins** — each tenant has its own database
- **No `SELECT *`** — explicitly select needed columns for performance
- **No schema definitions in `packages/`** — schemas live in `apps/api/src/db/`
- **No Drizzle client instantiation outside tenant resolver** — use the pooled connection

---

## Migration Generation

```bash
bun drizzle-kit generate          # Generate migration from schema diff
bun drizzle-kit generate --name=add-exam-field   # Named migration
```

Always review generated SQL before committing. See `db-migration-governance` skill for migration safety rules.

---

## Verdict Protocol

```
VERDICT: PASS   — schema and queries follow Drizzle patterns
VERDICT: BLOCKED — forbidden pattern detected (specify which)
```
