# Testing Guide — Traditional Question Model

This guide describes how to validate the `Traditional Question Model` feature locally and in CI.

Prerequisites

- Node/Bun toolchain installed
- Postgres test DB (see `scripts/init-test-db.sh`) — run in local dev or CI
- Redis for short-lived test infrastructure (if relevant to worker flows)

Quick commands

Run unit tests:

```bash
bun run test:unit
```

Run integration tests (API):

```bash
# start test DB (see scripts/init-test-db.sh) then
bun run test:integration --filter traditional-questions
```

Lint and typecheck:

```bash
biome check .
bun run typecheck
```

Run the app locally (dev):

```bash
bun run dev
# then exercise backoffice endpoints under /api/backoffice/traditional-questions
```

Migration verification

Apply tenant migrations in a disposable staging DB and verify:

```bash
# run tenant migrations for the feature
bun run db:migrate:up --tenant <tenant_slug>
# verify schema contains traditional_questions table and new columns
psql <connection_string> -c "\d traditional_questions"
```

Manual test checklist

- Create a `SHORT_ANSWER` and `LONG_ANSWER` question without `correct_answer` (ensure nullable handling)
- Create a question with `lessonId` and filter by `lessonId` in list endpoint
- Update question subject/subsection; verify immutability rules are enforced
- Delete a DRAFT question (hard delete) and a PUBLISHED question (soft delete)
- Verify error codes for immutability and validation match spec

Logs & Observability

- Check structured logs include `question_id`, `correlation_id`, `tenant` during create/update flows.

Where to report issues

- Open PR comments for code issues
- Open issues for spec mismatches or governance concerns
