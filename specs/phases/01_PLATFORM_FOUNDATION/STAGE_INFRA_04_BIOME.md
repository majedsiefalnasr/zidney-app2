# STAGE_INFRA_04_BIOME

## Purpose

Introduce **Biome** as the unified linting and formatting engine for the Zidney monorepo, replacing ESLint and Prettier. This stage establishes a deterministic, high‑performance code quality layer that integrates with AI‑Guard architecture enforcement and CI governance.

Biome provides:

- Linting
- Formatting
- Import hygiene
- Fast monorepo analysis

This stage ensures consistent code style, eliminates toolchain fragmentation, and prepares the platform for automated architecture governance.

---

## Stage Status

Status: PRODUCTION READY
Step: closure_complete
Risk Level: LOW
Closure Date: 2026-03-06T19:50:00.000Z

Implementation: COMPLETE
Tasks Completed: 45/45

Scope Delivered:

- ✅ Biome 2.4.6 unified toolchain at repository root
- ✅ 45 atomic tasks completed (T001–T045)
- ✅ All console.\* migrations complete (backend + biome-ignore for runners/bridges)
- ✅ lint-staged hook updated: `bun biome check --apply`
- ✅ CI lint job updated: Biome check + format-check
- ✅ Backoffice/frontoffice verification passed (T042)
- ✅ Documentation: README + TESTING_GUIDE.md + CLOSURE_REPORT.md
- ✅ Final gates: typecheck + test:unit both exit 0 (T044–T045)

Deferred Scope:

- Per-package biome.json overrides (explicitly excluded)
- Vue template syntax (not supported by Biome)
- Custom Biome rule authoring (future enhancement)

Constitutional Compliance:

- ✅ ADR-0001 (database-per-tenant): Preserved
- ✅ ADR-0006 (server-authoritative time): Preserved
- ✅ ADR-0008 (semantic versioning): Preserved
- ✅ All tenancy isolation rules: Maintained
- ✅ All middleware integrity rules: Maintained
- ✅ All logging compliance rules: Enforced

Guardian Verdicts:

- ✅ Zidney Architecture Checker: PASS
- ✅ Zidney Security Auditor: PASS
- ✅ Zidney Performance Optimizer: PASS
- ✅ Zidney QA Engineer: PASS
- ✅ Zidney Code Reviewer: PASS
- Zidney Performance Optimizer: PASS
- Zidney QA Engineer: PASS
- Zidney Code Reviewer: PASS (3rd pass after 2 remediation rounds)

Notes:
Full drift analysis passed. Implementation gate open.

---

# Objectives

1. Replace ESLint + Prettier with Biome.
2. Provide a **single formatting and linting engine** for the entire monorepo.
3. Integrate lint checks into CI.
4. Enforce deterministic formatting across all applications and packages.
5. Provide import hygiene rules that work alongside AI‑Guard.
6. Improve lint/format performance in local development and CI.

---

# Scope

Applies to:

```
apps/*
packages/*
tests/*
```

Languages supported:

```
TypeScript
JavaScript
TSX
JSX
JSON
```

Vue files are supported via embedded script analysis.

---

# Why Biome

Biome replaces several tools with one fast engine.

Previous stack:

```
ESLint
Prettier
eslint plugins
eslint configs
prettier plugins
```

New stack:

```
Biome
```

Benefits:

- faster CI
- fewer dependencies
- deterministic formatting
- simpler developer setup

Biome is written in Rust and optimized for large monorepos.

---

# Repository Impact

Removed:

```
ESLint
Prettier
eslint-plugin-* packages
prettier plugins
```

Added:

```
@biomejs/biome
```

Configuration:

```
biome.json
```

Located at the repository root.

---

# Root Configuration

Create the following configuration file.

```
biome.json
```

Example configuration:

```
{
  "$schema": "https://biomejs.dev/schemas/1.7.0/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "organizeImports": {
    "enabled": true
  }
}
```

---

# Lint Policy

Biome enforces the following rules:

```
noUnusedImports
noDebugger
noConsole
noDuplicateImports
useConst
```

Formatting is enforced automatically.

All commits must pass:

```
biome check .
```

---

# Import Hygiene

Biome organizes imports automatically.

Example transformation:

Before:

```
import z from "z"
import a from "a"
```

After:

```
import a from "a"
import z from "z"
```

This prevents style drift and improves diff clarity.

---

# Integration with AI‑Guard

Biome handles **syntax and style validation**.

AI‑Guard handles **architecture validation**.

Pipeline relationship:

```
Biome
↓
AI‑Guard
↓
Vitest
↓
Playwright
```

Biome ensures clean code before architecture validation runs.

Example scenario:

```
Invalid import style → Biome fails
Illegal module dependency → AI‑Guard fails
```

This creates two enforcement layers.

---

# CI Integration

CI must include the following steps.

```
biome check .
biome format --check .
```

Example CI snippet:

```
bun biome check .
bun biome format --check .
```

Build fails if formatting or linting rules are violated.

---

# Developer Workflow

Local commands:

Lint repository:

```
bun biome check .
```

Format repository:

```
bun biome format --write .
```

Recommended editor integration:

- VSCode Biome extension

This enables automatic formatting on save.

---

# Monorepo Strategy

Biome runs from the repository root.

It scans:

```
apps
packages
tests
```

No per‑package lint configuration is required.

This eliminates configuration drift between projects.

---

