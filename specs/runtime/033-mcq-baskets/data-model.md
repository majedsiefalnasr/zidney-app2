# Data Model: MCQ Baskets (Stage 033)

**Stage**: `STAGE_33_MCQ_BASKETS`
**Generated**: 2026-03-23
**Schema Version**: `1.16.0 → 1.17.0`

---

## 1. Entity Relationship Diagram

```
mcq_baskets
  ├── id (PK)
  ├── name
  ├── code (UNIQUE per tenant)
  ├── type: LINKED | UNLINKED
  ├── max_questions (nullable)
  ├── description (nullable)
  ├── status: DRAFT | COMPLETED | UNDER_REVIEW | APPROVED | ENABLED
  ├── status_updated_at
  ├── status_updated_by → users.id (SET NULL)
  ├── created_at
  ├── updated_at
  ├── created_by → users.id (SET NULL)
  └── updated_by → users.id (SET NULL)

mcq_basket_questions
  ├── id (PK)
  ├── basket_id → mcq_baskets.id (CASCADE)
  ├── question_id → mcq_questions.id (CASCADE)
  └── created_at

UNIQUE: (basket_id, question_id)
```

---

## 2. Drizzle Schema: `apps/api/src/db/tenant/schemas/baskets.schema.ts`

```ts
/**
 * Drizzle ORM Schema — mcq_baskets
 *
 * File: apps/api/src/db/tenant/schemas/baskets.schema.ts
 * Stage: STAGE_33_MCQ_BASKETS
 *
 * NOTE: UNIQUE constraint (unique_mcq_basket_code) and FK constraints
 * (created_by, updated_by, status_updated_by → users.id) are migration-owned.
 * Drizzle cannot represent CONCURRENT partial indexes.
 */

import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const mcqBaskets = pgTable(
  "mcq_baskets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 255 }).notNull(),
    code: varchar("code", { length: 100 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    max_questions: integer("max_questions"), // nullable — no cap when null
    description: text("description"), // nullable
    status: varchar("status", { length: 30 }).notNull().default("DRAFT"),
    status_updated_at: timestamp("status_updated_at", { withTimezone: true }),
    status_updated_by: uuid("status_updated_by"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    created_by: uuid("created_by"),
    updated_by: uuid("updated_by"),
  },
  (table) => ({
    typeCheck: check("mcq_baskets_type_check", `${table.type.name} IN ('LINKED', 'UNLINKED')`),
    statusCheck: check(
      "mcq_baskets_status_check",
      `${table.status.name} IN ('DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')`,
    ),
    maxQuestionsCheck: check(
      "mcq_baskets_max_questions_check",
      `${table.max_questions.name} IS NULL OR ${table.max_questions.name} > 0`,
    ),
    typeIdx: index("idx_mcq_baskets_type").on(table.type),
    statusIdx: index("idx_mcq_baskets_status").on(table.status),
    // unique_mcq_basket_code: migration-owned CONCURRENT UNIQUE index
    // FK constraints (created_by, updated_by, status_updated_by → users.id): migration-owned
  }),
);

export type McqBasket = typeof mcqBaskets.$inferSelect;
export type NewMcqBasket = typeof mcqBaskets.$inferInsert;
```

---

## 3. Drizzle Schema: `apps/api/src/db/tenant/schemas/basket-questions.schema.ts`

