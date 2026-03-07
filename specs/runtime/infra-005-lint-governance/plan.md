# Technical Implementation Plan: Lint Governance

**Stage:** STAGE_INFRA_05_LINT_GOVERNANCE  
**Phase:** 01_PLATFORM_FOUNDATION  
**Feature:** `infra-005-lint-governance`  
**Spec:** `specs/runtime/infra-005-lint-governance/spec.md`  
**Research:** `specs/runtime/infra-005-lint-governance/research.md`  
**Status:** PLANNING  
**Branch:** `spec/infra-005-lint-governance`  
**Date:** 2026-03-07

---

## Overview

This plan activates and completes the lint governance layer for the Zidney monorepo. Based on the research phase, the platform is approximately 80% compliant. The primary work is:

1. One Biome rule change (`noUnreachable`: `warn` → `error`)
2. One CI workflow addition (AI-Guard gate in `ci.yml`)
3. One stale comment fix in the pre-commit hook
4. Developer and AI agent governance documentation

No new packages, no new scripts, no database or business logic changes.

---

## Constitution Check

| Rule                                   | This Stage        | Verdict |
| -------------------------------------- | ----------------- | ------- |
| No cross-tenant access introduced      | Not applicable    | ✅ PASS |
| No middleware bypass introduced        | Not applicable    | ✅ PASS |
| No grading logic moved outside worker  | Not applicable    | ✅ PASS |
| No direct DB instantiation introduced  | Not applicable    | ✅ PASS |
| No weakening of snapshot integrity     | Not applicable    | ✅ PASS |
| No weakening of transaction boundaries | Not applicable    | ✅ PASS |
| No weakening of version enforcement    | Not applicable    | ✅ PASS |
| No runtime dependency introduced       | ✅ devDeps only   | ✅ PASS |
| Layer separation unchanged             | ✅ Toolchain only | ✅ PASS |
| No business logic changes              | ✅ Confirmed      | ✅ PASS |

**Constitution verdict: APPROVED. All gates pass.**

---

## Implementation Gates

Before tasks.md execution begins:

- [x] `infra-004-biome` is COMPLETE (assumed per spec Assumption 1)
- [x] `biome.json` exists at root with `@biomejs/biome ^2.4.6`
- [x] `husky ^9.0.0` installed (`package.json` devDependencies confirmed)
- [x] `lint-staged ^15.0.0` installed (`package.json` devDependencies confirmed)
- [x] `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` exists
- [x] `docs/architecture/intelligence/ARCHITECTURE_MAP.json` exists
- [x] `.husky/pre-commit` exists with `bunx lint-staged` and `bun scripts/ai-guard.ts`
- [ ] Baseline lint violations must be resolved before `noUnreachable: error` is activated

**Pre-activation step:** Run `bun run lint:fix` across the full codebase before making the `noUnreachable` severity change. Any remaining unreachable code after auto-fix must be manually resolved or suppressed with a biome-ignore comment and rationale.

---

## Section 1: Biome Configuration Hardening

### 1.1 Required Change

**File:** `biome.json`  
**Change type:** Rule severity promotion

Promote `noUnreachable` from `warn` to `error`:

```json
// Current state:
"correctness": {
  "noUnusedImports": "error",
  "noUnreachable": "warn",       ← Change this
  "noPrecisionLoss": "warn",
  "noVueDuplicateKeys": "warn"
}

// Target state:
"correctness": {
  "noUnusedImports": "error",
  "noUnreachable": "error",      ← Promoted
  "noPrecisionLoss": "warn",
  "noVueDuplicateKeys": "warn"
}
```

**Rationale:** Unreachable code always signals a logic error — a dead branch, an incorrect early return, or a condition that can never be true. At `warn` level, developers can commit unreachable code without a hard block. At `error` level, the commit is blocked until the code is fixed or explicitly suppressed.

### 1.2 Rules That Do NOT Change

These rules are already correct per spec FR-01:

| Rule                        | Level   | Reason                                            |
| --------------------------- | ------- | ------------------------------------------------- |
| `noUnusedImports`           | `error` | Already correct                                   |
| `noDebugger`                | `error` | Already correct                                   |
| `noConsole`                 | `error` | Already correct (with overrides for logger/tests) |
| `useConst`                  | `error` | Already correct                                   |
| `noPrecisionLoss`           | `warn`  | Keep as-is per spec                               |
| `noImplicitAnyLet`          | `warn`  | Keep as-is per spec                               |
| `useIterableCallbackReturn` | `warn`  | Keep as-is per spec                               |

### 1.3 Rules That Do NOT Change (Overrides)

All existing overrides in `biome.json` are preserved without modification:

- `packages/logger/**`, `apps/worker/src/observability/structured-logger.ts`: `noConsole: off`
- Migration files (`apps/api/src/db/master/migrations/**`, `apps/api/src/db/tenant/migrations/**`): `noConsole: off`
- `scripts/**`: `noConsole: off`
- Test files (`tests/**`, `**/*.test.ts`, `**/*.spec.ts`): `noConsole: off`
- `**/*.vue`: `noUnusedImports: warn` (downgraded for Vue SFCs)

### 1.4 Import Organizer — Already Configured, Documentation Only

The import organizer is already active via:

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

**Canonical import order for the Zidney monorepo** (enforced automatically by Biome):

```
Group 1: Node.js built-ins
  import { readFileSync } from 'node:fs'
  import { execSync } from 'node:child_process'

Group 2: External packages
  import { Hono } from 'hono'
  import { z } from 'zod'
  import { drizzle } from 'drizzle-orm/...'

Group 3: Internal monorepo packages (@zidney/*)
  import { Logger } from '@zidney/logger'
  import type { Workspace } from '@zidney/types'

Group 4: App-local modules (non-relative)
  import { tenantResolver } from './core/tenant'
  import { licenseMiddleware } from './middleware/license'

Group 5: Relative imports
  import { helper } from '../utils'
  import type { LocalType } from './types'
```

Each group is separated by a blank line. Biome applies this ordering automatically when `bun run lint:fix` is run. No additional `biome.json` configuration is needed.

**How to fix import ordering:** Run `bun run lint:fix` on any file. Biome will sort and group imports automatically.

### 1.5 Baseline Validation Step (Pre-Change)

Before activating `noUnreachable: error`, run:

```sh
# Step 1: Auto-fix all formattable and fixable violations
bun run lint:fix

# Step 2: Check remaining violations that require manual fix
bun run lint

# Step 3: For each remaining 'noUnreachable' violation, either:
#   a) Remove the unreachable code
#   b) Add a biome-ignore comment with rationale:
#      // biome-ignore lint/correctness/noUnreachable: <reason>
```

**Expected scope:** Research indicates only a small number of `noUnreachable` warnings exist at baseline. The migration from `warn` to `error` should be low-friction.

---

## Section 2: lint-staged Configuration

### 2.1 Current State Assessment

**File:** `lint-staged.config.mjs`

```js
export default {
  '*.{ts,tsx,js,jsx,mjs,vue,json}': ['bun biome check --write'],
}
```

**Assessment: COMPLIANT — no changes required.**

This configuration exactly matches spec FR-04. The pattern covers all TypeScript, JavaScript, Vue, and JSON staged files. The `--write` flag enables auto-fix. The `bun` invocation is correct per the monorepo convention.

### 2.2 How lint-staged Works in This Context

When a developer runs `git commit`:

1. Git triggers `.husky/pre-commit`
2. `bunx lint-staged` is executed
3. lint-staged identifies all staged files matching `*.{ts,tsx,js,jsx,mjs,vue,json}`
4. For each matching staged file, `bun biome check --write <file>` runs
5. Biome auto-fixes formatting and safe lint issues
6. If any error-level violation remains after auto-fix, lint-staged exits non-zero
7. The commit is blocked; the developer sees the violation in their terminal

### 2.3 `--write` Behavior

The `--write` flag means:

- Formatting errors → auto-fixed, file re-staged
- Import ordering → auto-sorted, file re-staged
- Safe lint fixes (e.g., removing unused imports where safe) → auto-fixed
- Error-level violations that cannot be auto-fixed → reported, commit blocked

---

## Section 3: AI-Guard Activation

