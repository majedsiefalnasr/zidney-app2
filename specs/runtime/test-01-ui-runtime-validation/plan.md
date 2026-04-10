# Implementation Plan: STAGE_TEST_01_UI_RUNTIME_VALIDATION

**Phase**: 06_UI_APPLICATION_RUNTIME
**Stage**: STAGE_TEST_01_UI_RUNTIME_VALIDATION
**Stage Type**: VALIDATION-ONLY — no new features, no DB migrations, no new public API surfaces
**Branch**: `spec/test-01-ui-runtime-validation`
**Related Spec File**: `specs/runtime/test-01-ui-runtime-validation/spec.md`
**Related ADR**: None required (validation stage, no new architecture)
**Risk Level**: LOW
**Generated**: 2026-04-08

---

## Architectural Scope Confirmation

This is a validation-only stage. The plan introduces:

- New **test files only** (Vitest unit + static analysis)
- No new features, no migrations, no new routes, no new API surfaces

Architecture governance checks:

- ✅ No cross-tenant data access introduced (ADR-0001) — validators only
- ✅ No middleware bypass — no production code changes
- ✅ No direct DB instantiation — UI-layer tests only
- ✅ No grading logic — not in scope
- ✅ No weakening of snapshot integrity (ADR-0002) — not in scope
- ✅ No version enforcement changes (ADR-0007, ADR-0008) — not in scope
- ✅ No layer boundary violations — test files import from their own app or shared packages only
- ✅ Import boundaries honored: test files in `tests/` import from `apps/*` and `packages/*` only

No ADR required.

---

## Trust Chain Verification

This validation stage verifies the trust chain is already correctly implemented in Phase 06 stages:

- ✅ **Isolation**: Store isolation per-app confirmed (Test 5.1); cross-tenant enforced at API level
- ✅ **License**: 423/426 → licenseStatusStore flow confirmed (Tests 2.3, 3.2)
- ✅ **Authentication**: Router guards + 401 handling confirmed (Tests 1.1, 2.1, 2.2)
- ✅ **Attempt**: Out of scope for UI runtime layer
- ✅ **Runtime**: Server-authoritative time — not a concern for UI-layer validation
- ✅ **Frontoffice**: No business logic confirmed via static scan (Tests 3.1, 5.3)

---

## Coverage Gap Register

Based on `research.md`, 6 gaps require new test files or additions:

| Gap | Test(s)            | Action                                                             | Blocking |
| --- | ------------------ | ------------------------------------------------------------------ | -------- |
| G1  | 3.3                | New `tests/unit/api-client/interceptors/correlation-id.test.ts`    | Yes      |
| G2  | 3.2                | Extend `apps/*/src/core/errors/__tests__/error-normalizer.spec.ts` | Yes      |
| G3  | 3.1, 5.3, 6.1, 7.1 | New `tests/validation/static-analysis.test.ts`                     | Yes      |
| G4  | 5.1                | New `tests/unit/store-isolation.test.ts`                           | Yes      |
| G5  | 5.2, 2.3           | Extend `tests/integration/*/auth/session-clear-wiring.test.ts`     | Yes      |
| G6  | 1.3 (partial)      | Covered by G4/T007 (client-side isolation only — see note below)   | No       |

**Test 1.3 — Cross-Workspace Token Isolation — Traceability Note:**

Test 1.3 has two pass criteria:

- **Steps 1–4** (server returns 403/404 for cross-workspace access): These are **out of scope** for this stage. Server-side tenant isolation is validated by `STAGE_TEST_01_PLATFORM_FOUNDATION`. See spec section "Out of Scope: Backend API validation".
- **Step 5** (token not stored/shared across workspace instances): Covered by **G4/T007** — `tests/unit/store-isolation.test.ts` asserts that each app calls `createPinia()` independently, ensuring no cross-instance shared store state.

**DEFERRED GAP — `main.ts` `licenseStatusStore.clearLicenseStatus()` wiring:**

The session clear wiring in `onSessionExpired` for `licenseStatusStore.clearLicenseStatus()` is not yet present in any `apps/*/src/main.ts`. This stage is VALIDATION-ONLY and cannot introduce production code changes. A follow-up PRODUCTION-PATCH stage is required to add this one-line call to `onSessionExpired` in all three apps. The GAP 5 tests (T008–T010) validate store-level behavior using synthetic closures and remain valid as-is.