```ts
/**
 * Drizzle ORM Schema — mcq_basket_questions
 *
 * File: apps/api/src/db/tenant/schemas/basket-questions.schema.ts
 * Stage: STAGE_33_MCQ_BASKETS
 *
 * NOTE: UNIQUE constraint (unique_mcq_basket_question) and FK constraints
 * (basket_id → mcq_baskets.id CASCADE, question_id → mcq_questions.id CASCADE)
 * are migration-owned. Drizzle represents only B-tree indexes here.
 */

import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";

export const mcqBasketQuestions = pgTable(
  "mcq_basket_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    basket_id: uuid("basket_id").notNull(),
    question_id: uuid("question_id").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    basketIdIdx: index("idx_mcq_basket_questions_basket_id").on(table.basket_id),
    questionIdIdx: index("idx_mcq_basket_questions_question_id").on(table.question_id),
    // unique_mcq_basket_question: migration-owned CONCURRENT UNIQUE index (basket_id, question_id)
    // FK: basket_id → mcq_baskets.id ON DELETE CASCADE — migration-owned
    // FK: question_id → mcq_questions.id ON DELETE CASCADE — migration-owned
  }),
);

export type McqBasketQuestion = typeof mcqBasketQuestions.$inferSelect;
export type NewMcqBasketQuestion = typeof mcqBasketQuestions.$inferInsert;
```

---

## 4. Migration: `apps/api/src/db/tenant/migrations/20260323_011_mcq_baskets.ts`

