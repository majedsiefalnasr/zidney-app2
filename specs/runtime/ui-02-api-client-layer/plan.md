# Implementation Plan: API Client Layer

**Branch**: `ui-02-api-client-layer` | **Date**: 2026-03-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/runtime/ui-02-api-client-layer/spec.md`

---

## Summary

Establish a centralized, typed HTTP client abstraction shared across MMC, Backoffice, and Frontoffice. The current codebase has **identical duplicated** `core/api/client.ts` and `core/errors/` in all three apps. This plan extracts the shared HTTP infrastructure into a new `packages/api-client` package, introduces an injectable `HttpAdapter` interface for testability, adds missing capabilities (AbortSignal, timeout, 429 retryAfter, isNetworkError), and converts each app's `core/api/` to thin configuration wrappers.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode)
**Primary Dependencies**: None (zero-dependency package; uses native `fetch` via injectable adapter)
**Storage**: N/A — pure HTTP transport layer
**Testing**: Vitest (workspace-level config already present)
**Target Platform**: Modern browsers (native `AbortController`, `crypto.randomUUID`)
**Project Type**: Shared monorepo package (`packages/api-client`)
**Performance Goals**: <5ms overhead per request (header construction + interceptor pipeline)
**Constraints**: JSON-only content type; 30s default timeout; no auto-retry on network errors
**Scale/Scope**: 3 consuming apps (MMC, Backoffice, Frontoffice), ~15 source files in package

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| #   | Constitutional Principle            | Status  | Evidence                                                                     |
| --- | ----------------------------------- | ------- | ---------------------------------------------------------------------------- |
| 1   | No database access from frontend    | ✅ PASS | Package is HTTP-only; no DB imports possible                                 |
| 2   | No business rule inference          | ✅ PASS | Client normalizes transport only; no rule evaluation                         |
| 3   | No license logic in frontend        | ✅ PASS | License errors (423, 403) passed through as AppError                         |
| 4   | No RBAC inference from JWT          | ✅ PASS | Client attaches JWT; never parses/decodes it                                 |
| 5   | All HTTP through single abstraction | ✅ PASS | FR-020 + lint rule enforces this                                             |
| 6   | Server-authoritative time only      | ✅ PASS | Client generates no timestamps                                               |
| 7   | Import boundaries                   | ✅ PASS | `packages/*` importable by `apps/*` per AGENTS.md                            |
| 8   | No cross-app imports                | ✅ PASS | Package has no app dependencies                                              |
| 9   | Frontend is rendering layer only    | ✅ PASS | Pure infrastructure; no business logic                                       |
| 10  | Tenant isolation preserved          | ✅ PASS | Workspace scoping handled by backend; client just routes to correct base URL |
| 11  | Strict separation of layers         | ✅ PASS | No domain logic in package                                                   |

**Gate Result**: ✅ ALL PASS — No violations, no justifications needed.

## Post-Design Constitution Re-Check

| #   | Check                                                             | Status |
| --- | ----------------------------------------------------------------- | ------ |
| 1   | HttpAdapter interface introduces no DB coupling                   | ✅     |
| 2   | AppError does not infer business meaning from error codes         | ✅     |
| 3   | Auth interceptor attaches token but never decodes JWT             | ✅     |
| 4   | Per-app configuration uses env.ts (no import.meta.env in package) | ✅     |
| 5   | No `any` types in public API surface                              | ✅     |
| 6   | Mock adapter enables testing without backend                      | ✅     |

**Post-Design Gate**: ✅ ALL PASS

## Project Structure

### Documentation (this feature)

```text
specs/runtime/ui-02-api-client-layer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-client.ts    # Public API contract (TypeScript interface)
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
packages/api-client/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts                # Barrel export
│   ├── client.ts               # createApiClient factory
│   ├── types.ts                # RequestConfig, ClientResponse, ClientConfig, HttpAdapter
│   ├── interceptors.ts         # Auth interceptor, correlation ID, idempotency, timeout
│   ├── http-error.ts           # AppError interface, error normalization pipeline
│   └── adapters/
│       ├── fetch-adapter.ts    # Production HttpAdapter (native fetch)
│       └── mock-adapter.ts     # Test HttpAdapter
└── tests/
    ├── client.test.ts
    ├── interceptors.test.ts
    ├── http-error.test.ts
    └── adapters/
        └── mock-adapter.test.ts

# Per-app thin wrappers (MODIFIED, not new):
apps/mmc/src/core/api/
├── client.ts                   # Configures @zidney/api-client with MMC env
└── index.ts                    # Re-exports for app consumption

apps/backoffice/src/core/api/
├── client.ts                   # Configures @zidney/api-client with Backoffice env
└── index.ts

apps/frontoffice/src/core/api/
├── client.ts                   # Configures @zidney/api-client with Frontoffice env
└── index.ts

# Per-app error normalization REMOVED (moved to packages/api-client):
# apps/*/src/core/errors/  → DELETE duplicated files

