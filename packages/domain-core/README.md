# @zidney/domain-core

## Purpose

Core business logic library for the Zidney platform. Contains all domain services as pure functions
organized by bounded context: authentication, tenant management, licenses, attempt engine, and RBAC
rule enforcement.

---

## Responsibilities

- **Authentication**: token issuance, verification, role extraction
- **Tenant management**: workspace resolution, connection pool lifecycle
- **License lifecycle**: state machine transitions (PENDING → ACTIVE → SOFT_LOCKED → ARCHIVED),
  limit enforcement
- **Attempt engine**: attempt creation with configuration snapshot, answer recording, submission
  idempotency
- **RBAC**: role-based access control rule evaluation (mmc_admin, institution_admin, staff, student)

---

## Dependencies

| Package              | Role                              |
| -------------------- | --------------------------------- |
| `@zidney/types`      | Shared TypeScript types and enums |
| `@zidney/logger`     | Structured logging                |
| `@zidney/validation` | Input validation schemas          |
| `zod`                | Runtime schema parsing            |
| `jsonwebtoken`       | JWT token operations              |
| `bcrypt`             | Password hashing                  |

---

## How to Run Tests

```bash
# From repo root
bun run vitest run --project domain-core

# From this directory
bun run test
```

---

## Environment Variables

Does not access environment variables directly — callers inject config dependencies.

---

## Known Boundaries

- **Pure functions only** — no HTTP handlers, no framework dependencies
- **No direct DB access** — receives a `PoolClient` or `QueryRunner` injected by the API layer
- **License state transitions are enforced here** — not in route handlers
- **Attempt configuration snapshot is immutable** — set at creation, never re-read from live exam
  config
- **Import rule**: may import from `packages/types`, `packages/logger`, `packages/validation`; must
  not import from `apps/*`

---

## Public API

```typescript
// Authentication
import { createAuthService } from "@zidney/domain-core/auth";
// → signToken, verifyToken, hashPassword, comparePassword

// License management
import { createLicenseService } from "@zidney/domain-core/licenses";
// → createLicense, softLock, archive, restore, validateLimits, transitionState

// Tenant resolution
import { createTenantResolver } from "@zidney/domain-core/tenants";
// → resolveBySlug, resolveById, getConnectionPool

// Attempt engine
import { createAttemptService } from "@zidney/domain-core/attempts";
// → startAttempt, recordAnswer, submitAttempt, finalizeAttempt

// RBAC
import { createRbacService } from "@zidney/domain-core/rbac";
// → can, assertCan, RbacPolicy, Role
```

**Exports**: all service factories above, plus corresponding TypeScript types for each domain.