# Performance Impact

Expected improvement compared to ESLint + Prettier.

Typical results:

```
Lint + Format

Before: 20‑40 seconds
After: 2‑4 seconds
```

This significantly reduces CI latency.

---

# Migration Strategy

Migration steps:

1. Install Biome.
2. Create root configuration.
3. Remove ESLint configs.
4. Remove Prettier configs.
5. Update CI scripts.
6. Run repository formatting.

Example installation:

```
bun add -D @biomejs/biome
```

---

# Rollback Plan

If migration causes issues:

1. Restore ESLint configuration.
2. Restore Prettier configuration.
3. Remove Biome dependency.

Rollback is safe because this stage does not modify runtime code.

---

# Success Criteria

Stage is complete when:

- ESLint removed
- Prettier removed
- Biome config committed
- CI lint step passes
- repository formatted

---

# Dependencies

Required before this stage:

```
STAGE_INFRA_GOVERNANCE
```

Biome operates as part of the governance layer.

---

# Result

After this stage:

- the repository has a unified formatting and linting engine
- CI linting becomes significantly faster
- configuration complexity is reduced
- code formatting is deterministic

This stage prepares the platform for strict architecture governance in subsequent infrastructure stages.

---

# Production Biome Configuration (Zidney Monorepo)

The following configuration is recommended for the Zidney repository to ensure consistent behavior across all applications and packages.

File location:

```
biome.json
```

Recommended configuration:

```
{
  "$schema": "https://biomejs.dev/schemas/1.7.0/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noDebugger": "error",
        "noConsole": "warn"
      },
      "correctness": {
        "noUnusedVariables": "error",
        "noUnusedImports": "error"
      },
      "style": {
        "useConst": "error",
        "noVar": "error"
      }
    }
  },
  "files": {
    "ignore": [
      "node_modules",
      "dist",
      "build",
      ".turbo",
      "coverage"
    ]
  }
}
```

This configuration ensures:

```
consistent formatting
unused import detection
safe console usage
strict variable handling
fast monorepo scanning
```

---

# Test File Overrides

Test files may require relaxed rules.

Example override strategy:

```
tests/**/*.ts
apps/*/tests/**/*.ts
```

Recommended override behavior:

```
console usage allowed
longer test files permitted
```

Example override configuration:

```
{
  "overrides": [
    {
      "include": ["**/*.test.ts", "**/*.spec.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noConsole": "off"
          }
        }
      }
    }
  ]
}
```

---

# Import Classification Strategy

To maintain clarity across the monorepo, imports should follow this order:

```
1. Node built-ins
2. External dependencies
3. packages/*
4. apps/* local modules
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

Biome's import organizer helps enforce this structure automatically.

---

# CI Optimization

To maximize CI speed, Biome should run before tests:

```
biome check .
biome format --check .
```

Recommended CI order:

```
Biome
AI‑Guard
Infra Audit
Vitest
Playwright
```

Running Biome first ensures fast failure for formatting or lint issues before heavier test stages execute.

---

# AI‑Guard + Biome Boundary Enforcement

For maximum safety, Biome operates alongside AI‑Guard to enforce architectural integrity.

Biome focuses on:

```
syntax correctness
style rules
import hygiene
unused code detection
```

AI‑Guard focuses on:

```
module boundaries
layer enforcement
cross‑app dependency protection
architecture drift detection
```

Example violation:

```
apps/api importing apps/frontoffice
```

Biome may accept the code syntactically, but AI‑Guard rejects the change during architecture validation.

This dual‑layer enforcement ensures that AI‑generated or developer code cannot accidentally violate the platform architecture.

---

# Boundary Rule Strategy

Biome can provide **early feedback** for import misuse before AI‑Guard runs.

Example rule strategy:

```
apps/*
  cannot import apps/*

packages/domain-core
  cannot import ui-system

packages/*
  cannot import apps/*
```

Biome detects import misuse during development while AI‑Guard performs final validation in CI.

This creates a fast feedback loop for developers.

---

# Pre‑Commit Integration

To maintain repository consistency, Biome should run before commits.

Recommended setup:

```
husky
lint-staged
```

Example configuration:

```
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx,json}": [
      "biome check --apply"
    ]
  }
}
```

This ensures formatting and linting occur automatically before code enters the repository.

---

# Editor Integration

Developers should install the Biome extension in supported editors.

Recommended settings:

```
format on save
organize imports on save
```

This eliminates most formatting issues before commits occur.

---

# Governance Pipeline (Final Form)

After introducing Biome, the platform governance pipeline becomes:

```
Biome check
↓
AI‑Guard architecture validation
↓
Infra audit
↓
Vitest test suite
↓
Playwright E2E
```

Each layer protects a different aspect of the platform:

```
Biome → code correctness and formatting
AI‑Guard → architecture integrity
Infra audit → repository structure
Vitest → functional correctness
Playwright → user‑level behavior
```

This layered enforcement significantly reduces the probability of architectural regression.

---

# Long‑Term Maintenance

Biome configuration should be reviewed periodically when:

- new packages are introduced
- new languages are added
- architecture rules evolve

Updates should remain centralized in the root `biome.json` to maintain monorepo consistency.

---

# Future Enhancements

Potential improvements after this stage:

```
custom biome rules for Zidney architecture
automatic rule generation from AI‑Guard
monorepo import classification
```

These enhancements can further strengthen automated architecture governance.
