# Spec: STAGE_INFRA_06_ARCHITECTURE_GUARD

**Stage:** STAGE_INFRA_06_ARCHITECTURE_GUARD  
**Phase:** 01_PLATFORM_FOUNDATION  
**Stage File:** `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_06_ARCHITECTURE_GUARD.md`  
**Author:** Zidney Orchestrator  
**Created:** 2026-03-08

---

## Constitutional Compliance Declaration

Before proceeding: validated against Zidney Constitution v1.2.0.

- ✅ No cross-tenant access — this stage modifies only governance scripts and test files
- ✅ No middleware bypass — no API routes or middleware changes
- ✅ No grading outside worker — not applicable
- ✅ No direct DB instantiation — no database access
- ✅ No weakening of snapshot integrity — not applicable
- ✅ No weakening of transaction boundaries — not applicable
- ✅ No weakening of version enforcement — not applicable
- ✅ No ADR required — implementing enforcement of ADRs, not creating new ones

This is a pure **governance infrastructure stage**. It affects:

- `scripts/ai-guard.ts` (enhancement + CLI exposure)
- `tests/unit/ai-guard/` (test implementation)
- `tests/static/` (static architecture rule enforcement tests)
- `package.json` (npm script addition)

**Compliant with Zidney Constitution v1.2.0 — No violations detected.**

---

## Feature Overview

### What Is Being Built

STAGE_INFRA_06_ARCHITECTURE_GUARD formalizes the **repository-level architecture protection system**
for Zidney.

The foundation already exists. This stage completes it by:

1. **Exposing `arch:guard` as a named CLI command** — so developers can manually run
   `bun run arch:guard` to validate architecture without using git
2. **Adding comprehensive unit tests for `scripts/ai-guard.ts`** — the validation logic is untested;
   tests must exist for every rule category
3. **Adding static architecture tests** — automated tests that assert layer rules and boundaries are
   expressed correctly in the contract
4. **Verifying the Husky pre-commit hook** — document and validate the three-gate hook is correctly
   wired and tested

### Current State (What Already Exists)

The following are **ALREADY IMPLEMENTED** and must not be duplicated:

| Component                    | Status                | Location                                                    |
| ---------------------------- | --------------------- | ----------------------------------------------------------- |
| `scripts/ai-guard.ts`        | ✅ Exists (445 lines) | `scripts/ai-guard.ts`                                       |
| `scripts/infra-audit.ts`     | ✅ Exists             | `scripts/infra-audit.ts`                                    |
| `.husky/pre-commit`          | ✅ Exists (3 gates)   | `.husky/pre-commit`                                         |
| `ARCHITECTURE_CONTRACT.json` | ✅ Exists             | `docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json` |
| `ARCHITECTURE_MAP.json`      | ✅ Exists             | `docs/architecture/intelligence/ARCHITECTURE_MAP.json`      |
| `ai-architecture-brain.json` | ✅ Exists             | `docs/ai/context/ai-architecture-brain.json`                |
| ADR files                    | ✅ Exist (9 ADRs)     | `docs/architecture/adr/`                                    |
| `arch:audit` script          | ✅ Exists             | `package.json`                                              |
| ai-guard test directory      | ✅ Exists (empty)     | `tests/unit/ai-guard/`                                      |

### What This Stage Delivers (Gap Items)

| Deliverable                                  | Type                | Status                         |
| -------------------------------------------- | ------------------- | ------------------------------ |
| `arch:guard` npm script                      | package.json script | ❌ Missing                     |
| `tests/unit/ai-guard/*.test.ts`              | Unit tests          | ❌ Missing (fixtures dir only) |
| `tests/static/05-architecture-guard.test.ts` | Static test         | ❌ Missing                     |
| TESTING_GUIDE integration                    | Documentation       | ❌ Missing                     |

### Phase

Phase: 01_PLATFORM_FOUNDATION — Infrastructure stage.

### What This Stage DOES NOT Change

- `scripts/ai-guard.ts` implementation logic — it already works correctly
- `.husky/pre-commit` hook — already configured correctly
- `ARCHITECTURE_CONTRACT.json` — generated file, not manually edited
- `ARCHITECTURE_MAP.json` — updated via `bun run arch:fix`, not directly
- Any ADR files — ADRs already exist as complete decisions
- Any apps/ or packages/ source code
- Database schemas, migrations, or tenant logic

---

## Isolation Impact Analysis

**This stage does NOT access any database.**

- Which database is accessed: **None**
- Tenant resolution: **Not applicable**
- Connection pool: **Not applicable**
- Resolver middleware: **Not applicable**
- New tables introduced: **None**

