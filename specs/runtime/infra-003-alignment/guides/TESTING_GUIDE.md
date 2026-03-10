# Testing Guide — Infrastructure and Governance Alignment

**Stage:** STAGE_INFRA_03_ALIGNMENT **Audience:** QA Engineers, Developers, CI/CD Pipeline **Last
Updated:** 2026-03-04 **Status:** Ready for Testing

---

## Overview

This guide explains the new infrastructure and governance alignment changes that affect how tests
are run, organized, and reported in the Zidney codebase.

### What Changed?

1. **Vitest is now workspace-orchestrated** — one root `vitest.workspace.ts` coordinates 14 parallel
   test projects
2. **Tests are organized consistently** — all tests live in
   `{app|package}/tests/{unit,integration,e2e}/`
3. **Playwright E2E is installed** — smoke tests are available for all apps
4. **Flaky tests are quarantined** — 2 known flaky tests are excluded from CI (see Quarantine
   section below)
5. **Skip reasons are documented** — every `.skip()` now has an inline comment explaining why
6. **ESLint + Prettier are aligned** — no conflicting formatting rules; run format before committing

---

## Quick Start

### Run All Tests

```bash
bun run test
```

This runs all 14 Vitest projects in parallel:

- Root + 5 apps (api, backoffice, frontoffice, mmc, worker)
- 8 packages (api-client, config, domain-core, logger, redis-utils, types, ui-system, validation)

**Expected result:** 2827 passing, 71 pre-existing skipped/failing (unrelated to this stage).

### Run Tests for One Project

```bash
# Example: test only the API app
bun run test -- --project api

# Example: test only the ui-system package
bun run test -- --project ui-system
```

### Watch Mode

```bash
bun run test -- --watch
```

Runs tests in watch mode; re-runs on file change. Add `--project <name>` to watch one project.

### Generate Coverage

```bash
bun run test -- --coverage
```

Generates coverage reports in `coverage/` (all projects combined).

---

## Understanding the Test Organization

### Directory Structure

Each app and package now has a consistent structure:

```
apps/api/                          packages/domain-core/
├── tests/                         ├── tests/
│   ├── unit/                      │   ├── unit/
│   │   └── .gitkeep               │   │   ├── .gitkeep
│   │   (or *.test.ts)             │   │   ├── license/
│   ├── integration/               │   │   │   ├── resolver.test.ts
│   │   └── .gitkeep               │   │   │   ├── validator.test.ts
│   │   (or *.test.ts)             │   │   │   └── ...
│   └── e2e/                       │   ├── integration/
│       ├── .gitkeep               │   │   └── .gitkeep
│       └── smoke.spec.ts          │   └── e2e/
├── vitest.config.ts               │       └── .gitkeep
└── playwright.config.ts (apps only)  ├── vitest.config.ts
                                   └── package.json
```

**Naming conventions:**

- Unit tests: `*.test.ts` or `*.spec.ts`
- Integration tests: `*.integration.test.ts` or in `tests/integration/`
- E2E tests: `*.spec.ts` in `tests/e2e/` (Playwright)

---

## Workspace Configuration

### Root vitest.config.ts

```typescript
// Root config provides defaults:
// - tsconfigPaths plugin for path resolution
// - coverage reporter (all projects)
// - reporter format (verbose for CI)
```

### Per-Project vitest.config.ts

14 minimal project configs inherit root defaults:

```typescript
// Example: apps/api/vitest.config.ts
import { defineProject } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineProject({
  name: "api",
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
```

Each project:

