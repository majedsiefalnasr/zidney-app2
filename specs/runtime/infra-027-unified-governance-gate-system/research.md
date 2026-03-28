# Research: Unified Governance Gate System

**Stage:** INFRA-27
**Date:** 2026-03-25

---

## 1 — Existing `scripts/governance/` Directory

```
scripts/governance/
├── core/
│   └── governance-validator.ts   ← shared utility (see §4)
├── type-safety-guard.ts          ← validates TS for any-patterns
└── validate-architecture-brain.ts ← validates ai-architecture-brain.json
```

The three files mandated by FR-005 (`gate.ts`, `gate-ci.ts`, `report.ts`) **do not exist**.

The existing files are support utilities and guard runners. They use JSDoc-style headers (no 5-field
`@script` metadata). They are already wired into the pre-commit hook and `package.json`.

---

## 2 — Current State of `.husky/pre-commit`

The hook runs the following in order:

1. **Bail if nothing staged** — exits early if `$STAGED_FILES` is empty
2. **lint-staged** — Biome check --write via `bunx lint-staged`
3. **TypeScript incremental** — `bunx tsc --noEmit --skipLibCheck` (only if `*.ts`/`*.tsx` staged)
4. **Architecture Guard** — `bun scripts/ai-guard.ts` (only if code files staged: `.ts .tsx .js .jsx .mjs .vue`)
5. **Architecture Brain validation** — `bun scripts/governance/validate-architecture-brain.ts` (only if `docs/ai/context/ai-architecture-brain.json` staged); supports exit code 2 (warnings)
6. **Trivy dependency scan** — `bun run infra:security:deps` (unconditional; aborts if `trivy` not installed)
7. **Trivy secret scan** — `bun run infra:security:secrets --staged` (unconditional)
8. Echo `✔ Pre-commit checks passed`

**Integration point for FR-007:** The new `bun run governance:gate:changed` line MUST be inserted
**after step 7** (Trivy secret scan) and **before** the final echo at step 8.

The hook already uses `set -e` globally. Individual check blocks use `|| { … exit 1 }` for explicit
error messages.

---

## 3 — Current State of `.github/workflows/architecture-governance.yml`

Workflow: `Zidney Architecture Governance`
Triggers: `pull_request` (main, develop), `push` (main, develop), nightly schedule `0 2 * * *`

| Step | Name                                 | Command                                          |
| ---- | ------------------------------------ | ------------------------------------------------ |
| 1    | Checkout repository                  | `actions/checkout@v4`                            |
| 2    | Setup Bun                            | `oven-sh/setup-bun@v2` (1.3.11)                  |
| 3    | Install dependencies                 | `bun install`                                    |
| 4    | Verify AI Bootstrap Exists           | `[ -f docs/ai/AI_BOOTSTRAP.md ]`                 |
| 5    | Run Zidney AI Guard                  | `bun scripts/ai-guard.ts`                        |
| 6    | Run Infrastructure Audit             | `bun scripts/infra-audit.ts --ci`                |
| 7    | Run Architecture Diff                | `bun scripts/architecture-diff.ts`               |
| 8    | Run Architecture Health              | `bun run arch:health:ci`                         |
| 9    | Upload Architecture Health Artifacts | `actions/upload-artifact@v4` (always)            |
| 10   | Publish Architecture Summary         | shell summary to `$GITHUB_STEP_SUMMARY` (always) |
| 11   | Run AI Execution Validation          | `bun ai:validate --ci`                           |
| 12   | Upload AI Execution Artifact         | `actions/upload-artifact@v4` (always)            |
| 13   | Publish AI Execution Summary         | shell summary to `$GITHUB_STEP_SUMMARY` (always) |
| 14   | Validate Script Naming Convention    | `bun run validate:scripts:naming`                |
| 15   | Validate Script Usages               | `bun run validate:scripts:usage`                 |
| 16   | Validate Script Infrastructure       | `bun run validate:scripts:infrastructure`        |
| 17   | Verify Script Registry Generation    | `bun run dev:generate:script-docs`               |

**Total: 17 steps. No "Unified Governance Gate" step exists.**

**Integration point for FR-008:** New step goes after step 17 as step 18 (no existing steps to
displace). No conditional `if: always()` — the step must fail the workflow on non-zero exit.

---

## 4 — `core/governance-validator.ts` Reusability Assessment

**Verdict: NOT reusable for gate orchestration. Read-only utility.**

Exports:

- `TypeSafetyPatterns` — regex patterns for `any` detection
- `matchesTypeSafetyPattern()` / `findTypeSafetyViolations()` — line-level TS violation detection
- `isValidModulePath()` / `validateModulePath()` — module path format validation
- `validateArchitectureEdge()` — validates edges in `ai-architecture-brain.json`
- `EdgeValidationResult` interface

This module is a **domain logic library** for type safety and architecture brain validation.
`gate.ts` is an **orchestration layer** that delegates to existing guards via `bun run <script>`.
There is no overlap — `gate.ts` MUST NOT import from `governance-validator.ts`.