No shared tenant data. Architecture governance is a pure CI/developer tooling layer.

---

## License & Version Enforcement

**Not applicable to this stage.**

- License middleware required: No — this is developer tooling, not an API route
- License states: Not applicable
- Limit enforcement: Not applicable
- `schema_version` checked: No
- `product_version` checked: No

---

## Data Model Changes

**None.**

- New tables: None
- Modified tables: None
- Migration required: No
- Version bump: No

---

## Transaction Boundaries

**Not applicable.** This stage introduces no database writes or transactional operations.

---

## Authoritative Time Usage

**Not applicable.** This stage introduces no time-dependent operations.

---

## Idempotency Strategy

**Not applicable.** This stage introduces no endpoints or state mutations.

---

## User Stories

These stories describe the developer and platform engineer experience after this stage is complete.

### US-01: Developer CLI Access

**As a developer**, I can run `bun run arch:guard` from the project root to validate the
architecture of the full codebase before committing, so I can detect violations proactively without
relying exclusively on the pre-commit hook.

**Acceptance Criteria:**

- `bun run arch:guard` runs successfully on a clean codebase (exit code 0)
- `bun run arch:guard` exits with code 1 and prints a structured report when violations exist
- The command is documented in the project README or developer guide

### US-02: Automated Pre-Commit Guard

**As a developer**, when I commit code that violates architecture boundaries, the pre-commit hook
automatically blocks my commit and explains exactly what rule was violated and where, so I can fix
it immediately.

**Acceptance Criteria:**

- Pre-commit hook blocks commit on: cross-app imports, packages→apps imports, forbidden layer
  imports, relative architecture leaks
- Violation message includes: file path, rule name, recommended fix
- Hook exits 0 on clean, 1 on violation

### US-03: CI Architecture Gate

**As a platform engineer**, all PRs are automatically validated against architecture rules before
merge, so no architecture violations can enter the default branch undetected.

**Acceptance Criteria:**

- CI pipeline runs `bun run arch:guard` (or `bun scripts/ai-guard.ts`)
- CI pipeline runs `bun run arch:audit` (or `bun scripts/infra-audit.ts`)
- Architecture score ≥ 85 threshold is enforced
- Failed PRs display a clear violation summary

### US-04: AI Code Protection

**As a platform architect**, AI-generated code is validated through the same architecture rules as
human-written code, so AI tools cannot silently introduce architecture violations.

**Acceptance Criteria:**

- `scripts/ai-guard.ts` validates all changed files, not just human-authored files
- Branch naming validation prevents spec/\* stage boundary violations
- Architecture brain takes precedence over contract when available

### US-05: Violation Test Coverage

**As a developer**, the architecture guard script has automated tests that verify every rule
category works correctly, so I can trust that the guard catches real violations and does not produce
false positives.

**Acceptance Criteria:**

- Unit tests cover: cross-app import detection, packages→apps detection, layer violation detection,
  relative leak detection, architecture map validation
- Each test category has both a "should detect violation" case and a "should pass clean code" case
- Tests run as part of `bun run test`

---

## Functional Requirements

### FR-01: `arch:guard` npm Script

Add `"arch:guard": "bun scripts/ai-guard.ts"` to `package.json` `scripts` section.

**Rationale:** Developers need a named, documented CLI entry point to run the architecture guard
manually. Currently, the guard only runs via the Husky pre-commit hook (opaquely). A named script
enables:

- Manual pre-push validation
- CI pipeline step (by name)
- Documentation references

### FR-02: Unit Tests for Validation Functions

Create `tests/unit/ai-guard/ai-guard-validation.test.ts` with test cases for:

| Function                     | Test Cases                                                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `validateCrossAppImports`    | ✅ Detects apps/api → apps/mmc import; ✅ Allows apps/api → packages/logger import                                     |
| `validateRules` (dependency) | ✅ Detects packages/domain-core → apps/api import; ✅ Allows packages/domain-core → packages/types import              |
| `validateRules` (layer)      | ✅ Detects packages/ui-system → packages/domain-core import; ✅ Allows packages/ui-system → packages/types import      |
| `validateRelativeLeaks`      | ✅ Detects `../../apps/api` relative import; ✅ Allows `../utils/helper` relative import                               |
| `validateArchitectureMap`    | ✅ Detects a module importing a forbidden dependency from ARCHITECTURE_MAP; ✅ Allows an explicitly allowed dependency |
| `validateBranchNaming`       | ✅ Branch mismatch detected on spec/\* branch; ✅ Non-spec branch is not validated                                     |

Each test must:

- Use test fixture files (placed in `tests/unit/ai-guard/fixtures/`)
- Not depend on actual git staging state
- Be deterministic and environment-independent