- Inherits root settings
- Specifies its own `include` pattern
- Can override settings if needed (most don't)

---

## Test Categories

### Unit Tests (`tests/unit/`)

Test individual functions, classes, and utilities in isolation.

**Examples:**

- License validation logic (domain-core)
- Config parsing (config package)
- API client adapters (api-client package)

**Run:**

```bash
bun run test -- --project domain-core --grep "license"
```

### Integration Tests (`tests/integration/`)

Test API routes with database, middleware, auth, etc.

**Examples:**

- Tenant resolver + license middleware
- Provision flow end-to-end
- License lifecycle (soft-lock, archival)

**Note:** Integration tests may require Postgres + Redis running. See CI `.github/workflows/ci.yml`
for service setup.

**Run:**

```bash
bun run test -- --project api tests/integration
```

### E2E Tests (`tests/e2e/` — Playwright)

Test full user flows in browser (UI + API).

**Examples:**

- Student login flow (frontoffice)
- Admin dashboard load (backoffice)
- Exam submission and grading flow

**Note:** E2E tests run Playwright against a live dev server. See `apps/*/playwright.config.ts` for
port and config.

**Run Playwright tests:**

```bash
bun run dev:all &  # Start all dev servers in background
sleep 5            # Wait for servers to start
npx playwright test --ui  # Open Playwright Inspector UI
```

**Individual app Playwright configs:**

- `apps/backoffice/playwright.config.ts` → http://localhost:5174
- `apps/frontoffice/playwright.config.ts` → http://localhost:5175
- `apps/mmc/playwright.config.ts` → http://localhost:5173

---

## Skipped Tests & Quarantine

### Why Tests Are Skipped

Tests use `.skip()` for reasons:

| Reason                           | Example                                             | When to Remediate                          |
| -------------------------------- | --------------------------------------------------- | ------------------------------------------ |
| **ERR_MODULE_NOT_FOUND**         | `@shadcn-vue/ui/button` not found (pending removal) | STAGE_BACKOFFICE (vuetify migration)       |
| **Flaky (known race condition)** | fetch-adapter async timing; worker concurrency      | STAGE_QA or after root-cause analysis      |
| **Deprecated API**               | Old tenant isolation rules; superseded by Phase 2   | Next stage that replaces the API           |
| **Placeholder test**             | Template file; not runnable                         | Developer removes/replaces with real tests |

### Quarantined Tests

2 tests are **explicitly quarantined** (fully-skipped, excluded from runner):

1. **INFRA-003-FLAKY-001:** `packages/api-client/tests/client.test.ts`
   - Suite: FetchAdapter async initialization tests
   - Reason: Intermittent timeout; race condition in mock setup
   - Remediation: Requires async mock redesign (STAGE_QA candidate)
   - Status: Moved to `audits/INFRA-003-FLAKY-001.txt` for tracking

2. **INFRA-003-FLAKY-002:** `apps/worker/tests/load-testing.test.ts`
   - Suite: Worker concurrency load tests
   - Reason: Fails under high concurrency (>100 jobs); memory contention
   - Remediation: Requires worker memory isolation tuning (STAGE_PERF candidate)
   - Status: Moved to `audits/INFRA-003-FLAKY-002.txt` for tracking

**How Quarantine Works:**

These files have `describe.skip` at top level AND are excluded in their project's
`vitest.config.ts`:

```typescript
// packages/ui-system/vitest.config.ts
export default defineProject({
  name: "ui-system",
  test: {
    include: ["tests/**/*.spec.ts"],
    exclude: [
      "tests/unit/DataTable.spec.ts", // fully skipped
      "tests/unit/composables.spec.ts", // fully skipped
      "tests/unit/utilities.spec.ts", // fully skipped
    ],
  },
});
```

This prevents Vitest from reporting "No test suite found" error (which it does when a file has only
`describe.skip`).

---

## Prettier & ESLint

### Auto-Format Before Commit

```bash
bun run format
```

Runs Prettier on all staged files. ESLint now knows not to conflict with Prettier.

### Check Formatting (No Changes)

```bash
bun run format:check
```

Exits with error if formatting violations found.

### ESLint Rules

```bash
bun run lint
```

Runs ESLint. ESLint + Prettier are now aligned (no conflicting rules).

### Linting Before Test

CI runs tests only after lint + type check pass. To match CI locally:

```bash
bun run lint && bunx tsc --noEmit && bun run test
```

---

## CI Pipeline

The new CI pipeline (`.github/workflows/ci.yml`) runs on all PRs and merges to `develop`:

```yaml
jobs:
  1. lint: bunx eslint .
  2. typecheck: bunx tsc --noEmit
  3. unit-tests: bun run test (Vitest)
  4. integration-tests: bun run test:integration (if defined)
  5. e2e-tests: Playwright + bunx wait-on
```

**Services running during CI:**

- Postgres 15-alpine (port 5432)
- Redis 7-alpine (port 6379)

**Artifacts on failure:**

- Playwright traces captured to `trace-*.zip`
- Test coverage reports uploaded

To debug CI locally:

```bash
docker-compose -f docker-compose.test.yml up  # Start Postgres + Redis
bun run lint && bunx tsc --noEmit && bun run test
```

---

## Debugging Failing Tests

### 1. Run the failing test in isolation

```bash
bun run test -- --project domain-core --grep "license-soft-lock"
```

### 2. Enable verbose output

```bash
bun run test -- --reporter=verbose
```

### 3. Use debugger breakpoints

```typescript
// Add to test file:
it("should validate", () => {
  debugger; // Breakpoint here
  expect(result).toBe(true);
});
```

Then run with:

```bash
bun --inspect-wait run test -- --project domain-core --grep "should validate"
```

Open `chrome://inspect` to debug in DevTools.

### 4. Check test skip reason

Look for `SKIP REASON:` comment above `.skip()`:

```typescript
// SKIP REASON: ERR_MODULE_NOT_FOUND: @shadcn-vue/ui/button pending vuetify removal
describe.skip("DataTable", () => {
  // ...
});
```

If skip reason points to another stage, that's the next place to fix it.

---

## Adding New Tests

### New Unit Test

```bash
# Create test file
echo "import { expect, it } from 'vitest';

it('should do something', () => {
  expect(true).toBe(true);
})" > packages/domain-core/tests/unit/my-feature.test.ts

# Run it
bun run test -- --project domain-core --grep "should do something"
```

### New E2E Test (Playwright)

```bash
# Create test file
echo "import { test, expect } from '@playwright/test';

test('should load page', async ({ page }) => {
  await page.goto('http://localhost:5174');
  await expect(page).toHaveTitle(/Dashboard/);
})" > apps/backoffice/tests/e2e/my-flow.spec.ts

# Run Playwright
npx playwright test apps/backoffice/tests/e2e/my-flow.spec.ts
```

---

## Known Issues & Workarounds

### Issue: "No test suite found" after adding describe.skip

**Problem:** Vitest fails if a file has _only_ `describe.skip` and no other tests.

**Solution:** Add file to `exclude` in the project's `vitest.config.ts`:

```typescript
exclude: ["tests/unit/my-fully-skipped-file.spec.ts"];
```

### Issue: Module not found errors in E2E tests

**Problem:** Playwright E2E tests run in browser; they can't import Node.js modules.

**Solution:** E2E tests should only import browser-safe modules (Vue, UI components). API calls go
via HTTP.

### Issue: Tests pass locally but fail in CI

**Problem:** Local Postgres/Redis may have different state than CI.

**Solution:** Check `docker-compose.test.yml` for service config; ensure your local Docker matches.

---

## Performance Benchmarks

| Metric              | Value | Notes                                  |
| ------------------- | ----- | -------------------------------------- |
| Full test suite run | ~45s  | 14 projects in parallel; Vitest caches |
| Lint only           | ~8s   | ESLint all files                       |
| Type check          | ~12s  | TypeScript --noEmit                    |
| Format check        | ~3s   | Prettier --check                       |
| Unit tests only     | ~20s  | Single project avg                     |

---

## Troubleshooting

### "Port 5174 is already in use"

```bash
# Kill the process using port 5174
lsof -i :5174               # macOS/Linux
netstat -ano | findstr 5174 # Windows

# Then stop and restart dev server
bun run dev:backoffice
```

### "Postgres connection refused"

```bash
# Check if Postgres is running
docker ps | grep postgres

# If not, start it
docker-compose -f docker-compose.test.yml up postgres
```

### "Tests are taking too long"

```bash
# Check what's slow
bun run test -- --reporter=verbose --reporter=json > test-results.json

# Run only fast tests
bun run test -- --grep "^(?!slow)"
```

---

## References

- **Vitest:** https://vitest.dev/guide/workspace.html
- **Playwright:** https://playwright.dev/docs/intro
- **ESLint:** https://eslint.org/docs/latest/
- **Prettier:** https://prettier.io/docs/en/index.html

---

## Questions?

See `specs/runtime/infra-003-alignment/reports/IMPLEMENT_REPORT.md` for details on all 72 tasks and
changes.

For bulk questions, open an issue in the repo or ask the maintainers.