### 3.1 Current Activation Status

**AI-Guard is already fully active.** No script changes are needed.

The pre-commit hook (`.husky/pre-commit`) already runs:

```sh
bunx lint-staged
bun scripts/ai-guard.ts
bun scripts/infra-audit.ts --quick
```

`bun scripts/ai-guard.ts` is already executing on every commit.

### 3.2 What AI-Guard Validates

On each commit, AI-Guard reads `git diff --cached --name-only` to get staged `.ts`/`.tsx`/`.vue` files, then validates:

| Check                          | Rule Source                                | Exit on Failure |
| ------------------------------ | ------------------------------------------ | --------------- |
| Cross-app imports              | Hardcoded: `apps/*` → other `apps/*`       | exit(1)         |
| Package→App imports            | `ARCHITECTURE_CONTRACT.json`               | exit(1)         |
| Architecture map compliance    | `ARCHITECTURE_MAP.json`                    | exit(1)         |
| Forbidden dependency contract  | `ARCHITECTURE_CONTRACT.json`               | exit(1)         |
| Relative path leaks            | Import string analysis                     | exit(1)         |
| Branch naming (spec work only) | `spec/*` prefix when `specs/` files staged | exit(1)         |

### 3.3 Priority: Brain-Enriched vs. Contract-Only Mode

```
If docs/ai/context/ai-architecture-brain.json exists
  → Use brain module graph for dependency analysis (higher fidelity)
Else
  → Fall back to ARCHITECTURE_CONTRACT.json (sufficient for gate enforcement)
```

Both modes produce correct results. The degraded mode (no brain) still blocks violations.

### 3.4 Pre-Commit Hook Stale Comment Fix

**File:** `.husky/pre-commit`  
**Change:** Update the stale comment on line 4

```sh
# Current (stale):
# Runs ESLint --fix + Prettier --write on staged .ts/.tsx/.vue/.md/.json files.

# Updated:
# Runs Biome check --write on staged .ts/.tsx/.js/.jsx/.mjs/.vue/.json files.
```

This is a cosmetic documentation fix. It does not change hook behavior.

### 3.5 Emergency Override Procedure

If AI-Guard blocks a commit that is believed to be a false positive:

1. **First:** Verify the violation is actually a false positive by reviewing `ARCHITECTURE_MAP.json` and `ARCHITECTURE_CONTRACT.json`.
2. **If a rule is wrong:** Update `ARCHITECTURE_MAP.json` allowed/forbidden dependencies for the relevant module. Commit the map update first.
3. **As an absolute last resort only:** Use `git commit --no-verify` to bypass hooks temporarily. This creates a CI-detectable violation that MUST be fixed before merge.
4. **Never merge with an active AI-Guard bypass.** The CI gate in `architecture-governance.yml` and (after this stage) `ci.yml` will catch and block any bypass.

---

## Section 4: CI Quality Gate

### 4.1 Current State

The CI quality gate is split across two workflows:

| Workflow                      | Triggers                                                     | Gate Content                       |
| ----------------------------- | ------------------------------------------------------------ | ---------------------------------- |
| `ci.yml`                      | Push to `main/infra-*/feature-*/fix/*`; PR to `main/develop` | Lint + Typecheck                   |
| `architecture-governance.yml` | Push/PR to `main/develop` only                               | AI-Guard + Infra-Audit + Arch-Diff |

**Gap:** Pushes to `infra-*` and `feature/*` branches receive lint + typecheck but NOT the AI-Guard gate.

### 4.2 Required Change: Add AI-Guard Job to `ci.yml`

**File:** `.github/workflows/ci.yml`

Add a new job `arch-guard` that:

- Depends on `lint` and `typecheck` completing first (`needs: [lint, typecheck]`)
- Runs `bun scripts/ai-guard.ts`
- Is non-optional (no `continue-on-error`)
- Has a `timeout-minutes: 5` (AI-Guard is fast on staged file sets; full-repo scan in CI still finishes quickly)

**Placement in job dependency graph:**

```
lint ──┐
       ├──→ arch-guard ──→ unit-tests
typecheck ─┘
```

This ensures:

1. Lint passes before AI-Guard runs (prevent double noise)
2. AI-Guard passes before unit tests run (catch violations early)
3. All three gates are blocking for every branch type

### 4.3 New `arch-guard` Job Specification

```yaml
# ── Job 3. AI-Guard Architecture Gate ─────────────────────────────────────
arch-guard:
  name: 'AI-Guard — Architecture Boundaries'
  runs-on: ubuntu-latest
  timeout-minutes: 5
  needs:
    - lint
    - typecheck
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: ${{ env.BUN_VERSION }}

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Run AI-Guard architecture check
      run: bun scripts/ai-guard.ts
```

### 4.4 CI Command Sequence (Authoritative)

The canonical CI quality gate sequence is:

| Order | Command                   | Job in `ci.yml`     | Failure Behavior                        |
| ----- | ------------------------- | ------------------- | --------------------------------------- |
| 1     | `bun run lint`            | `lint`              | Fail; print Biome violations            |
| 2     | `bun run typecheck`       | `typecheck`         | Fail; print TypeScript errors           |
| 3     | `bun scripts/ai-guard.ts` | `arch-guard` (new)  | Fail; print architecture violations     |
| 4     | `bun run test:unit`       | `unit-tests`        | Fail; print test failures (needs 1+2+3) |
| 5     | Integration tests         | `integration-tests` | Fail; needs unit-tests                  |

### 4.5 Redundant Step Removal in `ci.yml` Lint Job

**Current lint job (problematic):**

```yaml
- name: Run Biome lint check
  run: bun biome check .

- name: Run Biome format check
  run: bun biome format .       ← REDUNDANT
```

`bun biome check .` already validates formatting. The separate `bun biome format .` step adds CI time with no value. Replace with the canonical script alias:

```yaml
- name: Run Biome lint + format check
  run: bun run lint
```

Using `bun run lint` (the script alias) is preferred over direct Biome invocation because:

1. The script alias is what developers run locally — CI/local parity
2. If the `lint` script ever changes, CI inherits it automatically
3. Eliminates the duplicate format step

### 4.6 `typecheck` vs `type-check` Naming

The spec and planning brief reference `bun run type-check`. The actual package.json script is `bun run typecheck` (no hyphen). The CI `typecheck` job already correctly uses `bun run typecheck:src` and `bun run typecheck:tests`.

**Resolution:** All documentation, spec, and CI references should use `bun run typecheck` (no hyphen). No package.json change is needed — the alias simply does not exist and should not be created to avoid confusion.

### 4.7 `architecture-governance.yml` — Overlap Assessment

The `architecture-governance.yml` workflow continues to run on PRs/pushes to `main`/`develop` and provides:

- `bun scripts/ai-guard.ts` (overlaps with new `arch-guard` job — acceptable duplication for defense-in-depth)
- `bun scripts/infra-audit.ts --ci` (full architecture audit — more comprehensive than AI-Guard alone)
- `bun scripts/architecture-diff.ts` (drift detection between commits)
- GitHub Step Summary publication

This workflow should NOT be modified. The `arch-guard` job in `ci.yml` adds coverage for non-main branches; the `architecture-governance.yml` provides the full audit for main branch PRs.

---

## Section 5: Root `package.json` Script Audit

### 5.1 All Required Scripts — Status

| Script            | Command                                                         | Present | Purpose                              |
| ----------------- | --------------------------------------------------------------- | ------- | ------------------------------------ |
| `lint`            | `bun biome check .`                                             | ✅ Yes  | Full-repo Biome lint + format check  |
| `lint:fix`        | `bun biome check --write .`                                     | ✅ Yes  | Auto-fix lint + format violations    |
| `typecheck`       | `bun typecheck:src && bun typecheck:tests`                      | ✅ Yes  | Full TypeScript type check           |
| `arch:audit`      | `bun scripts/infra-audit.ts`                                    | ✅ Yes  | Regenerate architecture intelligence |
| `arch:generate`   | `bun scripts/architecture/generate-architecture-map.ts`         | ✅ Yes  | Generate ARCHITECTURE_MAP.json       |
| `arch:add-module` | `bun scripts/architecture/add-module.ts`                        | ✅ Yes  | Register new module in map           |
| `arch:refresh`    | `bun scripts/infra-audit.ts && bun scripts/gitnexus-context.ts` | ✅ Yes  | Full refresh                         |
| `arch:fix`        | `bun scripts/infra-audit.ts --fix-map`                          | ✅ Yes  | Self-healing architecture map        |

