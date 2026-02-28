# Testing Guide — STAGE_UI_00_RUNTIME_ARCHITECTURE

**Stage:** STAGE_UI_00_RUNTIME_ARCHITECTURE  
**Phase:** 06_UI_APPLICATION_RUNTIME  
**Stage Directory:** `specs/runtime/ui-00-runtime-architecture/`  
**Generated On:** 2026-02-28

---

## Purpose

This guide explains how to validate the runtime architecture implementation for MMC, Backoffice, and Frontoffice Vue 3 apps. Share with QA engineers and reviewing developers before approving this PR.

---

## Summary of Delivered Behavior

This stage establishes the canonical SPA runtime architecture shared across three Vue 3 applications (MMC, Backoffice, Frontoffice). Each app has an identical core layer covering:

- Environment config loading from `import.meta.env`
- Error normalisation to a sealed `NormalizedError` type
- Token store (Pinia-based, reactive)
- API client with lazy getter pattern and idempotent token-refresh queue
- Route guard pipeline (auth + role + workspace guards)
- Vue Router with guard composition
- Application bootstrap with enforced boot order

Key outcomes:

- MMC reorganised from flat `src/components/` + `src/views/` into `src/modules/<domain>/` hierarchy
- Backoffice scaffolded from scratch with full core layer
- Frontoffice scaffolded from scratch with full core layer
- 196 unit tests added (MMC: 64, Backoffice: 70, Frontoffice: 62)
- No regressions to existing MMC dashboard functionality

---

## Prerequisites

| Requirement                   | Validation Command / Check                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| Bun installed                 | `bun --version` (v1.1+)                                                                       |
| Node.js installed             | `node --version` (v20+)                                                                       |
| Docker running                | `docker ps`                                                                                   |
| Correct branch checked out    | `git branch` shows `ui-00-runtime-architecture`                                               |
| Dependencies installed        | `bun install` from repo root                                                                  |
| `.env` files present for apps | `apps/mmc/.env`, `apps/backoffice/.env`, `apps/frontoffice/.env` — see `.env.example` in each |

Minimum required `.env` values per UI app:

```
VITE_API_BASE_URL=http://localhost:3000
VITE_WORKSPACE_SLUG=your-workspace-slug
```

---

## Files in Scope

```text
apps/mmc/
  src/core/config/env.ts
  src/core/errors/types.ts
  src/core/errors/error-normalizer.ts
  src/core/auth/token-store.ts
  src/core/auth/index.ts
  src/core/api/client.ts
  src/core/guards/auth.guard.ts
  src/core/guards/role.guard.ts
  src/core/guards/workspace.guard.ts
  src/core/router/index.ts
  src/core/state/index.ts
  src/main.ts
  src/modules/dashboard/
  src/modules/licenses/
  src/shared/
  tests/unit/core/ (9 test files, 64 tests)

apps/backoffice/
  src/core/ (identical structure, + workspace.guard.ts)
  src/main.ts
  tests/unit/core/ (10 test files, 70 tests)

apps/frontoffice/
  src/core/ (identical structure, no workspace.guard.ts)
  src/main.ts
  tests/unit/core/ (9 test files, 62 tests)

eslint.config.mjs         (root — ESLint v9 flat config)
tsconfig.json             (root — paths restored, UI apps + packages only)
tsconfig.test.json        (root — scoped to api/worker tests)
```

---

## Local Run Commands

```bash
# Install dependencies
bun install

# Start MMC (port 5173)
bun run dev:mmc

# Start API (port 3000)
bun run dev:api

# Start Worker
bun run dev:worker
```

Backoffice and Frontoffice each have their own dev scripts in `apps/backoffice/package.json` and `apps/frontoffice/package.json`:

```bash
bun --cwd apps/backoffice run dev   # port 5174
bun --cwd apps/frontoffice run dev  # port 5175
```

---

## Automated Validation Commands

### Typecheck (all three apps + packages, 0 errors expected)

```bash
# Root src typecheck
bunx tsc --noEmit

# Root test typecheck
bunx tsc --noEmit -p tsconfig.test.json

# Per-app typecheck
bunx tsc --noEmit -p apps/mmc/tsconfig.app.json
bunx tsc --noEmit -p apps/backoffice/tsconfig.app.json
bunx tsc --noEmit -p apps/frontoffice/tsconfig.app.json
```

Expected: all exit with code 0.

### Lint (0 errors expected)

```bash
# From repo root
bunx eslint "apps/mmc/src/**/*.ts" "apps/backoffice/src/**/*.ts" "apps/frontoffice/src/**/*.ts"
```

Expected: 0 errors. Pre-existing `no-console` and `@typescript-eslint/no-explicit-any` warnings are acceptable.

### Unit Tests (196 pass expected)

```bash
# MMC — 64 tests
bunx vitest run --config apps/mmc/vitest.config.ts

# Backoffice — 70 tests
bunx vitest run --config apps/backoffice/vitest.config.ts

# Frontoffice — 62 tests
bunx vitest run --config apps/frontoffice/vitest.config.ts
```

