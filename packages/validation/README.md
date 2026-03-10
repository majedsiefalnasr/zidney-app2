# @zidney/validation

## Purpose

Zod-based request validation schema library for the Zidney platform. Centralizes all API input
schemas so they can be shared between the API layer (for request parsing) and front-end stores (for
pre-flight validation).

---

## Responsibilities

- Define Zod schemas for all API request bodies and query parameters
- Export inferred TypeScript types from each schema
- Provide reusable sub-schemas (pagination, date ranges, workspace slug, UUIDs)
- Ensure consistent error messages and field-level validation feedback

---

## Dependencies

| Package         | Role                                     |
| --------------- | ---------------------------------------- |
| `zod`           | Schema definition and runtime validation |
| `@zidney/types` | Shared enums used in schema definitions  |

---

## How to Run Tests

```bash
# From repo root
bun run vitest run --project validation

# From this directory
bun run test
```

---

## Environment Variables

None.

---

## Known Boundaries

- **No HTTP logic** — schemas are pure Zod definitions; parsing is the caller's responsibility
- Does not contain database queries or domain logic
- May be imported by both `apps/api` (backend) and `apps/*/` (frontend) without circular deps
- **Import rule**: may import from `packages/types`; must not import from `apps/*`

---

## Public API

```typescript
import {
  createLicenseSchema,
  updateLimitsSchema,
  softLockSchema,
  paginationSchema,
  workspaceSlugSchema,
  startAttemptSchema,
  submitAttemptSchema,
} from "@zidney/validation";
import type { CreateLicenseInput, UpdateLimitsInput, PaginationParams } from "@zidney/validation";

// Parse and validate a request body
const result = createLicenseSchema.safeParse(requestBody);
if (!result.success) {
  return {
    success: false,
    error: { code: "VALIDATION_ERROR", message: result.error.message },
  };
}
const input: CreateLicenseInput = result.data;
```

**Exports**: All schema objects (suffixed `Schema`) and their inferred `Input` / `Params` types.