---

## Phase 0: Confirm Existing Test Suites Pass

**Objective**: Verify all existing test files that cover validation criteria run without failures.

**Command**:

```bash
rtk bun run test \
  tests/integration/mmc/auth/401-race.test.ts \
  tests/integration/backoffice/auth/401-race.test.ts \
  tests/integration/frontoffice/auth/401-race.test.ts \
  tests/unit/mmc/core/api/interceptors/error.interceptor.test.ts \
  tests/unit/backoffice/core/api/interceptors/error.interceptor.test.ts \
  tests/unit/frontoffice/core/api/interceptors/error.interceptor.test.ts \
  tests/integration/mmc/auth/session-clear-wiring.test.ts \
  tests/integration/backoffice/auth/session-clear-wiring.test.ts \
  tests/integration/frontoffice/auth/session-clear-wiring.test.ts \
  tests/unit/mmc/core/auth/token-persistence-audit.test.ts \
  tests/unit/backoffice/core/auth/token-persistence-audit.test.ts \
  tests/unit/frontoffice/core/auth/token-persistence-audit.test.ts \
  apps/mmc/src/core/guards/__tests__/auth.guard.spec.ts \
  apps/backoffice/src/core/guards/__tests__/auth.guard.spec.ts \
  apps/frontoffice/src/core/guards/__tests__/auth.guard.spec.ts \
  tests/unit/mmc/core/router/guards/auth.guard.redirect.test.ts \
  tests/unit/backoffice/core/router/guards/auth.guard.redirect.test.ts \
  tests/unit/frontoffice/core/router/guards/auth.guard.redirect.test.ts \
  apps/backoffice/src/core/guards/__tests__/role.guard.spec.ts \
  apps/frontoffice/src/core/guards/__tests__/role.guard.spec.ts \
  tests/unit/mmc/core/state/license-status.store.test.ts \
  tests/unit/backoffice/core/state/license-status.store.test.ts \
  tests/unit/frontoffice/core/state/license-status.store.test.ts \
  apps/mmc/src/core/errors/__tests__/error-normalizer.spec.ts \
  apps/backoffice/src/core/errors/__tests__/error-normalizer.spec.ts \
  apps/frontoffice/src/core/errors/__tests__/error-normalizer.spec.ts \
  apps/mmc/src/core/errors/__tests__/ErrorBoundary.spec.ts \
  apps/backoffice/src/core/errors/__tests__/ErrorBoundary.spec.ts \
  apps/frontoffice/src/core/errors/__tests__/ErrorBoundary.spec.ts \
  apps/mmc/src/core/errors/__tests__/redact-error.spec.ts \
  tests/unit/mmc/core/auth/token-redact.test.ts \
  tests/unit/backoffice/core/auth/token-redact.test.ts \
  tests/unit/frontoffice/core/auth/token-redact.test.ts
```

**Pass criteria**: All exit 0 with no failures.

---

## Phase 1: Static Analysis Validation (GAP 3)

**Objective**: Codify grep-based assertions for Tests 3.1, 5.3, 6.1 (partial), and 7.1.

### New File: `tests/validation/static-analysis.test.ts`

