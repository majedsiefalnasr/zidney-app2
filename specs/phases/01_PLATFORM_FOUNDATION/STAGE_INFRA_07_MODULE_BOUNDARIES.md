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

Status: PRODUCTION READY
Step: closure
Risk Level: LOW
Closure Date: 2025-07-18

Implementation: COMPLETE
Tasks: 26 / 26 completed
Closure: COMPLETE

Scope Delivered:

- docs/architecture/module-boundaries.json — 13 modules, 4 layers, dependency matrix, 4 cross-cutting rules
- scripts/ai-guard.ts — 5 exported functions: loadModuleBoundaries, loadTsAliases, resolveImportToModule, matchesGlobPattern, validateLayerBoundaries; wired into runGuard()
- scripts/infra-audit.ts — findUndeclaredModulesFromBoundaries() + import.meta.main guard
- tests/static/module-boundaries.test.ts — 7 static structure tests
- tests/unit/infra-audit/infra-audit-boundaries.test.ts — 8 FR-008 behavioral tests
- tests/unit/ai-guard/ai-guard-boundaries.test.ts — 28 unit tests (scenarios a–n)
- package.json — ai-guard and test:unit:boundaries scripts
- .github/workflows/ci.yml — module-boundary-validation step + Run module boundary unit tests step
- All 43 tests pass; lint clean; typecheck clean; ai-guard 0.4s
- Testing guide and PR summary generated

Deferred Scope:

- None — all 26 tasks complete. Pre-existing non-blocking observations recorded in VALIDATION_REPORT.md.

Constitutional Compliance:

- ADR-0001 Database-per-tenant isolation: PRESERVED (no DB code)
- ADR-0002 Snapshot immutability: PRESERVED (no attempt engine code)
- ADR-0006 Server-authoritative time: PRESERVED (no timing code)
- ADR-0007 Version compatibility: PRESERVED (no version code)
- ADR-0008 Semantic versioning: PRESERVED (no version bumps)
- ARCHITECTURE_MAP.json not modified (NFR-003 preserved)
- No new npm dependencies added (NFR-002 preserved)
- Implementation compliant with Zidney Constitution v1.2.0

Notes:
Production ready. No structural backend modifications allowed.
All 26 tasks delivered. 43 new tests. 3/3 pre-closure guardians PASS.
Modifications require a new infrastructure/governance stage.
