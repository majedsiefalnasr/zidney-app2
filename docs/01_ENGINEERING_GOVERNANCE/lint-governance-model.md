# Lint Governance Model

**Stage:** STAGE_INFRA_05_LINT_GOVERNANCE  
**Phase:** 01_PLATFORM_FOUNDATION  
**Last Updated:** 2026-03-07  
**Status:** ACTIVE

---

## 1. Overview

This document defines the **lint governance model** for the Zidney monorepo. It establishes the four
enforcement layers that protect code quality, architectural boundaries, and structural integrity
across all workspaces — from the developer's local machine through to CI merge gates.

**Scope:** All files matching `*.{ts,tsx,js,jsx,mjs,vue,json}` in the monorepo.  
**Not in scope:** Vitest configuration, CODEOWNERS enforcement (deferred to a follow-up stage),
branch protection rules.

The governance model is designed to be **blocking by default**: violations at any layer halt the
commit or CI pipeline until resolved or explicitly suppressed with documented rationale.

---

## 2. Four Governance Layers

The lint governance pipeline operates in four ordered layers. Each layer has a distinct role and
trigger context.

| Layer | Name            | Role                                                                   | Primary Trigger                                            |
| ----- | --------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| **1** | **Biome**       | Syntax, formatting, lint rules, import ordering                        | `lint-staged` on commit / `bun run lint` in CI             |
| **2** | **AI-Guard**    | Architecture boundary enforcement, forbidden imports, layer violations | Pre-commit hook / `arch-guard` CI job                      |
| **3** | **Infra Audit** | Module registration, dependency graph integrity, undeclared modules    | Pre-commit hook (`--quick`) / `bun scripts/infra-audit.ts` |
| **4** | **Tests**       | Behavioral correctness, regression detection                           | CI: `unit-tests` → `integration-tests`                     |

**Dependency order:** Each layer is a prerequisite for the next. The CI gate sequence enforces this
order:

```
lint → typecheck → arch-guard → unit-tests → integration-tests
```

---

## 3. Biome Configuration

Biome is the primary formatter and linter for all TypeScript, JavaScript, Vue, and JSON files in the
monorepo.

**Configuration file:** `biome.json` (repo root)  
**Biome version:** `@biomejs/biome ^2.4.6`

### Critical rules (error level — blocks commit and CI)

| Rule              | Category    | Level   | Rationale                                                                                 |
| ----------------- | ----------- | ------- | ----------------------------------------------------------------------------------------- |
| `noUnusedImports` | correctness | `error` | Unused imports indicate dead code or incorrect refactors                                  |
| `noUnreachable`   | correctness | `error` | Unreachable code always indicates a logic error                                           |
| `noDebugger`      | suspicious  | `error` | Debugger statements must never reach production                                           |
| `noConsole`       | suspicious  | `error` | All logging must use the structured logger (overrides apply for logger package and tests) |
| `useConst`        | style       | `error` | Mutation via `let` where `const` suffices indicates poor intent                           |

### Warning-level rules (visible but non-blocking)

| Rule                        | Category    | Level  |
| --------------------------- | ----------- | ------ |
| `noPrecisionLoss`           | correctness | `warn` |
| `noVueDuplicateKeys`        | correctness | `warn` |
| `useIterableCallbackReturn` | suspicious  | `warn` |
| `noImplicitAnyLet`          | suspicious  | `warn` |
| `noExportsInTest`           | suspicious  | `warn` |
| `noAssignInExpressions`     | suspicious  | `warn` |

### Import organizer

```json
"assist": {
  "enabled": true,
  "actions": {
    "source": {
      "organizeImports": "on"
    }
  }
}
```

The import organizer is active and runs automatically during `bun run lint:fix`. See **Section 4**
for the canonical import order.

### Overrides

- `packages/logger/**`, migration files, `scripts/**`: `noConsole` is `off`
- `tests/**`, `*.test.ts`, `*.spec.ts`: `noConsole` is `off`
- `**/*.vue`: `noUnusedImports` is `warn` (not `error`) due to Vue template binding patterns

---

## 4. Import Order Convention

Zidney enforces a **5-group canonical import order**. Biome's import organizer enforces this
automatically. A blank line must separate each group.

| Group | Description                      | Examples                                     |
| ----- | -------------------------------- | -------------------------------------------- |
| **1** | Node.js built-ins                | `node:fs`, `node:path`, `node:crypto`        |
| **2** | External packages                | `hono`, `drizzle-orm`, `zod`, `vue`          |
| **3** | `@zidney/*` internal packages    | `@zidney/types`, `@zidney/domain-core`       |
| **4** | App-local modules (non-relative) | `~/composables/useAuth`, `@/services/tenant` |
| **5** | Relative imports                 | `./utils`, `../models/user`, `../../shared`  |

### Code example (correct)

```typescript
// Group 1 — Node built-ins
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Group 2 — External packages
import { Hono } from "hono";
import { z } from "zod";

// Group 3 — @zidney/* internal
import type { Workspace } from "@zidney/types";
import { validateAttempt } from "@zidney/domain-core";

// Group 4 — App-local
import { tenantResolver } from "~/middleware/tenant";

// Group 5 — Relative
import { formatDate } from "./utils";
import type { AttemptRow } from "../models";
```

### How to auto-fix

```bash
bun run lint:fix
```