**No new scripts are required.** All scripts needed by this stage are already present and correctly implemented.

### 5.2 Commands Reference for This Stage

| Task                           | Command                   |
| ------------------------------ | ------------------------- |
| Lint check (read-only)         | `bun run lint`            |
| Lint auto-fix                  | `bun run lint:fix`        |
| Type check (full)              | `bun run typecheck`       |
| Architecture gate (same as CI) | `bun scripts/ai-guard.ts` |
| Regenerate architecture brain  | `bun run arch:audit`      |
| Detect architecture drift      | `bun run arch:audit`      |

---

## Section 6: Module Ownership Documentation

### 6.1 Critical Infrastructure Packages

The following packages are designated **Critical Infrastructure** and require elevated care for any structural change:

| Package                | Layer          | Criticality    | Why Critical                                                                                                                                      |
| ---------------------- | -------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/types`       | domain         | core           | Shared TypeScript types used by every app and package. A breaking change here breaks the entire monorepo simultaneously.                          |
| `packages/domain-core` | domain         | core           | Contains all business logic: tenant resolution, migration execution, exam engine core. The highest blast-radius package in the system.            |
| `packages/validation`  | domain         | core           | Input validation used at API boundaries. A change here affects all validation logic across all routes.                                            |
| `packages/logger`      | infrastructure | infrastructure | Platform-wide structured logging dependency. Every service depends on it. Breaking the logger interface breaks observability across all services. |
| `packages/config`      | infrastructure | infrastructure | Centralized configuration management. All services read config from this package.                                                                 |

### 6.2 Machine-Readable Criticality

The `criticality` field in `docs/architecture/intelligence/ARCHITECTURE_MAP.json` already marks all five critical packages:

```json
"packages/types":        { "criticality": "core" }
"packages/domain-core":  { "criticality": "core" }
"packages/validation":   { "criticality": "core" }
"packages/logger":       { "criticality": "infrastructure" }
"packages/config":       { "criticality": "infrastructure" }
```

AI-Guard and `infra-audit.ts` can read these fields. No schema change is required.

### 6.3 Protection Policy for Critical Packages

Changes to **core**-criticality packages (types, domain-core, validation) require:

1. **AI-Guard passes** (automatically enforced at commit and CI).
2. **`bun run arch:audit` passes** (must be run manually after structural changes; also runs in `architecture-governance.yml` CI).
3. **Human architecture reviewer approval** — AI-generated changes to these modules must be explicitly flagged in the PR description: `CRITICAL PACKAGE CHANGE: packages/domain-core`.
4. **Backward compatibility confirmed** — if types or validation schemas change, all consuming packages must be verified.

Changes to **infrastructure**-criticality packages (logger, config) require:

1. AI-Guard passes (automatically enforced).
2. `bun run arch:audit` passes.
3. Review that all test suites still pass (interfaces must remain stable).

**Note:** CODEOWNERS file enforcement is deferred to a future governance stage (CL-02 clarification decision). The policy above is documentation-level enforcement for now.

### 6.4 Forbidden Dependencies for Critical Packages

The `ARCHITECTURE_MAP.json` declares the following forbidden dependencies for critical packages:

| Package                | Forbidden From Importing       |
| ---------------------- | ------------------------------ |
| `packages/types`       | `apps/*`                       |
| `packages/domain-core` | `apps/*`, `packages/ui-system` |
| `packages/validation`  | `apps/*`                       |
| `packages/logger`      | (none explicitly forbidden)    |
| `packages/config`      | (none explicitly forbidden)    |

These are enforced at commit time by AI-Guard.

---

## Section 7: Drift Prevention Strategy

### 7.1 Developer Authoritative Workflow

The canonical developer workflow for this codebase, enforced by governance tooling:

```
Step 1: Write code
  ↓
Step 2: git add <files> (stage changes)
  ↓
Step 3: git commit
  ↓ (triggers .husky/pre-commit)
  ├── Step 3a: bunx lint-staged
  │     → bun biome check --write on staged files
  │     → auto-fixes: formatting, import ordering, safe lint fixes
  │     → blocks: remaining error-level lint violations
  │
  ├── Step 3b: bun scripts/ai-guard.ts
  │     → validates staged files against ARCHITECTURE_CONTRACT.json
  │     → validates against ARCHITECTURE_MAP.json
  │     → blocks: cross-app imports, forbidden dependencies, relative leaks
  │
  └── Step 3c: bun scripts/infra-audit.ts --quick
        → quick structural governance check
        → blocks: structural governance violations
  ↓
Step 4: Commit recorded in local repository
  ↓
Step 5: git push
  ↓ (triggers .husky/pre-push, informational only)
  → Unit tests run (advisory — does not block push)
  ↓
Step 6: CI runs (GitHub Actions)
  ├── Job: lint       → bun run lint       (blocking)
  ├── Job: typecheck  → bun run typecheck  (blocking)
  ├── Job: arch-guard → bun scripts/ai-guard.ts (blocking)
  └── Job: unit-tests → bun run test:unit  (blocking, needs lint+typecheck+arch-guard)
  ↓
Step 7: PR reviewed and merged
  ↓ (triggers architecture-governance.yml on main/develop)
  ├── bun scripts/ai-guard.ts (full repo context)
  ├── bun scripts/infra-audit.ts --ci (full architecture intelligence regeneration)
  └── bun scripts/architecture-diff.ts (drift detection, published to Step Summary)
```

### 7.2 Pre-Drift Prevention (Proactive)

Before any significant refactor or new module introduction:

```sh
# 1. Refresh the architecture intelligence layer
bun run arch:audit

# 2. Verify the module is mapped correctly
# (check docs/architecture/intelligence/ARCHITECTURE_MAP.json)

# 3. For new modules, register them
bun run arch:add-module <module-path>

# 4. Run AI-Guard against the full staged set
bun scripts/ai-guard.ts
```

### 7.3 Drift Recovery Playbook

**When:** CI reports architecture drift | `bun run arch:audit` shows violations | Architecture intelligence files are stale

**Step-by-step recovery:**

```sh
# Step 1: Identify what drifted
bun run arch:audit
# → Produces docs/reports/infra-audit-report.json with detailed findings

# Step 2: View the architecture summary
cat docs/ai/context/ai-architecture-summary.md

# Step 3: If new modules are detected but unmapped
bun run arch:fix
# → Runs infra-audit.ts --fix-map to auto-register detected modules

# Step 4: If architecture brain is stale (AI-Guard running in fallback mode)
bun run arch:refresh
# → Runs infra-audit.ts AND gitnexus-context.ts for full refresh

# Step 5: Verify AI-Guard now runs in enriched mode
bun scripts/ai-guard.ts
# → Should see: "AI Guard: using ai-architecture-brain.json for rule validation."

# Step 6: Commit the refreshed architecture intelligence files
git add docs/architecture/ docs/ai/context/
git commit -m "chore: refresh architecture intelligence [arch-refresh]"
```

### 7.4 What Each Tool Detects at What Stage

| Tool                   | When Run           | What It Detects                                      |
| ---------------------- | ------------------ | ---------------------------------------------------- |
| Biome (lint-staged)    | Per commit         | Lint errors, formatting issues, import ordering      |
| AI-Guard               | Per commit + CI    | Cross-app imports, forbidden deps, relative leaks    |
| infra-audit --quick    | Per commit         | Structural governance (fast, no file writes)         |
| bun run lint (CI)      | Per PR/push        | Full-codebase Biome violations                       |
| bun run typecheck (CI) | Per PR/push        | TypeScript type errors across full monorepo          |
| AI-Guard (CI)          | Per PR/push        | Same as pre-commit but in CI environment             |
| infra-audit --ci       | PR to main/develop | Full architecture scan, generates intelligence files |
| architecture-diff      | PR to main/develop | Architectural drift between current and last commit  |

### 7.5 Governance Layer Summary Model

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 1: Biome                                                 │
│  Formatting · Lint Rules · Import Ordering                      │
│  ▸ pre-commit (lint-staged)  ▸ CI: bun run lint                 │
├─────────────────────────────────────────────────────────────────┤
│  Layer 2: AI-Guard                                              │
│  Architecture Boundaries · Module Ownership · Cross-App Imports │
│  ▸ pre-commit hook           ▸ CI: bun scripts/ai-guard.ts      │
├─────────────────────────────────────────────────────────────────┤
│  Layer 3: TypeScript                                            │
│  Type Safety · API Contract Compliance                          │
│  ▸ pre-push (advisory)       ▸ CI: bun run typecheck            │
├─────────────────────────────────────────────────────────────────┤
│  Layer 4: Infra Audit                                           │
│  Repository Health · Dependency Graph · Drift Detection         │
│  ▸ pre-commit (--quick)      ▸ CI: infra-audit --ci (main only) │
│  ▸ manual: bun run arch:audit                                   │
└─────────────────────────────────────────────────────────────────┘
```

Each layer is additive. A violation in any layer blocks the commit or CI run. Layers do not substitute for each other.

---

## Section 8: File-Level Change Manifest

The following files require changes in this stage. This manifest is the direct input for `tasks.md` generation.

### Files to MODIFY

| File                       | Change Type  | Description                                                                          |
| -------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| `biome.json`               | Rule change  | `noUnreachable`: `"warn"` → `"error"` (correctness section)                          |
| `.github/workflows/ci.yml` | New job      | Add `arch-guard` job after `typecheck`, before `unit-tests`                          |
| `.github/workflows/ci.yml` | Step change  | Replace redundant `bun biome check .` + `bun biome format .` with `bun run lint`     |
| `.husky/pre-commit`        | Comment only | Update stale comment from "ESLint --fix + Prettier --write" to "Biome check --write" |

### Files to CREATE

| File                                                      | Type          | Description                               |
| --------------------------------------------------------- | ------------- | ----------------------------------------- |
| `specs/runtime/infra-005-lint-governance/research.md`     | Research doc  | ✅ Already created during Phase 0         |
| `specs/runtime/infra-005-lint-governance/plan.md`         | Plan doc      | ✅ This file                              |
| `docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md` | Developer doc | Four-layer governance model documentation |

### Files to NOT MODIFY

| File                                                   | Reason                                                    |
| ------------------------------------------------------ | --------------------------------------------------------- |
| `lint-staged.config.mjs`                               | Already matches FR-04 exactly. No change needed.          |
| `scripts/ai-guard.ts`                                  | Fully implemented, active, and correct. No change needed. |
| `scripts/infra-audit.ts`                               | Not in scope for this stage.                              |
| `package.json`                                         | All required scripts exist. No change needed.             |
| `docs/architecture/intelligence/ARCHITECTURE_MAP.json` | Already correct with `criticality` field.                 |
| `.husky/pre-push`                                      | Advisory-only behavior preserved per FR-08.               |
| `apps/api/src/**`                                      | INFRA stage: no business logic changes.                   |
| `packages/domain-core/**`                              | INFRA stage: no business logic changes.                   |
| Any migration file                                     | INFRA stage: no schema changes.                           |

---

## Section 9: Acceptance Verification Checklist

After all changes are implemented, verify each acceptance criterion from the spec:

### FR-01 (Biome Rule Hardening)

- [ ] `bun run lint` exits 0 on a clean codebase
- [ ] Staging a file with unreachable code → `bun run lint` exits non-zero and prints `lint/correctness/noUnreachable`
- [ ] Existing overrides (logger, migrations, test files) still exempt from `noConsole`

### FR-02 (Import Order)

- [ ] Running `bun run lint:fix` on a file with out-of-order imports produces correctly ordered groups
- [ ] Running `bun run lint` on the same file exits 0 after fix

### FR-03 (AI-Guard Pre-Commit)

- [ ] Staging a file with a cross-app import and running `git commit` → blocked with violation message
- [ ] Staging a clean file and running `git commit` → AI-Guard passes, commit succeeds

### FR-04 (lint-staged)

- [ ] Staging a file with a lint violation and running `git commit` → blocked at lint-staged step

### FR-05 (CI Gate)

- [ ] Introducing a `noDebugger` violation in a test branch → `lint` CI job fails
- [ ] Introducing a TypeScript error → `typecheck` CI job fails
- [ ] Introducing a cross-app import → `arch-guard` CI job fails
- [ ] Clean branch → all three CI jobs pass

### FR-06 (Architecture Intelligence Validation)

- [ ] `docs/architecture/intelligence/ARCHITECTURE_MAP.json` exists
- [ ] `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` exists
- [ ] `bun scripts/ai-guard.ts` runs without fatal errors in both brain-enriched and fallback modes

### FR-07 (Module Ownership)

- [ ] Critical packages documented in this plan with rationale
- [ ] `ARCHITECTURE_MAP.json` has `criticality` field for each critical package

### FR-08 (Pre-Push Hook)

- [ ] `.husky/pre-push` runs without blocking push
- [ ] Advisory behavior confirmed (unit tests run informationally)

### FR-09 (Drift Prevention)

- [ ] `bun run arch:audit` completes without fatal errors

---

## Section 10: Risk Mitigation

| Risk                                                    | Mitigation Applied                                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Existing `noUnreachable` violations stall activation    | Run `bun run lint:fix` first; resolve remaining manually; use biome-ignore if needed               |
| AI-Guard false positive blocks legitimate commit        | Review `ARCHITECTURE_MAP.json`; update allowed deps if needed; use `--no-verify` as emergency only |
| AI-Guard running in fallback mode (no brain)            | Fallback mode is functional; run `bun run arch:audit` to regenerate brain                          |
| Developer bypasses hooks with `--no-verify`             | CI `arch-guard` job blocks at PR time regardless of local bypass                                   |
| CI `arch-guard` job slows PR pipeline                   | AI-Guard is fast (sub-5s for typical commits); timeout set to 5 minutes                            |
| Merge conflict in `ci.yml` when adding `arch-guard` job | The job is self-contained; add after existing `typecheck` job; update `unit-tests` `needs` array   |

---

## Section 11: Developer Documentation Output

Create `docs/01_ENGINEERING_GOVERNANCE/lint-governance-model.md` covering:

1. **What runs on every commit** (lint-staged Biome + AI-Guard + infra-audit --quick)
2. **What runs in CI** (bun run lint + bun run typecheck + bun scripts/ai-guard.ts)
3. **Import order convention** (the 5-group canonical order)
4. **How to fix a blocked commit** (auto-fix with `bun run lint:fix`, then resolve `ai-guard` violations)
5. **Critical package list** with protection policy
6. **How to recover from architecture drift** (`bun run arch:audit` → `bun run arch:fix`)
7. **Emergency override procedure** (when and how to use `--no-verify`)

---

## Summary of Design Decisions

| Decision                                    | Detail                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **One biome.json change only**              | `noUnreachable` → `error`. All other rules are already correct.                                           |
| **lint-staged unchanged**                   | Already FR-04 compliant.                                                                                  |
| **AI-Guard unchanged**                      | Fully implemented and already active.                                                                     |
| **CI gap closed via `ci.yml`**              | Adding `arch-guard` job to `ci.yml` ensures AI-Guard runs on ALL branch types, not only main/develop PRs. |
| **`architecture-governance.yml` unchanged** | It provides the full audit for main branch PRs. No modification needed.                                   |
| **Redundant CI step removed**               | `bun biome format .` removed from lint job; replaced with unified `bun run lint`.                         |
| **`typecheck` not `type-check`**            | Canonical command documented as `bun run typecheck` to match actual package.json script.                  |
| **No CODEOWNERS file**                      | Deferred per CL-02 clarification. Module ownership is documentation-only in this stage.                   |
| **`arch:audit` is advisory**                | Per CL-01 clarification. Not a blocking CI gate; used for maintenance and drift recovery.                 |
| **Pre-push hook remains advisory**          | Per FR-08. The pre-push hook is informational. CI provides the enforcement path.                          |