### FR-03: Static Architecture Rule Test

Create `tests/static/05-architecture-guard.test.ts` that asserts:

1. **ARCHITECTURE_CONTRACT.json exists and is valid JSON**
2. **Key forbidden rules are present:**
   - `forbidPackagesImportingApps: true`
   - `forbidAppsImportingOtherApps: true`
3. **ui-system→domain-core layer rule is encoded**
4. **API-client→worker layer rule is encoded**
5. **ai-guard.ts exits with code 0 on an empty file list (no staged files)**
6. **infra-audit.ts --quick exits with code 0** (architecture score ≥ 85)

### FR-04: `detectModule` and `detectFileModule` Test Coverage

Add tests for internal path resolution logic to validate that:

- `apps/api/src/routes/tenant.ts` → resolves to `apps/api`
- `packages/domain-core/src/index.ts` → resolves to `packages/domain-core`
- `apps/mmc/src/components/Foo.vue` → resolves to `apps/mmc`
- Unknown paths → return `null` gracefully

### FR-05: Pre-commit Hook Documentation

Add inline comments to `.husky/pre-commit` explaining:

- What each gate does
- What happens on failure
- How to debug a failing gate

**Note:** The hook content is already correct and well-commented. Verify it matches the canonical
form. No content changes needed — only verification.

---

## Observability Requirements

This stage operates in developer tooling, not in the runtime API. Standard structured logging does
not apply.

However, ai-guard produces structured console output:

- On pass: `AI Guard: architecture validation passed.`
- On fail: `AI Guard: Architecture violations detected` followed by per-file violation lines
- On no changed files: `AI Guard: no changed files detected.`

This output format is sufficient for the pre-commit hook and CI context.

---

## Rate Limiting & Abuse Protection

**Not applicable.** This stage introduces no endpoints.

---

## Layer Separation Confirmation

- ✅ Frontend: no changes to any UI application
- ✅ API: no changes to any API routes or handlers
- ✅ Worker: no changes to worker logic
- ✅ MMC: no changes
- ✅ No direct DB creation

The only changes are in:

- `scripts/` directory (governance tooling)
- `tests/unit/ai-guard/` (unit tests)
- `tests/static/` (static tests)
- `package.json` (script entry point)

---

## Failure Modes & Recovery

| Failure Mode                           | Impact                           | Recovery                                                |
| -------------------------------------- | -------------------------------- | ------------------------------------------------------- |
| `ai-guard.ts` does not compile         | Pre-commit hook fails            | Fix TypeScript error                                    |
| `ARCHITECTURE_CONTRACT.json` not found | Guard exits with unhandled error | Run `bun run arch:audit` to regenerate                  |
| `ai-architecture-brain.json` not found | Guard falls back to contract     | No action needed — graceful fallback exists             |
| Architecture score < 85                | infra-audit --quick fails commit | Fix violations (circular deps, layer violations, drift) |
| Tests fail                             | CI blocks merge                  | Fix the identified violation                            |

---

## Test Strategy

### Unit Tests

- `tests/unit/ai-guard/ai-guard-validation.test.ts` — tests all validation functions
- Fixture files in `tests/unit/ai-guard/fixtures/` — fake TypeScript source files with known import
  patterns
- Run via: `bun run test:unit` or `bun run test`

### Static Tests

- `tests/static/05-architecture-guard.test.ts` — validates architecture governance configuration
- Asserts architecture contract integrity at schema level
- Does NOT execute the guard with real code changes (use unit tests for that)

### Integration Tests

- No integration tests required — this is governance tooling, not a runtime feature
- Existing `bun run arch:audit` serves as the integration check

### Idempotency

- `ai-guard.ts` is idempotent — running it multiple times on the same code produces the same result
- No state is modified by running the guard

---

## Explicit Non-Goals

This stage explicitly does NOT:

1. **Modify `scripts/ai-guard.ts` logic** — the implementation is correct and working; only tests
   are added
2. **Modify `.husky/pre-commit`** — already correctly configured
3. **Add new ADR decisions** — ADRs 0001–0009 already exist
4. **Modify ARCHITECTURE_MAP.json or ARCHITECTURE_CONTRACT.json** — these are generated files
5. **Add GitHub Actions CI workflow** — CI architecture governance workflow is covered in a later
   stage
6. **Create architecture visualizations** — covered in STAGE_INFRA_08

---

## Clarifications

### Session 2026-03-08

**Ambiguity scan result:** No ambiguities found. All specification requirements are deterministic
based on existing codebase state.

**Audit dimensions reviewed:**