```ts
/**
 * Migration 011 — MCQ Baskets
 *
 * File: apps/api/src/db/tenant/migrations/20260323_011_mcq_baskets.ts
 * Stage: STAGE_33_MCQ_BASKETS
 * Schema: 1.16.0 → 1.17.0
 *
 * Two-phase approach (CONCURRENT index requirement):
 *   Phase 1 (inside BEGIN/COMMIT):
 *     - CREATE mcq_baskets table
 *     - CREATE mcq_basket_questions table
 *     - FK constraints (all migration-owned)
 *     - B-tree indexes
 *     - Schema version bump
 *   Phase 2 (outside transaction):
 *     - CONCURRENT unique indexes (cannot run inside a transaction block)
 *
 * Notes:
 * - mcq_questions.id FK is conditional: safe if table exists (created in 004-create-core)
 * - old v1.0.0 baseline may have created mcq_baskets with a different schema;
 *   CREATE TABLE IF NOT EXISTS guards against this in environments running both chains
 * - status_updated_at / status_updated_by are required by the workflow engine's
 *   SELECT ... FOR UPDATE query pattern
 *
 * Constitutional Compliance:
 * ✓ Forward-only: down() throws per ADR-0008
 * ✓ All DDL inside single BEGIN/COMMIT transaction (phase 1)
 * ✓ CONCURRENT indexes outside transaction (phase 2)
 * ✓ Server-authoritative timestamps via NOW()
 * ✓ No cross-tenant access — tenant DB only
 */

import type { PoolClient } from 'pg'

export const description =
  'Create mcq_baskets and mcq_basket_questions tables with FK constraints, B-tree indexes, ' +
  'and CONCURRENT unique indexes. Bump schema version to 1.17.0.'

// ---------------------------------------------------------------------------
// Migration Up
// ---------------------------------------------------------------------------

export async function up(client: PoolClient): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: DDL + FK constraints + B-tree indexes (inside transaction)
  // ─────────────────────────────────────────────────────────────────────────
  await client.query('BEGIN')
  try {
    // ── Table: mcq_baskets ─────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_baskets (
        id                UUID         NOT NULL DEFAULT gen_random_uuid(),
        name              VARCHAR(255) NOT NULL,
        code              VARCHAR(100) NOT NULL,
        type              VARCHAR(20)  NOT NULL
                            CONSTRAINT mcq_baskets_type_check
                              CHECK (type IN ('LINKED', 'UNLINKED')),
        max_questions     INTEGER
                            CONSTRAINT mcq_baskets_max_questions_check
                              CHECK (max_questions IS NULL OR max_questions > 0),
        description       TEXT,
        status            VARCHAR(30)  NOT NULL DEFAULT 'DRAFT'
                            CONSTRAINT mcq_baskets_status_check
                              CHECK (status IN ('DRAFT', 'COMPLETED', 'UNDER_REVIEW', 'APPROVED', 'ENABLED')),
        status_updated_at TIMESTAMPTZ,
        status_updated_by UUID,
        created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        created_by        UUID,
        updated_by        UUID,
        CONSTRAINT mcq_baskets_pkey PRIMARY KEY (id)
      )
    `)

    // ── Table: mcq_basket_questions ────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS mcq_basket_questions (
        id          UUID        NOT NULL DEFAULT gen_random_uuid(),
        basket_id   UUID        NOT NULL,
        question_id UUID        NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT mcq_basket_questions_pkey PRIMARY KEY (id)
      )
    `)

    // ── FK: mcq_baskets.created_by → users.id (SET NULL) ──────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_baskets_created_by_fkey'
            AND table_name = 'mcq_baskets'
        ) THEN
          ALTER TABLE mcq_baskets
            ADD CONSTRAINT mcq_baskets_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: mcq_baskets.updated_by → users.id (SET NULL) ──────────────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_baskets_updated_by_fkey'
            AND table_name = 'mcq_baskets'
        ) THEN
          ALTER TABLE mcq_baskets
            ADD CONSTRAINT mcq_baskets_updated_by_fkey
            FOREIGN KEY (updated_by) REFERENCES users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: mcq_baskets.status_updated_by → users.id (SET NULL) ──────────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_baskets_status_updated_by_fkey'
            AND table_name = 'mcq_baskets'
        ) THEN
          ALTER TABLE mcq_baskets
            ADD CONSTRAINT mcq_baskets_status_updated_by_fkey
            FOREIGN KEY (status_updated_by) REFERENCES users (id) ON DELETE SET NULL;
        END IF;
      END $$
    `)

    // ── FK: mcq_basket_questions.basket_id → mcq_baskets.id (CASCADE) ─────
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'mcq_basket_questions_basket_id_fkey'
            AND table_name = 'mcq_basket_questions'
        ) THEN
          ALTER TABLE mcq_basket_questions
            ADD CONSTRAINT mcq_basket_questions_basket_id_fkey
            FOREIGN KEY (basket_id) REFERENCES mcq_baskets (id) ON DELETE CASCADE;
        END IF;
      END $$
    `)

    // ── FK: mcq_basket_questions.question_id → mcq_questions.id (CASCADE) ─
    -- Conditional: only if mcq_questions table exists in current schema.
    -- mcq_questions is created by 004-create-core-application-tables.sql;
    -- this guard is safe in all known deployment paths.
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'mcq_questions'
        ) THEN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'mcq_basket_questions_question_id_fkey'
              AND table_name = 'mcq_basket_questions'
          ) THEN
            ALTER TABLE mcq_basket_questions
              ADD CONSTRAINT mcq_basket_questions_question_id_fkey
              FOREIGN KEY (question_id) REFERENCES mcq_questions (id) ON DELETE CASCADE;
          END IF;
        END IF;
      END $$
    `)

    // ── B-tree indexes ─────────────────────────────────────────────────────

    -- Type-filtered basket list queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_baskets_type
        ON mcq_baskets (type)
    `)

    -- Status-filtered basket list queries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_baskets_status
        ON mcq_baskets (status)
    `)

    -- Basket → question lookups (primary access pattern for list questions)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_basket_questions_basket_id
        ON mcq_basket_questions (basket_id)
    `)

    -- Question → basket lookups (used by question filter subquery in selection engine)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_mcq_basket_questions_question_id
        ON mcq_basket_questions (question_id)
    `)

    // ── Schema version bump: 1.16.0 → 1.17.0 ─────────────────────────────
    await client.query(`
      UPDATE _schema_versions
      SET version = '1.17.0', updated_at = NOW()
      WHERE name = 'schema_version'
    `)

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2: CONCURRENT unique indexes — MUST run outside transaction
  // CONCURRENTLY prevents table locks on tenants with existing rows.
  // ─────────────────────────────────────────────────────────────────────────

  // Unique basket code per tenant DB (enforces FR-002 at DB layer)
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_mcq_basket_code
      ON mcq_baskets (code)
  `)

  // Prevent duplicate question entries in the same basket (enforces FR-013)
  await client.query(`
    CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS unique_mcq_basket_question
      ON mcq_basket_questions (basket_id, question_id)
  `)
}

// ---------------------------------------------------------------------------
// Migration Down — forward-only; down() is forbidden per ADR-0008
// ---------------------------------------------------------------------------

export function down(): never {
  throw new Error(
    'Migration 20260323_011_mcq_baskets is forward-only. ' +
    'Downgrade is forbidden per ADR-0008.'
  )
}
```

