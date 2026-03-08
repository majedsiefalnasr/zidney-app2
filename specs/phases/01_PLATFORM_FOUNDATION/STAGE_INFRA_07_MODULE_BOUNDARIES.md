# STAGE_INFRA_07_MODULE_BOUNDARIES

## Purpose

Define **explicit module ownership and dependency boundaries** across the Zidney monorepo. This stage formalizes which modules may depend on others and introduces a machine‑readable boundary map used by AI‑Guard and Infra‑Audit.

The goal is to ensure that every module in the system has:

- a clear architectural role
- allowed dependency targets
- forbidden dependency zones

This prevents hidden coupling and protects Zidney’s layered architecture.

---

# Core Principle

Every module belongs to one architectural layer.

```
platform
runtime
ui
infrastructure
```

Modules may only depend **downwards or sideways**, never upwards.

---

# Monorepo Structure

Zidney uses a structured monorepo.

```
apps/
packages/
```

Applications:

```
apps/api
apps/worker
apps/mmc
apps/backoffice
apps/frontoffice
```

Packages:

```
packages/types
packages/logger
packages/config
packages/redis-utils
packages/ui-system
packages/api-client
packages/domain-core
packages/validation
```

Each module is assigned a **layer classification**.

---

# Layer Classification

## Infrastructure Layer

Provides cross‑system utilities.

Examples:

```
packages/logger
packages/config
packages/types
packages/redis-utils
```

Responsibilities:

```
logging
configuration
shared primitives
system utilities
```

Restrictions:

```
must not depend on apps
must not depend on UI
```

---

## Domain Layer

Contains reusable business logic.

Examples:

```
packages/domain-core
packages/validation
```

Responsibilities:

```
domain models
business rules
validation logic
```

Restrictions:

```
must not depend on UI
must not depend on applications
```

Allowed dependencies:

```
infrastructure
```

---

## Runtime Layer

Implements backend runtime services.

Examples:

```
apps/api
apps/worker
```

Responsibilities:

```
HTTP APIs
background jobs
runtime orchestration
```

Allowed dependencies:

```
domain
infrastructure
packages
```

Forbidden dependencies:

```
UI applications
UI packages
```

---

## UI Layer

Contains frontend applications.

Examples:

```
apps/mmc
apps/backoffice
apps/frontoffice
```

Responsibilities:

```
user interfaces
client logic
presentation layer
```

Allowed dependencies:

```
packages/ui-system
packages/api-client
infrastructure utilities
```

Forbidden dependencies:

```
runtime apps
server internals
```

---

# Dependency Matrix

Allowed dependency flow:

```
UI → packages/ui-system
UI → packages/api-client

Runtime → domain
Runtime → infrastructure

Domain → infrastructure

Infrastructure → none
```

Forbidden flows:

```
UI → runtime internals
runtime → UI
packages → apps
apps → apps
```

AI‑Guard validates this matrix automatically.

---

# Boundary Map (Machine Readable)

The boundary map should be stored in:

```
docs/architecture/module-boundaries.json
```

Example structure:

```
{
  "layers": {
    "infrastructure": [
      "packages/logger",
      "packages/config",
      "packages/types",
      "packages/redis-utils"
    ],

    "domain": [
      "packages/domain-core",
      "packages/validation"
    ],

    "runtime": [
      "apps/api",
      "apps/worker"
    ],

    "ui": [
      "apps/mmc",
      "apps/backoffice",
      "apps/frontoffice"
    ]
  }
}
```

Infra‑audit will validate imports against this map.

---

# AI‑Guard Enforcement

AI‑Guard reads the boundary map and verifies that code changes do not introduce violations.

Example violation detected:

```
apps/mmc importing apps/api internals
```

Example error output:

```
ARCHITECTURE VIOLATION
Layer: UI
Module: apps/mmc
Forbidden dependency: apps/api
```

The CI pipeline will fail if violations exist.

---

# CI Enforcement

Architecture boundary validation runs automatically during CI.

Pipeline stage order:

```
Biome
AI‑Guard
Architecture Guard
Module Boundary Validation
Infra Audit
Tests
```

---

# Developer Workflow

Developers do not manually manage boundaries.

Instead they run:

```
bun run ai-guard
```

The guard will automatically detect:

```
forbidden imports
layer violations
module ownership conflicts
```

---

# Architecture Evolution

When a new module is introduced:

1. Assign it a layer
2. Add it to the boundary map
3. Update AI‑Guard rules

Without this step CI will fail.

---

# Success Criteria

This stage is complete when:

- all modules are classified into layers
- boundary map exists
- AI‑Guard validates module imports
- CI blocks architecture violations

---

# Dependencies

This stage depends on:

```
STAGE_INFRA_05_LINT_GOVERNANCE
STAGE_INFRA_06_ARCHITECTURE_GUARD
```

These stages provide the enforcement infrastructure.

---

# Result

After this stage:

- every module has a defined architectural role
- forbidden dependencies are automatically blocked
- architecture drift becomes detectable
- AI‑generated code cannot break module boundaries

This stage finalizes the **architecture governance system for Zidney**.

---

## Stage Status

Status: DRAFT
Step: specify
Risk Level: LOW
Last Updated: 2026-03-08T00:00:00.000Z

Scope Defined:

- 13 modules classified into 4 architectural layers
- `docs/architecture/module-boundaries.json` to be produced
- `ai-guard.ts` extended to load and validate module boundaries
- CI `module-boundary-validation` step to be added
- New module onboarding workflow documented

Deferred Scope:

- No business logic changes (explicitly excluded)
- No new npm packages (explicitly excluded)
- No tenant/license/attempt engine changes (not applicable)

Constitutional Compliance:

- Specification drafted — constitutional audit pending

Notes:
Specification complete. Clarification step pending.
