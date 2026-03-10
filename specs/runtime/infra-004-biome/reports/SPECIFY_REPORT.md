# Specify Report — STAGE_INFRA_04_BIOME

**Step:** 1 — Specify **Stage:** STAGE_INFRA_04_BIOME **Phase:** 01_PLATFORM_FOUNDATION **Branch:**
spec/infra-004-biome **Generated:** 2026-03-06T00:00:00.000Z

---

## Summary

The specification for the Biome unified linting and formatting engine stage is complete. This is a
pure infrastructure tooling replacement stage — no runtime behavior, database schema,
authentication, or tenant isolation is affected.

**Outcome:** PASS — spec.md written, requirements checklist fully satisfied, no
`[NEEDS CLARIFICATION]` markers remain.

---

## Spec Overview

| Field               | Value                                              |
| ------------------- | -------------------------------------------------- |
| Feature ID          | infra-004-biome                                    |
| Type                | Infrastructure Tooling Replacement (non-feature)   |
| Scope               | apps/_, packages/_, tests/_, scripts/_, JSON files |
| Runtime Impact      | None (no deployed artifacts change)                |
| Schema Impact       | None                                               |
| Auth Impact         | None                                               |
| Tenant Isolation    | Unaffected                                         |
| License Enforcement | Unaffected                                         |
| Attempt Engine      | Unaffected                                         |

---

## Functional Requirements Defined

| ID    | Requirement                                                               |
| ----- | ------------------------------------------------------------------------- |
| FR-01 | Single root `biome.json` — no per-package overrides                       |
| FR-02 | ESLint and Prettier fully removed from all packages                       |
| FR-03 | Formatter: 2-space indent, 100-char line width                            |
| FR-04 | Lint policy: noUnusedImports, noDebugger, noConsole warn, useConst, noVar |
| FR-05 | Import organization enabled globally                                      |
| FR-06 | CI lint gate blocking (before AI-Guard)                                   |
| FR-07 | CI format gate blocking                                                   |
| FR-08 | Developer workflow commands documented (lint + format)                    |
| FR-09 | AI-Guard pipeline position enforced: Biome → AI-Guard → Vitest            |
| FR-10 | VSCode extension recommendation documented                                |

---

## Success Criteria

| ID    | Criterion                                                                               |
| ----- | --------------------------------------------------------------------------------------- |
| SC-01 | `biome check .` exits with code 0 (zero lint violations)                                |
| SC-02 | `biome format --check .` exits with code 0                                              |
| SC-03 | No ESLint or Prettier entries in any package.json `dependencies` or `devDependencies`   |
| SC-04 | CI pipeline includes a blocking `biome check` step                                      |
| SC-05 | Running `biome format --write .` produces no diff (repo already formatted)              |
| SC-06 | No `.eslintrc*`, `.prettierrc*`, `eslint.config.*`, or `prettier.config.*` files remain |
| SC-07 | CI steps ordered: Biome → AI-Guard → Vitest                                             |
| SC-08 | Developer workflow documented in README or CONTRIBUTING                                 |

---

## Checklist Result

| Category                      | Status  |
| ----------------------------- | ------- |
| Content Quality               | ✅ PASS |
| Requirement Completeness      | ✅ PASS |
| Constitutional Alignment      | ✅ PASS |
| Scope Boundaries              | ✅ PASS |
| [NEEDS CLARIFICATION] markers | ✅ None |

---

## Key Assumptions (from spec.md)

1. All current `console.log` usages in production code will be replaced with the Zidney structured
   logger (`@zidney/logger`) before or during this stage.
2. Vue file support is limited to embedded TypeScript/JavaScript script blocks; template syntax is
   out of Biome's scope.
3. No per-package `biome.json` overrides are required or permitted.
4. `lint-staged` integration with Biome is in scope for pre-commit hooks.
5. The current Biome stable release is compatible with the TypeScript version in use.
6. ESLint and Prettier removal is safe as all rules with runtime impact (none) are being mapped to
   Biome equivalents.

---

## Artifacts Produced

| File                                                     | Owner   | Status     |
| -------------------------------------------------------- | ------- | ---------- |
| specs/runtime/infra-004-biome/spec.md                    | SpecKit | ✅ Created |
| specs/runtime/infra-004-biome/checklists/requirements.md | SpecKit | ✅ Created |

---

**Next Step:** Proceed to Step 2 (Clarify) — no blockers detected.