---

## 5. Domain Types: `packages/domain-core/src/baskets/baskets.types.ts`

```ts
/**
 * Baskets — Type Definitions
 *
 * File: packages/domain-core/src/baskets/baskets.types.ts
 * Stage: STAGE_33_MCQ_BASKETS
 *
 * Shared interfaces used by repository, service, and route helpers.
 * No imports from apps/* — pure domain types only.
 */

// -------------------------------------------------------------------------------------
// Infrastructure Interfaces
// -------------------------------------------------------------------------------------

export interface DbClient {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount: number | null }>;
  connect?(): Promise<{
    query<T extends Record<string, unknown> = Record<string, unknown>>(
      sql: string,
      params?: unknown[],
    ): Promise<{ rows: T[]; rowCount: number | null }>;
    release(): void;
  }>;
}

export interface AuditContext {
  user_id: string | null;
  correlation_id: string;
  workspace_slug: string;
  workspace_id: string;
  caller_permissions?: string[];
}

// -------------------------------------------------------------------------------------
// Domain Enums
// -------------------------------------------------------------------------------------

export type BasketType = "LINKED" | "UNLINKED";
export type BasketStatus = "DRAFT" | "COMPLETED" | "UNDER_REVIEW" | "APPROVED" | "ENABLED";

export const VALID_BASKET_TYPES: BasketType[] = ["LINKED", "UNLINKED"];
export const VALID_BASKET_STATUSES: BasketStatus[] = [
  "DRAFT",
  "COMPLETED",
  "UNDER_REVIEW",
  "APPROVED",
  "ENABLED",
];

// -------------------------------------------------------------------------------------
// Row Types (as returned from DB)
// -------------------------------------------------------------------------------------

export interface BasketRow {
  id: string;
  name: string;
  code: string;
  type: BasketType;
  max_questions: number | null;
  description: string | null;
  status: BasketStatus;
  status_updated_at: Date | null;
  status_updated_by: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
  updated_by: string | null;
}

export interface BasketWithCount extends BasketRow {
  question_count: number;
}

export interface BasketQuestionRow {
  id: string;
  basket_id: string;
  question_id: string;
  created_at: Date;
}

// -------------------------------------------------------------------------------------
// Input / Output Types
// -------------------------------------------------------------------------------------

export interface CreateBasketInput {
  name: string;
  code: string;
  type: BasketType;
  max_questions?: number | null;
  description?: string | null;
}

export interface UpdateBasketInput {
  name?: string;
  code?: string;
  max_questions?: number | null;
  description?: string | null;
}

export interface ListBasketsInput {
  page: number;
  perPage: number;
  type?: BasketType;
  status?: BasketStatus;
  search?: string;
}

export interface ListBasketsResult {
  items: BasketWithCount[];
  total: number;
  page: number;
  perPage: number;
}

export interface LinkQuestionInput {
  question_id: string;
}

export interface ListBasketQuestionsInput {
  basket_id: string;
  page: number;
  perPage: number;
}

export interface ListBasketQuestionsResult {
  items: BasketQuestionRow[];
  total: number;
  page: number;
  perPage: number;
}

export interface DeletionGuardResult {
  blocked: boolean;
  reason?: "BASKET_REFERENCED_IN_EXAM_CONFIG" | "BASKET_REFERENCED_IN_AUTO_SELECTION";
}
```

---

## 6. Domain Errors: `packages/domain-core/src/baskets/baskets.errors.ts`