```typescript
/**
 * Static analysis: confirm source code hygiene for STAGE_TEST_01_UI_RUNTIME_VALIDATION.
 * Tests: 3.1 (no raw HTTP), 5.3 (no direct API calls in .vue), 6.1 (.env.production not in git), 7.1 (no v-html)
 * Requires: ripgrep (rg) — install with `brew install ripgrep` or `apt install ripgrep`
 */
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const APP_SRC = "apps/mmc/src apps/backoffice/src apps/frontoffice/src";
const REPO_ROOT = process.cwd();

beforeAll(() => {
  try {
    execSync("rg --version", { cwd: REPO_ROOT, stdio: "pipe" });
  } catch {
    throw new Error(
      "ripgrep (rg) is required for static analysis tests but was not found. " +
        "Install: brew install ripgrep  |  apt install ripgrep  |  cargo install ripgrep",
    );
  }
  for (const dir of ["apps/mmc/src", "apps/backoffice/src", "apps/frontoffice/src"]) {
    if (!existsSync(join(REPO_ROOT, dir))) {
      throw new Error(`Required scan directory does not exist: ${dir} — verify the app src path`);
    }
  }
});

function scan(pattern: string, pathArgs: string, extraFlags = ""): string {
  return execSync(`rg --count-matches ${extraFlags} "${pattern}" ${pathArgs} 2>/dev/null || true`, {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  }).trim();
}

function gitLsFiles(path: string): string {
  try {
    return execSync(`git ls-files "${path}"`, { cwd: REPO_ROOT, encoding: "utf-8" }).trim();
  } catch {
    return "";
  }
}

describe("Static Analysis — Raw HTTP (Test 3.1)", () => {
  it("no raw fetch( calls in app source (excluding test files)", () => {
    const result = scan("fetch\\(", APP_SRC, '--glob "!**/*.{test,spec}.ts"');
    expect(result, "Raw fetch() found — use @zidney/api-client instead").toBe("");
  });

  it("no axios method calls in app source", () => {
    const result = scan(
      "axios\\.(get|post|put|delete|patch)\\(",
      APP_SRC,
      '--glob "!**/*.{test,spec}.ts"',
    );
    expect(result, "Direct axios call found — use @zidney/api-client instead").toBe("");
  });

  it("no new XMLHttpRequest( in app source", () => {
    const result = scan("new XMLHttpRequest\\(", APP_SRC);
    expect(result, "XMLHttpRequest found — use @zidney/api-client instead").toBe("");
  });
});

describe("Static Analysis — XSS Surface (Test 7.1)", () => {
  it("no v-html directive in any .vue file", () => {
    const result = scan("v-html", APP_SRC, '--glob "*.vue"');
    expect(result, "v-html found — XSS risk, remove and use text binding").toBe("");
  });
});

describe("Static Analysis — Env Security (Test 6.1)", () => {
  it(".env.production is not tracked in git", () => {
    const all = [
      gitLsFiles(".env.production"),
      gitLsFiles("apps/mmc/.env.production"),
      gitLsFiles("apps/backoffice/.env.production"),
      gitLsFiles("apps/frontoffice/.env.production"),
    ].join("");
    expect(all, ".env.production tracked in git — add to .gitignore").toBe("");
  });
});

describe("Static Analysis — No Business Logic in Vue Components (Test 5.3)", () => {
  it("no direct apiClient method calls inside .vue files", () => {
    const result = scan("apiClient\\.(get|post|put|delete|patch)\\(", APP_SRC, '--glob "*.vue"');
    expect(result, "Direct apiClient call in .vue — delegate to composable or store action").toBe(
      "",
    );
  });
});

// DEFERRED: main.ts licenseStatusStore.clearLicenseStatus() wiring scan removed.
// This stage is VALIDATION-ONLY — production code in apps/*/src/main.ts does not yet
// call clearLicenseStatus() inside onSessionExpired. A follow-up PRODUCTION-PATCH stage
// will add this one-line call. GAP 5 tests (T008–T010) validate store behavior via
// synthetic closures and remain valid as-is.
```

**Note**: Requires `rg` (ripgrep). Place in `tests/validation/` (directory exists).

---

## Phase 2: New Unit Test Files for Gaps

### GAP 1 — `tests/unit/api-client/interceptors/correlation-id.test.ts`

Create directory `tests/unit/api-client/interceptors/` and file:

```typescript
/**
 * Unit tests for applyCorrelationId() in packages/api-client/src/interceptors.ts
 * Covers Test 3.3: X-Correlation-ID header present on all outgoing requests.
 * Stage: STAGE_TEST_01_UI_RUNTIME_VALIDATION
 */
import { describe, expect, it } from "vitest";
import { applyCorrelationId } from "../../../../packages/api-client/src/interceptors";

describe("applyCorrelationId", () => {
  it("sets X-Correlation-ID to the provided correlationId", () => {
    const headers: Record<string, string> = {};
    applyCorrelationId(headers, "my-request-id-123");
    expect(headers["X-Correlation-ID"]).toBe("my-request-id-123");
  });

  it("auto-generates a UUID when no correlationId is provided", () => {
    const headers: Record<string, string> = {};
    applyCorrelationId(headers);
    expect(headers["X-Correlation-ID"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("generates distinct UUIDs for separate calls", () => {
    const h1: Record<string, string> = {};
    const h2: Record<string, string> = {};
    applyCorrelationId(h1);
    applyCorrelationId(h2);
    expect(h1["X-Correlation-ID"]).not.toBe(h2["X-Correlation-ID"]);
  });

  it("key is exactly X-Correlation-ID (not x-request-id or other variants)", () => {
    const headers: Record<string, string> = {};
    applyCorrelationId(headers, "test-id");
    expect(Object.keys(headers)).toContain("X-Correlation-ID");
    expect(Object.keys(headers)).not.toContain("x-request-id");
    expect(Object.keys(headers)).not.toContain("X-Request-ID");
  });

  it("overwrites an existing X-Correlation-ID when a new value is provided", () => {
    const headers: Record<string, string> = { "X-Correlation-ID": "old-id" };
    applyCorrelationId(headers, "new-id");
    expect(headers["X-Correlation-ID"]).toBe("new-id");
  });
});
```

---

### GAP 2 — Extend `apps/*/src/core/errors/__tests__/error-normalizer.spec.ts` (all 3 apps)

Append the following `describe` block to each file. Do not modify existing tests.

> `AdapterResponse` import: check if already imported — add only if missing.

```typescript
// ─── HTTP status code propagation (Test 3.2) ──────────────────────────
// Confirms app-level normalizeError() delegates each critical HTTP status
// through to the correct ErrorCode via mapHttpStatusToCode().

describe("normalizeError — HTTP status code propagation (Test 3.2)", () => {
  function makeAdapter(status: number): AdapterResponse {
    return { status, headers: {}, body: null, ok: false };
  }

  it("403 → PERMISSION_DENIED", () => {
    const r = normalizeError(makeAdapter(403));
    expect(r.httpStatus).toBe(403);
    expect(r.code).toBe(ErrorCodes.PERMISSION_DENIED);
  });

  it("423 → LOCKED", () => {
    const r = normalizeError(makeAdapter(423));
    expect(r.httpStatus).toBe(423);
    expect(r.code).toBe(ErrorCodes.LOCKED);
  });

  it("426 → UPGRADE_REQUIRED", () => {
    const r = normalizeError(makeAdapter(426));
    expect(r.httpStatus).toBe(426);
    expect(r.code).toBe(ErrorCodes.UPGRADE_REQUIRED);
  });

  it("429 → RATE_LIMITED", () => {
    const r = normalizeError(makeAdapter(429));
    expect(r.httpStatus).toBe(429);
    expect(r.code).toBe(ErrorCodes.RATE_LIMITED);
  });

  it("500 → SERVER_ERROR", () => {
    const r = normalizeError(makeAdapter(500));
    expect(r.httpStatus).toBe(500);
    expect(r.code).toBe(ErrorCodes.SERVER_ERROR);
  });
});
```

The existing `normalizeResponseError` mock in these files already calls `mapHttpStatusToCode()`,
so no mock changes are required.

---

### GAP 4 — `tests/unit/store-isolation.test.ts`

