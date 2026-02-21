# STAGE 01 – Monorepo Setup

Phase: 1 – Platform Foundation
Status: Mandatory
Scope: Repository & Environment Structure Only
Freeze Level: Architectural Contract

---

## Stage Status

Status: BACKEND CLOSED  
Risk Level: LOW  
Closure Date: 2026-02-15

Scope Closed:

- Monorepo structure validated
- Bun workspaces operational
- Strict TypeScript enforced
- Import boundary rules enforced
- Docker infra baseline validated
- ESLint + pre-commit hooks active

Deferred Scope:

- None

Constitutional Compliance:

- Layer isolation enforced
- No cross-app imports
- No business logic introduced

Notes:
This stage is structurally frozen. Changes require architectural review.

---

## Objective

Establish a stable, scalable, AI-safe monorepo structure for Zidney.

This stage creates:

- Repository structure
- Strict workspace boundaries
- Layering enforcement
- Bun workspace configuration
- TypeScript baseline
- Docker infrastructure baseline
- Testing baseline
- Linting & discipline baseline

No business logic is implemented in this stage.

---

## Repository Structure

Repository must follow exactly:

```
zidney/
├── apps/
│ ├── api/ # Hono backend
│ ├── worker/ # Background job processor
│ ├── mmc/ # Platform dashboard (Vue)
│ ├── backoffice/ # Workspace dashboard (Vue)
│ └── frontoffice/ # Student portal (Vue)
│
├── packages/
│ ├── domain-core/ # Pure business logic (no DB)
│ ├── types/ # Shared TypeScript types
│ ├── validation/ # Zod schemas
│ ├── ui-system/ # Shared UI components
│ ├── redis-utils/ # Redis abstractions
│ └── config/ # Shared configuration utilities
│
├── docker/
├── specs/
├── docs/
├── AGENTS.md
├── tsconfig.base.json
├── bun.lockb
└── root configuration files
```

No deviation allowed.

---

## Workspace Management

Must use:

- Use Bun workspaces only
- Single lockfile: bun.lockb
- Shared dependency graph
- No pnpm
- No npm
- No per-app lockfiles

Apps must not maintain isolated dependency trees.

---

## Import Boundaries (Strictly Enforced)

Rules:

Apps may import from:

- packages/\*

Apps may NOT import from:

- other apps/\*

Packages may import from:

- other packages/\*

Packages may NOT import from:

- apps/\*

Violation = architectural failure.

---

## Layering Model (Frozen)

Strict layering must be enforced:

UI (Vue apps)
↓
API Layer (apps/api)
↓
Domain Layer (packages/domain-core)
↓
Infrastructure Layer (DB, Redis, External Services)

Rules:

- UI must NEVER import DB types
- UI must NEVER import database schema
- Domain must NOT depend on DB driver
- Domain must be pure TypeScript
- Validation schemas live in packages/validation
- DB access only inside apps/api

This separation is non-negotiable.

---

## TypeScript Baseline (Frozen)

Root tsconfig.base.json must include:

- “strict”: true
- “noImplicitAny”: true
- “strictNullChecks”: true
- “isolatedModules”: true
- “noUncheckedIndexedAccess”: true

Path aliases required:

```
@zidney/domain-core/_
@types/_
@zidney/validation/_
@zidney/ui/_
@zidney/config/\*
```

No deep relative imports across packages allowed.

---

## Docker Policy (Frozen)

Docker is mandatory for infrastructure only.

Docker must run:

- postgres (15+)
- redis (7+)
- pgbouncer
- nginx

API and worker may run:

- Inside Docker
  OR
- Directly via Bun for development

Production must use Docker for all services.

---

## Runtime Version Freeze

Environment must standardize:

- Bun: stable 1.x
- TypeScript: latest stable
- Postgres: 15+
- Redis: 7+
- Node compatibility not required (Bun runtime)

Version drift not allowed.

---

## Testing Baseline (Frozen)

Testing framework: Vitest

Rules:

- Every package must support unit tests
- apps/api must support integration tests
- Test folders:
  **tests**/

Coverage command must exist at root.

No business feature may merge without tests in later phases.

---

## ESLint & Formatting (Mandatory)

Must include:

- ESLint
- Prettier
- Import boundary rule
- No unused variables
- No circular dependencies
- No console.log in production code

Pre-commit hooks must:

- Run ESLint
- Run TypeScript type check
- Block commit on failure

---

## Database Baseline Structure

Prepare folder structure only:

```
apps/api/src/db/
├── master/
└── tenant/
```

Migration folders separated:

- master migrations
- tenant baseline template

No actual business schema yet.

---

## Worker Baseline

Worker must:

- Connect to Redis
- Process test job
- Log structured JSON output

No grading logic.
No provisioning logic yet.

---

## Environment Configuration

Root must include:

- .env.example
- Full variable documentation
- Separate dev / prod configuration

No hardcoded secrets allowed.

Secrets must not exist in repository.

---

## Validation Criteria

Stage is complete when:

- Repository structure matches spec
- Bun workspace functions
- Docker infra boots successfully
- Postgres reachable
- Redis reachable
- API boots
- Worker boots
- ESLint passes
- TypeScript passes
- Import rules enforced
- Vitest runs successfully

---

## Not Allowed In This Stage

- Business logic
- Multi-tenancy
- License engine
- Authentication
- Attempt engine
- UI business implementation
- Domain logic

This stage builds skeleton only.

---

## Stability Principle

If Stage 01 is weak,
all future phases will require refactoring.

This stage must be clean and frozen before proceeding to:

STAGE_02_MULTI_TENANCY_ARCHITECTURE