```ts
/**
 * Baskets — Error Definitions
 *
 * File: packages/domain-core/src/baskets/baskets.errors.ts
 * Stage: STAGE_33_MCQ_BASKETS
 */

export type BasketErrorCode =
  | "FORBIDDEN"
  | "BASKET_NOT_FOUND"
  | "BASKET_CODE_DUPLICATE"
  | "BASKET_QUESTION_DUPLICATE"
  | "BASKET_QUESTION_NOT_FOUND"
  | "BASKET_MAX_QUESTIONS_REACHED"
  | "BASKET_EMPTY_CANNOT_ENABLE"
  | "BASKET_EXCEEDS_MAX_QUESTIONS"
  | "BASKET_REFERENCED_IN_EXAM_CONFIG"
  | "BASKET_REFERENCED_IN_AUTO_SELECTION"
  | "QUESTION_NOT_FOUND"
  | "INVALID_STATE_TRANSITION"
  | "VALIDATION_ERROR";

export const BASKET_ERROR_HTTP_STATUS: Record<BasketErrorCode, number> = {
  FORBIDDEN: 403,
  BASKET_NOT_FOUND: 404,
  QUESTION_NOT_FOUND: 404,
  BASKET_QUESTION_NOT_FOUND: 404,
  BASKET_CODE_DUPLICATE: 409,
  BASKET_QUESTION_DUPLICATE: 409,
  INVALID_STATE_TRANSITION: 400,
  BASKET_MAX_QUESTIONS_REACHED: 422,
  BASKET_EMPTY_CANNOT_ENABLE: 422,
  BASKET_EXCEEDS_MAX_QUESTIONS: 422,
  BASKET_REFERENCED_IN_EXAM_CONFIG: 422,
  BASKET_REFERENCED_IN_AUTO_SELECTION: 422,
  VALIDATION_ERROR: 422,
};

export const BASKET_ERROR_MESSAGES: Record<BasketErrorCode, string> = {
  FORBIDDEN: "You do not have permission to perform this action.",
  BASKET_NOT_FOUND: "Basket not found.",
  BASKET_CODE_DUPLICATE: "A basket with this code already exists in this workspace.",
  BASKET_QUESTION_DUPLICATE: "This question is already linked to the basket.",
  BASKET_QUESTION_NOT_FOUND: "This question is not linked to the basket.",
  BASKET_MAX_QUESTIONS_REACHED:
    "Adding this question would exceed the basket's maximum question limit.",
  BASKET_EMPTY_CANNOT_ENABLE: "Basket cannot be enabled when it contains no questions.",
  BASKET_EXCEEDS_MAX_QUESTIONS:
    "Basket cannot be enabled because it exceeds the maximum question count.",
  BASKET_REFERENCED_IN_EXAM_CONFIG:
    "Basket cannot be deleted because it is referenced in an exam configuration.",
  BASKET_REFERENCED_IN_AUTO_SELECTION:
    "Basket cannot be deleted because it is referenced in an auto-selection rule.",
  QUESTION_NOT_FOUND: "The specified question does not exist in this workspace.",
  INVALID_STATE_TRANSITION: "The requested workflow transition is not valid.",
  VALIDATION_ERROR: "Request validation failed.",
};

export class BasketError extends Error {
  readonly code: BasketErrorCode;

  constructor(code: BasketErrorCode, message?: string) {
    super(message ?? BASKET_ERROR_MESSAGES[code]);
    this.name = "BasketError";
    this.code = code;
  }
}
```

---

## 7. Validation Schemas: `packages/validation/src/backoffice/baskets.schemas.ts`

