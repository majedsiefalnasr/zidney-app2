# Testing Guide — STAGE 42 – Student Management

**Stage:** STAGE 42 – Student Management  
**Phase:** 03_BACKOFFICE_CORE / 05_USER_MANAGEMENT  
**Stage Directory:** specs/runtime/042-student-management  
**Generated On:** 2026-04-03T22:55:00.000Z

---

## Purpose

This guide explains how to validate the Student Management implementation end-to-end.

---

## Summary of Delivered Behavior

This stage adds tenant-scoped student management: create/list/get/update/disable/enable/delete students, subscription updates, and bulk-import. Includes database migration, validation schemas, domain services, and API routes. All operations are tenant-scoped and guarded by license/limit checks where applicable.

Key outcomes:

- Tenant-scoped CRUD for students
- Idempotent enable/disable flows
- Bulk CSV import with per-row validation

---

## Prerequisites

- Bun installed (`bun --version`)
- Node 20+ recommended
- Docker running (for local DB) if needed
- Migrations applied for tenant DB

### Quick checks

```bash
# Install deps
bun install

# Typecheck
rtk bun run typecheck

# Biome lint check for changed files
npx biome check packages/domain-core/src/students/ || true
```

---

## Local Run Commands

```bash
# Apply migrations (tenant DB)
bun run db:migrate

# Start API
bun run dev:api

# Run domain-core unit tests
npx vitest run --project domain-core "students"

# Run API integration tests
npx vitest run --project api "students"
```

Expected outcome: unit + integration tests for students pass (15/15 and 16/16).

---

## Automated Validation Commands

```bash
# Unit tests
bun test

# Full governance + test pipeline (use for release validation)
bun run ai:guard && bun run arch:audit && bun run lint && bun run typecheck && bun run test
```

---

## Manual Test Scenarios

### Scenario 1 — Create Student and Read Back

**Purpose:** Verify create request persists and sensitive fields are stripped

1. POST backoffice create-student with valid payload
2. GET student by id

Expected: Student exists; response does not include `password_hash` or `failed_login_count`.

### Scenario 2 — Disable / Enable Idempotency

**Purpose:** Verify idempotent state-change guards

1. POST disable-student for an ACTIVE student
2. POST disable-student again

Expected: First request succeeds; second request returns `STUDENT_ALREADY_DISABLED` error.

### Scenario 3 — Delete Guard (Has Attempts)

**Purpose:** Prevent deletion when attempts exist

1. Create student with an attempt in `attempts` table (status SUBMITTED)
2. DELETE student

Expected: `STUDENT_HAS_ATTEMPTS` error returned; student not deleted.

---

## Multi-Tenant Isolation Verification

1. Create test data in `workspace-a` and `workspace-b` separately
2. Confirm `workspace-b` cannot access `workspace-a` data

If leakage is observed, stop and report immediately.

---

## Structured Log Verification

Run the API and confirm logs include `workspace_slug` and `correlation_id` fields.

```bash
bun run dev:api | jq .
```

---

## Architecture & Governance Checks

```bash
# AI / Architecture guard
bun run ai:guard && bun run arch:audit

# Local CI simulation (pre-merge)
bun run ci:run-local
```

---

If any check fails, provide the failing command output and re-run the corresponding fix steps before approving the PR.