Expected: all 196 tests pass.

### Vite Builds (all succeed expected)

```bash
bun --cwd apps/mmc run build
bun --cwd apps/backoffice run build
bun --cwd apps/frontoffice run build
```

Expected: all complete without errors, output in respective `dist/` directories.

---

## Manual Test Scenarios

### Scenario 1 — Unauthenticated Redirect (Auth Guard)

**Purpose:** Verify that the `authGuard` redirects unauthenticated users to `/login` before accessing protected routes.

1. Start MMC: `bun run dev:mmc`
2. Open browser, navigate to `http://localhost:5173/dashboard`
3. Ensure no access token is present (open DevTools → Application → Cookies — clear any auth cookies)

Expected: Browser is redirected to `/login`. The dashboard content is never rendered.

Troubleshooting: If the redirect does not happen, check `apps/mmc/src/core/guards/auth.guard.ts` and confirm the guard is registered in `apps/mmc/src/core/router/index.ts` via `router.beforeEach`.

---

### Scenario 2 — Token Refresh Idempotency (API Client)

**Purpose:** Verify that simultaneous 401 responses do not trigger duplicate token refresh calls.

1. Open browser DevTools → Network tab
2. Log in to the dashboard
3. Expire the access token (manually clear it from cookies or wait for expiry)
4. Trigger multiple API calls simultaneously (e.g., switch tabs rapidly or reload a page with multiple data fetches)

Expected: Only **one** `POST /auth/refresh` request appears in the Network tab, regardless of how many concurrent 401 responses were received. All other requests resume after the single refresh resolves.

Troubleshooting: If multiple refresh requests appear, check `pendingRefresh` queue logic in `apps/mmc/src/core/api/client.ts`.

---

### Scenario 3 — Role Guard Enforcement (Edge Case)

**Purpose:** Verify that a user with an insufficient role cannot access role-protected routes.

1. Log in with a `viewer` role account
2. Attempt to navigate directly to a route configured with `meta.roles: ['admin']`

Expected: User is redirected to `/forbidden` (403 view). The protected route content is never rendered.

Troubleshooting: Check `apps/mmc/src/core/guards/role.guard.ts` and confirm `meta.roles` is set on the target route in `apps/mmc/src/modules/*/routes.ts`.

---

## Negative Cases

| Scenario                       | Trigger                                         | Expected Response                                               |
| ------------------------------ | ----------------------------------------------- | --------------------------------------------------------------- |
| Missing `VITE_API_BASE_URL`    | Remove env var and start app                    | App boot throws `AppConfigError`, refuses to mount              |
| Invalid env var format         | Set `VITE_API_BASE_URL=not-a-url`               | `loadEnvConfig()` throws validation error                       |
| 401 with expired refresh token | Refresh endpoint returns 401                    | `AUTH_REFRESH_FAILED` error, redirect to `/login`               |
| Network error on API call      | Disconnect network mid-request                  | `NormalizedError { code: 'NETWORK_ERROR', status: 0 }` returned |
| User accesses wrong workspace  | Workspace slug in URL does not match env config | `workspaceGuard` redirects to `/forbidden`                      |

---

## Tenant Isolation Note

This is a pure UI stage. No tenant database queries are made from the frontend. Tenant identity is derived from `VITE_WORKSPACE_SLUG` environment variable (set at build time per deployment). Cross-tenant isolation is enforced at the API layer — the UI simply scopes all requests to the configured workspace slug via the API base URL.

---

## Structured Log Verification

Frontend logs are minimal by design. Verify:

```bash
# In browser DevTools console — should see NO console.log calls from src/
# Only console.error is permitted at boot failure time
```

API and Worker logs (if running):

```bash
bun run dev:api | jq .  # Confirm correlation_id, workspace_slug present
```

---

## Sign-Off Checklist

- [ ] All 196 automated unit tests pass
- [ ] `tsc --noEmit` exits 0 (no type errors)
- [ ] `bunx eslint` exits 0 errors
- [ ] All 3 Vite builds complete
- [ ] Unauthenticated redirect works (Scenario 1)
- [ ] Token refresh deduplication works (Scenario 2)
- [ ] Role guard enforcement works (Scenario 3)
- [ ] No `console.log` visible in browser console from app source files
- [ ] App mounts correctly with valid `.env` values

---

## References

- `specs/runtime/ui-00-runtime-architecture/reports/IMPLEMENT_REPORT.md`
- `specs/runtime/ui-00-runtime-architecture/reports/PLAN_REPORT.md`
- `specs/runtime/ui-00-runtime-architecture/audits/VALIDATION_REPORT.md`
- `specs/runtime/ui-00-runtime-architecture/audits/ANALYZE_REPORT.md`

---

Generated by Zidney Orchestrator Hard Mode v1.2.0.