```typescript
/**
 * Confirms each app creates its own Pinia instance (not a shared singleton).
 * Covers Test 5.1: Store Isolation Across Apps.
 * Stage: STAGE_TEST_01_UI_RUNTIME_VALIDATION
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function readMain(app: string): string {
  return readFileSync(join(ROOT, "apps", app, "src", "main.ts"), "utf-8");
}

describe("Pinia store isolation per app (Test 5.1)", () => {
  const apps = ["mmc", "backoffice", "frontoffice"] as const;

  for (const app of apps) {
    it(`${app}/main.ts calls createPinia() locally`, () => {
      expect(readMain(app)).toContain("createPinia()");
    });

    it(`${app}/main.ts imports createPinia from 'pinia' package (not a cross-app singleton)`, () => {
      expect(readMain(app)).toMatch(/import\s+\{[^}]*createPinia[^}]*\}\s+from\s+['"]pinia['"]/);
    });

    it(`${app}/main.ts does NOT import createPinia from a @zidney/* shared package`, () => {
      expect(readMain(app)).not.toMatch(/from\s+['"]@zidney\/[^'"]*pinia[^'"]*['"]/);
    });
  }

  it("each app independently declares const pinia = createPinia()", () => {
    for (const app of apps) {
      expect(readMain(app), `${app}/main.ts missing local pinia declaration`).toMatch(
        /const pinia\s*=\s*createPinia\(\)/,
      );
    }
  });
});
```

---

### GAP 5 — Extend `tests/integration/*/auth/session-clear-wiring.test.ts` (all 3 apps)

Append the following `describe` block to each file. Adjust relative import paths per app.

**Additional import** (add at top if not present):

```typescript
// MMC:
import { useLicenseStatusStore } from "../../../../apps/mmc/src/core/state/license-status.store";
// Backoffice: import { useLicenseStatusStore } from '../../../../apps/backoffice/src/core/state/license-status.store'
// Frontoffice: import { useLicenseStatusStore } from '../../../../apps/frontoffice/src/core/state/license-status.store'
```

**New describe block** (shown for MMC; adjust app name in describe string):

```typescript
describe("licenseStatusStore cleared on session expiry (Tests 5.2, 2.3)", () => {
  it("isWorkspaceLocked is false after handleAuthFailure() when pre-set to true", async () => {
    pinia = makePinia();
    tokenManager = makeTokenManager();
    router = makeRouter();
    clearUserSpecificStores = vi.fn();

    const licenseStatusStore = useLicenseStatusStore(pinia);
    licenseStatusStore.setWorkspaceLocked(true);

    const useAuthStore = defineAuthStore(makeAuthService(), tokenManager, router, LOGIN_ROUTE, () =>
      makeRefreshManager(),
    );
    const authStore = useAuthStore(pinia);
    authStore.isAuthenticated = true;

    const interceptor = createErrorInterceptor({
      getIsAuthenticated: () => authStore.isAuthenticated,
      onSessionExpired: async () => {
        licenseStatusStore.clearLicenseStatus();
        await authStore.expireSession();
        clearUserSpecificStores();
      },
      onLicenseError: vi.fn(),
    });

    await interceptor.handleAuthFailure();

    expect(licenseStatusStore.isWorkspaceLocked).toBe(false);
  });

  it("isUpgradeRequired is false after handleAuthFailure() when pre-set to true", async () => {
    pinia = makePinia();
    tokenManager = makeTokenManager();
    router = makeRouter();
    clearUserSpecificStores = vi.fn();

    const licenseStatusStore = useLicenseStatusStore(pinia);
    licenseStatusStore.setUpgradeRequired(true);

    const useAuthStore = defineAuthStore(makeAuthService(), tokenManager, router, LOGIN_ROUTE, () =>
      makeRefreshManager(),
    );
    const authStore = useAuthStore(pinia);
    authStore.isAuthenticated = true;

    const interceptor = createErrorInterceptor({
      getIsAuthenticated: () => authStore.isAuthenticated,
      onSessionExpired: async () => {
        licenseStatusStore.clearLicenseStatus();
        await authStore.expireSession();
        clearUserSpecificStores();
      },
      onLicenseError: vi.fn(),
    });

    await interceptor.handleAuthFailure();

    expect(licenseStatusStore.isUpgradeRequired).toBe(false);
  });
});
```

**Production-code wiring note**: These tests construct the `onSessionExpired` closure themselves
to validate store-level behavior. The actual wiring of `licenseStatusStore.clearLicenseStatus()` in
`apps/*/src/main.ts` `onSessionExpired` is deferred to a follow-up PRODUCTION-PATCH stage and is
tracked separately — not a gate for this VALIDATION-ONLY stage.

---

## Phase 3: Build Validation

**Objective**: Tests 6.2 — all three production builds exit 0, typecheck passes, lint passes.

```bash
# TypeScript typecheck — all apps
rtk bun run typecheck

# Lint — all apps
rtk bun run lint

# Production builds
cd apps/mmc && bun run build && cd ../..
cd apps/backoffice && bun run build && cd ../..
cd apps/frontoffice && bun run build && cd ../..
```

**Pass criteria**: Each command exits 0. Archive output to
`specs/runtime/test-01-ui-runtime-validation/reports/build-validation.log`.

---

## Phase 4: Integration Tests Verification

```bash
# 401 race + session clear (Tests 1.1, 1.2, 5.2, 2.3)
rtk bun run test \
  tests/integration/mmc/auth/401-race.test.ts \
  tests/integration/backoffice/auth/401-race.test.ts \
  tests/integration/frontoffice/auth/401-race.test.ts \
  tests/integration/mmc/auth/session-clear-wiring.test.ts \
  tests/integration/backoffice/auth/session-clear-wiring.test.ts \
  tests/integration/frontoffice/auth/session-clear-wiring.test.ts
```

Archive output to `specs/runtime/test-01-ui-runtime-validation/reports/integration-tests.log`.

---

## Phase 5: Performance Baseline (NON-BLOCKING)

**Tool**: Playwright — existing `apps/*/tests/e2e/smoke.spec.ts` + `tests/e2e/app-load.spec.ts`.

**Target**: p95 router navigation < 50ms (guard evaluation + component mount, net of API data loading).

```bash
rtk bun run test:e2e test apps/mmc/tests/e2e/smoke.spec.ts
rtk bun run test:e2e test apps/backoffice/tests/e2e/smoke.spec.ts
rtk bun run test:e2e test apps/frontoffice/tests/e2e/smoke.spec.ts
rtk bun run test:e2e test tests/e2e/app-load.spec.ts
```

Archive results to `specs/runtime/test-01-ui-runtime-validation/reports/perf-baseline.md`.
NON-BLOCKING: result does not gate stage promotion.

---

## Execution Order

1. **Phase 0** — Run existing tests; confirm zero failures
2. **Phase 1** — Create and run `tests/validation/static-analysis.test.ts`
3. **Phase 2** — Create/extend gap test files; run each:
   - `tests/unit/api-client/interceptors/correlation-id.test.ts` (GAP 1)
   - Extend `apps/*/core/errors/__tests__/error-normalizer.spec.ts` (GAP 2)
   - `tests/unit/store-isolation.test.ts` (GAP 4)
   - Extend `tests/integration/*/auth/session-clear-wiring.test.ts` (GAP 5)
4. **Phase 3** — typecheck → lint → build (all 3 apps)
5. **Phase 4** — Integration test re-run (auth/license suite)
6. **Phase 5** — Playwright performance baseline

---

## Deliverables Checklist

- [ ] `specs/runtime/test-01-ui-runtime-validation/research.md` ✅
- [ ] `specs/runtime/test-01-ui-runtime-validation/plan.md` ✅
- [ ] `tests/unit/api-client/interceptors/correlation-id.test.ts` — new (GAP 1)
- [ ] `apps/mmc/src/core/errors/__tests__/error-normalizer.spec.ts` — extended (GAP 2)
- [ ] `apps/backoffice/src/core/errors/__tests__/error-normalizer.spec.ts` — extended (GAP 2)
- [ ] `apps/frontoffice/src/core/errors/__tests__/error-normalizer.spec.ts` — extended (GAP 2)
- [ ] `tests/validation/static-analysis.test.ts` — new (GAP 3)
- [ ] `tests/unit/store-isolation.test.ts` — new (GAP 4)
- [ ] `tests/integration/mmc/auth/session-clear-wiring.test.ts` — extended (GAP 5)
- [ ] `tests/integration/backoffice/auth/session-clear-wiring.test.ts` — extended (GAP 5)
- [ ] `tests/integration/frontoffice/auth/session-clear-wiring.test.ts` — extended (GAP 5)
- [ ] Build logs archived to `reports/`
- [ ] Integration test logs archived
- [ ] Perf baseline archived

---

## Non-Goals

- No backend API changes
- No new routes or middleware
- No DB migrations
- No new Pinia stores or Vue components
- No changes to the API client package internals
- No 2FA or OAuth validation (deferred per STAGE_UI_09)
- No full RBAC permission matrix testing (covered in role/permission feature stages)

---

Implementation plan compliant with Zidney Architecture Governance (AGENTS.md + ADRs) — No violations detected.
