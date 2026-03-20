# packages/domain-core — AI Behavioral Contract

## Identity

Domain Core is the **business logic layer** of Zidney. It contains pure domain functions, entity definitions, and business rules that are shared across all applications.

## Trust Chain Position

This package sits at the **domain layer** — below the API layer, above database schemas.

## Ownership

- Entity type definitions and domain interfaces
- Business rule implementations (pure functions)
- Domain event definitions
- Grading logic and scoring algorithms
- License enforcement logic
- Attempt lifecycle rules

## Non-Negotiable Rules

- **Pure functions only** — no HTTP, no framework dependencies, no side effects
- **No database imports** — domain-core must NOT import Drizzle schemas, SQL builders, or connection logic
- **No environment variables** — no `process.env` or `Bun.env` access
- **No Redis/cache imports** — caching is an infrastructure concern
- **No logging side effects** — domain functions return results, callers handle logging
- **No tenant resolver access** — tenant context is passed as parameters, never imported

## Import Rules

Allowed:

- `packages/types` — shared type definitions
- `packages/validation` — Zod schemas for input validation

Forbidden:

- `apps/*` — never import from application layer
- `packages/logger` — no logging side effects in domain logic
- `packages/redis-utils` — no infrastructure concerns
- `packages/api-client` — no HTTP concerns
- `packages/job-queue` — no worker concerns
- `packages/config` — no environment/config access

## Patterns

- All business rules must be testable in isolation (no mocks for external services)
- Entity creation must go through factory functions
- Domain errors must use typed error classes, not string throws
- Grading logic must be deterministic given the same inputs
- Attempt-related logic must enforce snapshot immutability

## Verdict

If AI-generated code in this package imports from forbidden sources or introduces side effects:

```
VERDICT: BLOCKED — Domain purity violation
```
