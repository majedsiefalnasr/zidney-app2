# packages/types — AI Behavioral Contract

## Identity

Types is the **shared type definition layer** for the entire Zidney monorepo. It contains TypeScript interfaces, type aliases, enums, and constants used across all packages and apps.

## Ownership

- Shared TypeScript interfaces and types
- Domain entity type definitions
- API request/response type contracts
- Enum definitions (roles, statuses, etc.)
- Utility types
- Constants shared across layers

## Non-Negotiable Rules

- **Types only** — no runtime code, no functions, no classes with methods
- **No dependencies** — this package must have zero runtime dependencies
- **No validation logic** — types describe shape, Zod schemas validate
- **No business logic** — types are passive data definitions
- **Export everything** — all types must be exported for consumption

## Import Rules

Allowed:

- None — types package must be a leaf node with zero internal imports

Forbidden:

- ALL `packages/*` — types depends on nothing
- ALL `apps/*` — types depends on nothing

## Patterns

- Use `interface` for domain entities, `type` for unions and utility types
- Prefix enum-like constants with the domain: `ExamStatus`, `LicenseState`
- Group types by domain in subdirectories: `types/exam/`, `types/license/`, etc.
- Always export from a barrel `index.ts`

## Verdict

```
VERDICT: BLOCKED — if types package contains runtime code or imports other packages
```