This applies Biome's import organizer across all staged files (pre-commit) or the full monorepo
(manual run).

---

## 5. Module Ownership: Critical Infrastructure Packages

The following packages are designated **critical infrastructure** in `ARCHITECTURE_MAP.json`. They
underpin the entire platform and have the highest blast radius for any change.

| Package                | Layer          | Criticality Tier | ARCHITECTURE_MAP field          |
| ---------------------- | -------------- | ---------------- | ------------------------------- |
| `packages/domain-core` | Domain         | `core`           | `criticality: "core"`           |
| `packages/types`       | Shared         | `core`           | `criticality: "core"`           |
| `packages/validation`  | Shared         | `core`           | `criticality: "core"`           |
| `packages/logger`      | Infrastructure | `infrastructure` | `criticality: "infrastructure"` |
| `packages/config`      | Infrastructure | `infrastructure` | `criticality: "infrastructure"` |

**Policy:** Changes to any `core`-criticality package require:

1. Explicit review against all dependent modules (use `bun run arch:audit` to identify dependents)
2. AI-Guard must pass after the change
3. Full unit test suite must pass

Changes to `infrastructure`-criticality packages follow the same process.

**Machine-readable reference:** `docs/architecture/intelligence/ARCHITECTURE_MAP.json` — see the
`criticality` field per module entry.

---

## 6. Developer Commit Workflow

The complete local governance pipeline fires automatically on every `git commit`:

1. **Write code** — implement feature or fix
2. **`git add <files>`** — stage changes
3. **`git commit -m "..."`** — triggers Husky pre-commit hook
4. **`lint-staged` fires** — Biome `--write` runs on staged files only; formatting and safe lint
   fixes applied automatically; commit blocked if errors remain after auto-fix
5. **AI-Guard fires** — `bun scripts/ai-guard.ts` validates architecture boundaries; commit blocked
   if violations detected
6. **Infra Audit fires** — `bun scripts/infra-audit.ts --quick` checks module registration and
   structural integrity; commit blocked if violations detected
7. **Commit recorded** — all hooks passed; commit object created
8. **`git push`** — triggers CI pipeline
9. **CI gates execute in sequence:**
   - `lint` — `bun run lint` (full monorepo)
   - `typecheck` — `bun run typecheck`
   - `arch-guard` — `bun scripts/ai-guard.ts`
   - `unit-tests` — `bun run test:unit`
   - `integration-tests` — `bun run test:integration`
10. **Merge allowed** — only after all CI gates pass

---

## 7. Emergency Override Procedure

In rare circumstances, a developer may need to bypass the pre-commit hooks:

```bash
git commit --no-verify -m "emergency: <short description>"
```

> **WARNING — READ BEFORE USE:**
>
> (a) **CI will still catch the violation.** `--no-verify` only skips local hooks. The `arch-guard`
> job in CI will run on every push and will block the PR merge if any architecture violation exists.
>
> (b) **Merge is blocked if CI fails.** A squash or merge commit cannot be created while the
> `arch-guard` CI job is failing. The violation must be resolved before the PR can be merged.
>
> (c) **`--no-verify` must never be used to permanently bypass architectural violations.** Its only
> valid use is to unblock a developer when the local hook environment is broken (e.g., Bun not
> found, script syntax error, CI environment mismatch). The violation must be resolved in a
> follow-up commit before the PR is merged.

Using `--no-verify` to bypass an architectural violation and land it in `main` is a **governance
failure** and must be escalated to the platform team immediately.

---

## 8. CI Gate Sequence

All CI gates are **blocking**. A job cannot start until all its `needs` dependencies have passed.

| Order | Job                 | Command                    | Needs                             | Blocks                                     |
| ----- | ------------------- | -------------------------- | --------------------------------- | ------------------------------------------ |
| 1     | `lint`              | `bun run lint`             | —                                 | `arch-guard`                               |
| 2     | `typecheck`         | `bun run typecheck`        | —                                 | `arch-guard`                               |
| 3     | `arch-guard`        | `bun scripts/ai-guard.ts`  | `lint`, `typecheck`               | `unit-tests`, `integration-tests`          |
| 4     | `unit-tests`        | `bun run test:unit`        | `lint`, `typecheck`, `arch-guard` | `integration-tests`, `coverage-validation` |
| 5     | `integration-tests` | `bun run test:integration` | `unit-tests`, `arch-guard`        | E2E jobs                                   |

**Drift Recovery Playbook** — if architecture drift is detected (AI-Guard or Infra Audit fails):

1. **Identify drift:** `bun run arch:audit` — lists unmapped modules and layer violations
2. **Auto-register new modules:** `bun run arch:fix` — registers any newly detected modules in
   `ARCHITECTURE_MAP.json`
3. **Full refresh:** `bun run arch:refresh` — regenerates the full architecture intelligence layer
4. **Verify AI-Guard:** `bun scripts/ai-guard.ts` — confirm enriched mode runs without errors
5. **Commit refreshed artifacts:**
   `git add docs/architecture/intelligence/ && git commit -m "chore: refresh architecture intelligence layer"`
6. **Push and confirm CI passes:** Verify `arch-guard` job succeeds in CI

> If after running the playbook AI-Guard still fails, escalate to the platform team. Do not merge
> with a failing `arch-guard` gate.
