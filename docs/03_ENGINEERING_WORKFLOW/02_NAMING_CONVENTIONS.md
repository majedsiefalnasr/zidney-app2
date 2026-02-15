# Naming Conventions

This document defines mandatory naming standards across Zidney.

These rules apply to:

- Backend (Bun + Hono + Drizzle)
- Frontend (Vue 3 + TypeScript)
- Database (PostgreSQL)
- Workers
- AI-generated code

No deviation allowed.

---

## General Principles

- Names must be descriptive.
- No abbreviations unless universally known (e.g., ID, URL, JWT).
- No single-letter variable names (except loop counters).
- Avoid business ambiguity (e.g., do not use `data`, `info`, `item`).

---

## Files

- Use kebab-case
- Must describe responsibility

Examples:

- `attempt-engine.service.ts`
- `license-validation.middleware.ts`
- `tenant-connection-resolver.ts`
- `mcq-question.repository.ts`

Vue components:

- `ExamDashboard.vue`
- `StudentProfileCard.vue`

---

## Folders

- Use kebab-case
- Group by domain, not technical layer

Examples:

- `attempt-engine/`
- `license-engine/`
- `exam-engine/`
- `academic-structure/`

---

## Database Tables

- Use snake_case
- Plural nouns
- Explicit domain meaning

Examples:

- `exam_attempts`
- `mcq_questions`
- `traditional_questions`
- `workspace_settings`
- `role_permissions`

Never use:

- Generic names like `data`, `items`, `records`

---

## Database Columns

- Use snake_case
- Explicit and consistent

Examples:

- `workspace_id`
- `student_limit`
- `started_at`
- `submitted_at`
- `schema_version`
- `product_version`

Foreign keys must follow:

- `<entity>_id`

Examples:

- `user_id`
- `division_id`
- `license_id`

---

## TypeScript Interfaces & Types

- PascalCase
- Singular
- Domain explicit

Examples:

- `ExamAttempt`
- `AttemptSnapshot`
- `LicenseState`
- `TenantConnectionContext`

Suffix rules:

- `Dto` → API payload types
- `Input` → Creation/update input
- `Response` → API response models
- `Context` → Request-scoped data
- `Config` → Configuration objects

---

## Classes

- PascalCase
- Must include responsibility suffix

Examples:

- `AttemptService`
- `LicenseEngine`
- `TenantResolver`
- `SubmissionOrchestrator`

Avoid generic names like:

- `Manager`
- `Helper`
- `Utils`

---

## Enums

- PascalCase enum name
- UPPER_SNAKE_CASE values

Example:

```ts
enum AttemptStatus {
  STARTED = 'STARTED',
  SUBMITTED = 'SUBMITTED',
  AUTO_SUBMITTED = 'AUTO_SUBMITTED',
}
```

Enum values must match database stored values exactly.

---

## Constants

- UPPER_SNAKE_CASE
- Centralized per domain

Examples:

- `MAX_RECONNECTION_WINDOW_SECONDS`
- `DEFAULT_ATTEMPT_TIMEOUT_MINUTES`

---

## API Routes

- RESTful
- Lowercase
- Plural nouns
- No verbs in route path
- Versioned when breaking change occurs

Examples:

- `/api/workspaces/:workspaceSlug/exams`
- `/api/workspaces/:workspaceSlug/attempts`
- `/api/mmc/products`

Never use:

- `/getExams`
- `/createAttempt`

---

## Events (Worker / Queue)

- snake_case
- Domain-prefixed

Examples:

- `attempt_started`
- `attempt_submitted`
- `license_soft_locked`
- `workspace_provisioned`

---

## Redis Keys

- colon-separated
- Namespaced by workspace

Format:

`workspace:{workspaceId}:attempt:{attemptId}`

Examples:

- `workspace:12:attempt:893`
- `workspace:7:rate-limit:login:ip:192.168.1.10`

---

## Migration Files

- Timestamp-prefixed
- snake_case description

Example:

`20250101_create_exam_attempts_table.sql`

Never rename migration files after merge.

---

## Test Files

- Same name as source
- `.spec.ts` suffix

Examples:

- `attempt-engine.service.spec.ts`
- `license-engine.spec.ts`

---

## Frontend State (Pinia)

Stores:

- camelCase name
- Explicit domain

Examples:

- `useAttemptStore`
- `useLicenseStore`
- `useDashboardStore`

State variables:

- camelCase

---

## AI Code Generation Rules

AI must:

- Follow naming rules strictly
- Never invent inconsistent naming
- Never mix camelCase and snake_case incorrectly
- Never introduce vague identifiers

Any naming violation is considered architectural drift.

---

## Stability Principle

Naming is part of architecture.

If naming becomes inconsistent,
the system becomes cognitively unstable,
especially under AI-assisted development.

Naming discipline is mandatory.
