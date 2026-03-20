# packages/validation — AI Behavioral Contract

## Identity

Validation contains **Zod schemas** for input validation, shared across API, frontend, and domain layers.

## Ownership

- Zod schema definitions for all domain entities
- Request/response validation schemas
- Form validation schemas (shared between frontend and backend)
- Custom Zod refinements and transforms

## Non-Negotiable Rules

- **Zod only** — no custom validation frameworks
- **No business logic** — schemas validate shape, not business rules
- **No database imports** — validation is independent of persistence
- **No HTTP imports** — validation schemas are transport-agnostic
- **Schemas must be reusable** — same schema works on frontend and backend

## Import Rules

Allowed:

- `packages/types` — shared type definitions
- `zod` — validation library

Forbidden:

- `apps/*` — never import from application layer
- `packages/domain-core` — validation is consumed by domain, not the reverse
- `packages/logger`, `packages/redis-utils`, `packages/config`

## Patterns

- Export both the schema and its inferred TypeScript type: `export const MySchema = z.object({...}); export type MyType = z.infer<typeof MySchema>;`
- Use `.describe()` for human-readable field descriptions
- Tenant-scoped validations must accept `workspace_id` as a required field

## Verdict

```
VERDICT: BLOCKED — if validation schema imports business logic or database layer
```