```ts
/**
 * Baskets Validation Schemas
 *
 * File: packages/validation/src/backoffice/baskets.schemas.ts
 * Stage: STAGE_33_MCQ_BASKETS
 */

import { z } from "zod";

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

const basketTypeSchema = z.enum(["LINKED", "UNLINKED"]);
const basketStatusSchema = z.enum(["DRAFT", "COMPLETED", "UNDER_REVIEW", "APPROVED", "ENABLED"]);

// ── Path Params ──────────────────────────────────────────────────────────────

export const basketIdParamSchema = z.object({
  basketId: z.string().uuid("basketId must be a valid UUID"),
});

export const basketQuestionParamSchema = z.object({
  basketId: z.string().uuid("basketId must be a valid UUID"),
  questionId: z.string().uuid("questionId must be a valid UUID"),
});

// ── List Baskets Query ───────────────────────────────────────────────────────

export const listBasketsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_PAGE))
    .pipe(z.number().int().min(1)),
  per_page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_PER_PAGE))
    .pipe(z.number().int().min(1).max(MAX_PER_PAGE)),
  type: basketTypeSchema.optional(),
  status: basketStatusSchema.optional(),
  search: z.string().max(255).optional(),
});

// ── Create Basket Body ───────────────────────────────────────────────────────

export const createBasketBodySchema = z.object({
  name: z.string().min(1, "name is required").max(255),
  code: z.string().min(1, "code is required").max(100),
  type: basketTypeSchema,
  maxQuestions: z.number().int().positive("maxQuestions must be a positive integer").optional(),
  description: z.string().max(5000).optional(),
});

// ── Update Basket Body ───────────────────────────────────────────────────────

export const updateBasketBodySchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    code: z.string().min(1).max(100).optional(),
    maxQuestions: z.union([z.number().int().positive(), z.null()]).optional(),
    description: z.union([z.string().max(5000), z.null()]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });

// ── Workflow Transition Body ─────────────────────────────────────────────────

export const transitionBasketBodySchema = z.object({
  to: basketStatusSchema,
});

// ── Link Question Body ───────────────────────────────────────────────────────

export const linkQuestionBodySchema = z.object({
  questionId: z.string().uuid("questionId must be a valid UUID"),
});

// ── List Basket Questions Query ──────────────────────────────────────────────

export const listBasketQuestionsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_PAGE))
    .pipe(z.number().int().min(1)),
  per_page: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? parseInt(v, 10) : DEFAULT_PER_PAGE))
    .pipe(z.number().int().min(1).max(MAX_PER_PAGE)),
});

// ── Inferred Types ───────────────────────────────────────────────────────────

export type BasketIdParam = z.infer<typeof basketIdParamSchema>;
export type BasketQuestionParam = z.infer<typeof basketQuestionParamSchema>;
export type ListBasketsQuery = z.infer<typeof listBasketsQuerySchema>;
export type CreateBasketBody = z.infer<typeof createBasketBodySchema>;
export type UpdateBasketBody = z.infer<typeof updateBasketBodySchema>;
export type TransitionBasketBody = z.infer<typeof transitionBasketBodySchema>;
export type LinkQuestionBody = z.infer<typeof linkQuestionBodySchema>;
export type ListBasketQuestionsQuery = z.infer<typeof listBasketQuestionsQuerySchema>;
```

---

## 8. Workflow Engine Changes

### 8.1 `packages/domain-core/src/workflow/workflow.states.ts` — diff

```diff
 export enum WorkflowState {
+  DRAFT = 'DRAFT',
   COMPLETED = 'COMPLETED',
   UNDER_REVIEW = 'UNDER_REVIEW',
   APPROVED = 'APPROVED',
   ENABLED = 'ENABLED',
 }

 export const WORKFLOW_STATE_ORDER: WorkflowState[] = [
+  WorkflowState.DRAFT,
   WorkflowState.COMPLETED,
   WorkflowState.UNDER_REVIEW,
   WorkflowState.APPROVED,
   WorkflowState.ENABLED,
 ]

 export const WORKFLOW_TRANSITIONS: WorkflowTransitionDefinition[] = [
+  // Basket: initial transition out of DRAFT
+  {
+    from: WorkflowState.DRAFT,
+    to: WorkflowState.COMPLETED,
+    forward: true,
+    actionKey: 'complete',
+  },
   // Forward transitions
   { from: WorkflowState.COMPLETED, to: WorkflowState.UNDER_REVIEW, forward: true, actionKey: 'review' },
   ...
 ]

 export const WORKFLOW_ENTITY_TYPES = new Set<string>([
   'subject',
   'mcq_question',
   'traditional_question',
   'exam',
   'topic',
   'library_file',
   'template',
+  'mcq_basket',
 ])
```