# ESLint config (MODIFIED):
eslint.config.mjs              # Add no-restricted-imports for fetch/axios
```

**Structure Decision**: New `packages/api-client` package chosen over extending `packages/ui-system` because:

1. `ui-system` is Vue-component-focused; HTTP client is framework-agnostic
2. Separate package enables independent versioning
3. Clean dependency graph: `packages/api-client` has zero dependencies
4. Aligns with existing monorepo pattern (`packages/types`, `packages/validation`, etc.)

## Complexity Tracking

> No constitution violations — table not required.

## Architecture Decisions

### AD-1: Package Location

**Decision**: `packages/api-client` (new package)
**Rationale**: HTTP client is framework-agnostic infrastructure. `packages/ui-system` is tightly coupled to Vue/shadcn. A dedicated package provides clean boundaries.
**Alternative rejected**: Embedding in `packages/ui-system` — would pollute a Vue-specific package with HTTP concerns.

### AD-2: HttpAdapter as Interface

**Decision**: Define `HttpAdapter` as a TypeScript interface with a single `execute(request): Promise<RawResponse>` method.
**Rationale**: Enables constructor injection of mock adapters for testing without any monkey-patching. Production uses `FetchAdapter`; tests use `MockAdapter`.
**Alternative rejected**: Passing `fetchFn` parameter (current approach) — insufficient abstraction; can't mock response headers, timeouts, or abort behavior cleanly.

### AD-3: Interceptor Pipeline as Functions

**Decision**: Interceptors are pure functions composed in a fixed pipeline order within `createApiClient`. Not a dynamic middleware chain.
**Rationale**: The interceptor set is known and fixed (auth, correlation, idempotency, timeout). Dynamic middleware adds complexity without benefit. Fixed pipeline is easier to test and reason about.
**Alternative rejected**: Express-style middleware chain — over-engineered for 4 fixed interceptors.

### AD-4: AppError as Plain Object

**Decision**: `AppError` is a plain TypeScript interface, not a class extending `Error`.
**Rationale**: Plain objects serialize cleanly, are structurally typed (no `instanceof` issues across module boundaries), and align with the existing `NormalizedError` pattern in the codebase.
**Alternative rejected**: `class AppError extends Error` — introduces prototype chain issues in monorepo, breaks structured clone, complicates serialization.

### AD-5: Per-App Configuration via Factory

**Decision**: Each app calls `createApiClient(config)` with its own `ClientConfig` derived from `env.ts`. No singleton in the package; singleton pattern lives in each app's `core/api/client.ts`.
**Rationale**: Apps own their lifecycle (Pinia init, router injection). Package provides the factory; app provides the configuration.

### AD-6: Correlation ID Generation

**Decision**: Client auto-generates a correlation ID (`crypto.randomUUID()`) for every request. Callers can override via `RequestConfig.correlationId`.
**Rationale**: Observability baseline with zero developer friction. Override capability preserves spec requirement (FR-017).
**Alternative rejected**: No auto-generation (spec says "optional") — missed observability for 99% of calls with no benefit.

### AD-7: Migration Strategy

**Decision**: Incremental migration. Package built first, then each app migrated one at a time. Old `core/api/client.ts` and `core/errors/` files replaced, not immediately deleted (renamed with `.deprecated` suffix during transition, then removed).
**Rationale**: Avoids big-bang breakage. Each app can be validated independently.
