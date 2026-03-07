# STAGE_INFRA_05_LINT_GOVERNANCE

## Stage Status

Status: DRAFT
Step: tasks
Risk Level: LOW
Last Updated: 2026-03-07T00:04:00.000Z

Tasks Generated:

- Total: 21 atomic tasks
- Phase 1 — Baseline: 3 tasks (T001–T003)
- Phase 2 — Core Changes: 7 tasks (T004–T010)
- Phase 3 — Fix Violations: 2 tasks (T011–T012)
- Phase 4 — Validation: 9 tasks (T013–T021)

Deferred Scope:

- CODEOWNERS file enforcement (follow-up stage)
- arch:audit as CI-blocking step (advisory only)

Constitutional Compliance:

- Task set compliant — drift analysis required before implementation
- INFRA stage — no runtime, tenant, or middleware changes

Notes:
Atomic task set generated. Drift analysis gate pending.

---

## Purpose

Establish a strict lint governance layer for the Zidney monorepo. This stage defines how linting rules, architectural boundaries, and automated validation work together to prevent architecture drift and enforce consistent development practices.

Lint governance combines:

- Biome (code style and correctness)
- AI-Guard (architecture enforcement)
- CI validation

The goal is to make it extremely difficult for developers or AI-generated code to introduce architecture violations into the platform.

---

# Objectives

1. Enforce repository-wide lint standards.
2. Prevent cross-layer dependency violations.
3. Ensure consistent import patterns across the monorepo.
4. Block architecture violations during CI.
5. Provide fast feedback to developers during local development.

---

# Governance Layers

The lint governance model consists of multiple layers:

```
Biome
↓
AI-Guard
↓
Infra Audit
↓
Tests
```

Each layer protects a different aspect of the system.

Biome

- formatting
- lint rules
- import hygiene

AI-Guard

- architecture boundaries
- dependency validation
- module ownership

Infra Audit

- repository health
- dependency graph analysis

Tests

- behavioral correctness

---

# Monorepo Boundary Rules

The Zidney monorepo follows strict dependency rules.

```
apps/*
packages/*
```

General rules:

```
apps cannot import other apps
packages cannot import apps
packages must remain reusable
```

Allowed dependencies:

```
apps → packages
packages → packages
apps → local modules
```

Forbidden dependencies:

```
apps → apps
packages → apps
packages/domain-core → ui packages
```

Violations are detected by AI-Guard.

---

# Import Governance

To maintain clarity, imports must follow a consistent structure.

Import order:

```
1. Node built-ins
2. External dependencies
3. packages/*
4. apps local modules
5. relative imports
```

Example:

```
import fs from "node:fs"

import { z } from "zod"

import { Logger } from "@zidney/logger"

import { tenantResolver } from "@apps/api/core"

import { helper } from "./utils"
```

Biome organizes imports automatically.

---

# Architecture Boundary Enforcement

AI-Guard validates module boundaries using the dependency graph.

Example rule:

```
apps/api
  allowed:
    packages/*

  forbidden:
    apps/*
```

Example violation:

```
apps/api importing apps/frontoffice
```

CI will fail if this occurs.

---

# Module Ownership

Certain modules are considered critical platform infrastructure.

Examples:

```
packages/logger
packages/types
packages/domain-core
```

Changes to these modules should trigger stricter review policies.

Possible protections:

```
code owner review
architecture validation
extended CI checks
```

---

# AI-Generated Code Protection

AI-assisted development can introduce unintended architecture violations.

Lint governance mitigates this risk through automated validation.

Example scenario:

AI generates code importing UI logic into the API layer.

Biome may allow the syntax, but AI-Guard detects the boundary violation and blocks the change.

---

# Local Development Workflow

Developers should run lint checks before committing changes.

```
bun biome check .
```

Recommended workflow:

```
write code
↓
biome auto format
↓
biome lint check
↓
ai-guard validation
↓
commit
```

This ensures violations are detected early.

---

# CI Enforcement

CI must validate lint governance before running tests.

Recommended order:

```
biome check
biome format --check
ai-guard architecture validation
infra audit
vitest
playwright
```

Early failure reduces CI runtime.

---

# Automatic Architecture Detection

AI-Guard generates and validates the dependency graph for the repository.

Graph data includes:

```
module dependencies
centrality
risk analysis
layer violations
```

This allows automated detection of architectural drift.

---

# Drift Prevention

Architecture drift occurs when modules begin depending on layers they should not access.

Lint governance prevents drift by:

```
blocking forbidden imports
validating dependency graph
running architecture checks in CI
```

---

# Governance Success Criteria

This stage is considered complete when:

- lint rules enforced across repository
- import structure consistent
- architecture violations blocked in CI
- dependency boundaries validated automatically

---

# Dependencies

This stage depends on the completion of:

```
STAGE_INFRA_04_BIOME
STAGE_INFRA_GOVERNANCE
```

These stages provide the tooling and infrastructure needed for lint governance.

---

# Result

After this stage:

- lint governance is enforced across the monorepo
- architecture boundaries are protected
- developers receive early feedback for violations
- CI prevents architecture regressions

This stage significantly strengthens platform stability and prepares the repository for large-scale development.