### 8.2 `packages/domain-core/src/workflow/workflow.engine.ts` — diff

```diff
 const ENTITY_TABLE_MAP: Record<string, string> = {
   subject: 'subjects',
   mcq_question: 'mcq_questions',
   traditional_question: 'traditional_questions',
   exam: 'exams',
   topic: 'topics',
   library_file: 'library_files',
   template: 'templates',
+  mcq_basket: 'mcq_baskets',
 }
```

---

## 9. Column Summary

### `mcq_baskets`

| Column              | Type         | Nullable | Constraint                           | Notes                    |
| ------------------- | ------------ | -------- | ------------------------------------ | ------------------------ |
| `id`                | UUID         | NO       | PK                                   | `gen_random_uuid()`      |
| `name`              | VARCHAR(255) | NO       | NOT NULL                             |                          |
| `code`              | VARCHAR(100) | NO       | UNIQUE (migration-owned)             | Per-tenant unique        |
| `type`              | VARCHAR(20)  | NO       | CHECK IN ('LINKED','UNLINKED')       | Immutable after creation |
| `max_questions`     | INTEGER      | YES      | CHECK > 0                            | NULL = unlimited         |
| `description`       | TEXT         | YES      |                                      |                          |
| `status`            | VARCHAR(30)  | NO       | CHECK IN (5 values), DEFAULT 'DRAFT' | Workflow-managed         |
| `status_updated_at` | TIMESTAMPTZ  | YES      |                                      | Set by workflow engine   |
| `status_updated_by` | UUID         | YES      | FK → users.id SET NULL               | Set by workflow engine   |
| `created_at`        | TIMESTAMPTZ  | NO       | NOT NULL, DEFAULT NOW()              | Server-set               |
| `updated_at`        | TIMESTAMPTZ  | NO       | NOT NULL, DEFAULT NOW()              | Server-set               |
| `created_by`        | UUID         | YES      | FK → users.id SET NULL               |                          |
| `updated_by`        | UUID         | YES      | FK → users.id SET NULL               |                          |

### `mcq_basket_questions`

| Column        | Type        | Nullable | Constraint                    | Notes               |
| ------------- | ----------- | -------- | ----------------------------- | ------------------- |
| `id`          | UUID        | NO       | PK                            | `gen_random_uuid()` |
| `basket_id`   | UUID        | NO       | FK → mcq_baskets.id CASCADE   |                     |
| `question_id` | UUID        | NO       | FK → mcq_questions.id CASCADE |                     |
| `created_at`  | TIMESTAMPTZ | NO       | NOT NULL, DEFAULT NOW()       | Server-set          |

### Indexes

| Index name                             | Table                | Columns                  | Type              | Owner     |
| -------------------------------------- | -------------------- | ------------------------ | ----------------- | --------- |
| `mcq_baskets_pkey`                     | mcq_baskets          | id                       | B-tree PK         | migration |
| `idx_mcq_baskets_type`                 | mcq_baskets          | type                     | B-tree            | Drizzle   |
| `idx_mcq_baskets_status`               | mcq_baskets          | status                   | B-tree            | Drizzle   |
| `unique_mcq_basket_code`               | mcq_baskets          | code                     | UNIQUE CONCURRENT | migration |
| `mcq_basket_questions_pkey`            | mcq_basket_questions | id                       | B-tree PK         | migration |
| `idx_mcq_basket_questions_basket_id`   | mcq_basket_questions | basket_id                | B-tree            | Drizzle   |
| `idx_mcq_basket_questions_question_id` | mcq_basket_questions | question_id              | B-tree            | Drizzle   |
| `unique_mcq_basket_question`           | mcq_basket_questions | (basket_id, question_id) | UNIQUE CONCURRENT | migration |