---

## 5 — Existing `governance:*` Scripts in `package.json`

**None.** Confirmed by search of root `package.json`. The following relevant scripts exist:

| Script                        | Command                                                                    |
| ----------------------------- | -------------------------------------------------------------------------- |
| `arch:guard`                  | `bun scripts/architecture-guard/architecture-guard.ts`                     |
| `arch:guard:ci`               | `bun scripts/architecture-guard/architecture-guard.ts --ci`                |
| `arch:guard:changed`          | `bun scripts/architecture-guard/architecture-guard.ts --changed` ✅ exists |
| `arch:health`                 | `bun scripts/architecture-health/architecture-health.ts`                   |
| `arch:health:ci`              | `bun scripts/architecture-health/architecture-health.ts --ci`              |
| `validate:types`              | `bun typecheck && bun arch:type-safety-guard --json`                       |
| `validate:scripts:runtime`    | `bun run scripts/validate/runtime-scripts.ts`                              |
| `validate:scripts:usage`      | `bun scripts/validate/script-usage.ts`                                     |
| `infra:security:ci`           | `bun scripts/security/scan-ci.ts`                                          |
| `validate:ai-context-fresh`   | `bun run scripts/validate/ai-context-fresh.ts`                             |
| `validate:ai-context-schemas` | `bun run scripts/validate/ai-context-schemas.ts`                           |

**Scripts that must be created:**

- `ai-context:validate` — alias chaining `validate:ai-context-fresh && validate:ai-context-schemas`
- `governance:gate` — `bun scripts/governance/gate.ts`
- `governance:gate:ci` — `bun scripts/governance/gate-ci.ts`
- `governance:gate:changed` — single-line shell: `bun run arch:guard:changed && bun run validate:scripts:runtime`
- `governance:report` — `bun scripts/governance/report.ts`

---

## 6 — Script Metadata Header Format (from codebase evidence)

All scripts with proper headers use JSDoc blocks, **not** inline `//` comments. Example from
`scripts/validate/ai-context-schemas.ts`:

```typescript
/**
 * @script validate:ai-context-schemas
 * @domain validate
 * @category validation
 * @description Validate that all required AI context JSON artifacts exist and are valid JSON
 *
 * @usage bun run validate:ai-context-schemas
 */
```

The `governance` domain does **not** appear in any current script header. It is a new domain, and
constitutes a tracked exception pending the `script-system-governance/SKILL.md` update (out of scope
for INFRA-27).

---

## 7 — Bun Shell API Pattern

Scripts that spawn subprocesses use `import { $ } from 'bun'` with the template-tag API:

```typescript
import { $ } from "bun";

// Capture exit code without throwing:
const result = await $`bun run arch:guard`.nothrow();
const exitCode = result.exitCode ?? 1;
```

`.nothrow()` prevents Bun from throwing on non-zero exit — required for report-all gate logic.
Stdout/stderr pass through to the parent process by default (no `.quiet()`) so developers see guard output.

---

## 8 — `.gitignore` Analysis

Current entries under `docs/`:

```
docs/ai/context/architecture-impact-report.json
docs/architecture/health/ai-execution-logs/*.json
docs/architecture/health/ai-plans/*.md
```

**No entry for `docs/governance/` or `docs/governance/governance-report.md`** (confirmed via Q3
clarification). The missing entry is a required deliverable of this stage.

---

## 9 — `docs/governance/` Directory

**Does not yet exist.** `report.ts` must create it via `mkdir('docs/governance', { recursive: true })`
before writing the report file. The `gate.ts` and `gate-ci.ts` scripts do not need to create it.

---

## 10 — Orchestrator Integration Points

Orchestrator file: `.agents/agents/orchestrator.agent.md`

- **Step 6.1 (Verify Implementation Gate):** Currently checks `drift_passed`, constitutional
  violations, and ambiguities. Does NOT yet call `governance:gate:changed`.
- **Step 7 (Closure):** Currently handles PR summary, testing guide, validation reports. Does NOT
  yet call `governance:gate`.

FR-009 requires the orchestrator definition to be updated for both steps. This is a documentation
edit to the orchestrator `.agent.md` file — no new code.

---

## 11 — Resolved Unknowns

| Item                                                   | Resolution                                           |
| ------------------------------------------------------ | ---------------------------------------------------- |
| `arch:guard:changed` existence                         | ✅ Confirmed in package.json                         |
| All 5 upstream guards reachable                        | ✅ All canonical names verified                      |
| `ai-context:validate` alias                            | ❌ Missing — must be created                         |
| `governance:*` scripts                                 | ❌ None exist — all 4 must be created                |
| `docs/governance/governance-report.md` in `.gitignore` | ❌ Missing — required deliverable                    |
| `governance-validator.ts` reusability                  | ❌ N/A — domain utility, not orchestration           |
| Bun `$` shell API                                      | ✅ Available, use `.nothrow()` for exit code capture |
| `governance` domain in 9-domain list                   | ❌ Not listed — tracked exception                    |