| Dimension              | Finding                                           |
| ---------------------- | ------------------------------------------------- |
| Transaction strategy   | N/A — no database access in this stage            |
| Idempotency strategy   | N/A — no endpoints or state mutations             |
| Concurrency model      | N/A — CLI tooling only                            |
| Version enforcement    | N/A — no API routes affecting version enforcement |
| Middleware enforcement | N/A — no API routes                               |
| Security validation    | N/A — developer tooling only, no user inputs      |
| Error contract         | Defined: structured console output in ai-guard.ts |
| Isolation boundaries   | N/A — no tenant-bound operations                  |

**Conclusion:** No `[NEEDS CLARIFICATION]` markers. Spec is ready for planning. 7. **Implement drift
detection snapshots** — covered in STAGE_INFRA_08_ARCHITECTURE_VISUALIZATION 8. **Add module
registration UI** — the `arch:add-module` CLI already exists 9. **Modify any apps/ source code** —
this is an INFRA stage only

---

## Implementation Notes

### Files to Create

```
tests/unit/ai-guard/
├── ai-guard-validation.test.ts          ← FR-02 unit tests
└── fixtures/
    ├── clean-app-file.ts                ← clean file with allowed imports
    ├── cross-app-violation.ts           ← file with forbidden apps→apps import
    ├── packages-to-apps-violation.ts    ← file with forbidden packages→apps import
    ├── layer-violation.ts               ← file with forbidden layer import
    └── relative-leak.ts                 ← file with forbidden relative path leak

tests/static/
└── 05-architecture-guard.test.ts        ← FR-03 static architecture test
```

### Files to Modify

```
package.json                             ← add "arch:guard" script (FR-01)
```

### Key Implementation Details

**Fixture files approach:**  
Since `extractImports()` in `ai-guard.ts` reads actual file content and parses import statements
using `readFileSync`, fixture files must contain real TypeScript import syntax. Tests should call
the internal validation functions directly after extracting imports from fixtures.

**Test approach for `validateCrossAppImports`:**  
The function signature is `validateCrossAppImports(fileModule, filePath, imports)`. Tests can call
this directly with constructed arguments:

```ts
const result = validateCrossAppImports("api", "apps/api/src/test.ts", ["apps/mmc/src/foo"]);
expect(result).toHaveLength(1);
expect(result[0]).toContain("Cross-app violation");
```

**Static test for infra-audit:**  
Use `execSync('bun scripts/infra-audit.ts --quick', { cwd: process.cwd() })` wrapped in try/catch.
If exit code ≠ 0, test fails with the audit output.

**`arch:guard` script placement in package.json:**  
Add after `arch:fix` script in the scripts block:

```json
"arch:guard": "bun scripts/ai-guard.ts"
```

---

## Dependencies on Prior Stages

| Stage                          | Dependency                                                                   |
| ------------------------------ | ---------------------------------------------------------------------------- |
| STAGE_INFRA_03_ALIGNMENT       | Module alignment — ensures monorepo module paths are correct                 |
| STAGE_INFRA_04_BIOME           | Code quality tooling — test files must pass Biome checks                     |
| STAGE_INFRA_05_LINT_GOVERNANCE | Lint pipeline — test files linted via lint-staged                            |
| STAGE_INFRA_GOVERNANCE         | `scripts/infra-audit.ts` exists (ARCHITECTURE_CONTRACT.json generated by it) |

---

## Success Criteria

- [ ] `bun run arch:guard` command exists and runs `scripts/ai-guard.ts`
- [ ] `bun run arch:guard` exits 0 on clean codebase
- [ ] `bun run arch:guard` exits 1 on code with architecture violations
- [ ] `tests/unit/ai-guard/ai-guard-validation.test.ts` exists with ≥ 10 test cases
- [ ] All unit tests pass via `bun run test`
- [ ] `tests/static/05-architecture-guard.test.ts` exists and passes
- [ ] All fixture files are present in `tests/unit/ai-guard/fixtures/`
- [ ] Architecture score remains 100/100 after changes
- [ ] Pre-commit hook continues to pass after changes
- [ ] No TypeScript errors introduced (`bun run typecheck`)
- [ ] No Biome lint errors introduced (`bun run lint`)

---

## Final Constitutional Compliance Statement

**Compliant with Zidney Constitution v1.2.0 — No violations detected.**

This stage:

- Does not access any database
- Does not modify any middleware
- Does not weaken any isolation boundary
- Does not introduce new tenant logic
- Does not modify attempt engine
- Does not introduce new UI components
- Strictly follows Import Boundary Rules (tests import only from scripts/ and architecture
  intelligence files)
- Aligns with all 9 ADRs by enforcing them, not modifying them
