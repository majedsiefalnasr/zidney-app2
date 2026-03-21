# Specify Report — STAGE_INFRA_07_MODULE_BOUNDARIES

**Step:** 1 — Specify  
**Timestamp:** 2026-03-08T00:00:00.000Z  
**Status:** COMPLETE

---

## Summary

Specification for `STAGE_INFRA_07_MODULE_BOUNDARIES` is complete and production-grade. This INFRA
stage formalizes explicit module ownership and dependency boundaries across the Zidney monorepo. The
spec defines a machine-readable boundary map (`docs/architecture/module-boundaries.json`) consumed
by `ai-guard.ts` and `infra-audit.ts`, with CI enforcement.

All 13 monorepo modules have been classified into four architectural layers. The complete boundary
matrix is defined, `ai-guard.ts` loading sequence is described, and CI pipeline integration is
specified. No `[NEEDS CLARIFICATION]` markers remain.

---

## Inputs Reviewed

- `specs/phases/01_PLATFORM_FOUNDATION/STAGE_INFRA_07_MODULE_BOUNDARIES.md`
- `docs/architecture/intelligence/ARCHITECTURE_MAP.json`
- `scripts/infra-audit.ts`
- `scripts/ai-guard.ts`
- `specs/runtime/infra-007-module-boundaries/spec.md`
- `specs/runtime/infra-007-module-boundaries/checklists/requirements.md`

---

## Key Decisions

| #   | Decision                                                                  | Rationale                                                                                                                 |
| --- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | `packages/types` → `infrastructure` layer                                 | Types are cross-cutting primitives, not domain objects. Current ARCHITECTURE_MAP.json mis-classifies them as `domain`.    |
| 2   | `packages/api-client` → `ui` layer                                        | api-client is a frontend HTTP adapter; it belongs in `ui`, not `infrastructure`. Corrects current mis-classification.     |
| 3   | `module-boundaries.json` complements `ARCHITECTURE_MAP.json`              | Both files coexist; `ai-guard.ts` merges them with `module-boundaries.json` taking precedence for layer/dependency rules. |
| 4   | UI modules may NOT import `domain` packages                               | Prevents domain logic from leaking into the presentation layer; UI communicates only through API client.                  |
| 5   | Developer-facing command is `bun run ai:guard`                            | Single discoverable entry point; internally reads both `module-boundaries.json` and `ARCHITECTURE_MAP.json`.              |
| 6   | Undeclared modules emit warnings (not errors) in local mode, errors in CI | Balances developer velocity with CI strictness.                                                                           |

---

## Functional Requirements Captured

- **FR-001** — `docs/architecture/module-boundaries.json` must exist and be valid JSON after this
  stage
- **FR-002** — All 13 modules classified into one of: `infrastructure` | `domain` | `runtime` | `ui`
- **FR-003** — `ai-guard.ts` loads `module-boundaries.json` before `ARCHITECTURE_MAP.json`;
  module-boundaries.json takes precedence for layer rules
- **FR-004** — `ai-guard.ts` blocks commits where `apps/*` imports another `apps/*` module
- **FR-005** — `ai-guard.ts` blocks commits where `packages/*` imports `apps/*`
- **FR-006** — `ai-guard.ts` blocks commits where a `ui` layer module imports a `domain` layer
  module
- **FR-007** — `ai-guard.ts` blocks commits where a `domain` layer module imports a `runtime` or
  `ui` module
- **FR-008** — `ai-guard.ts` warns (local) / errors (CI) for modules present in the repo but absent
  from `module-boundaries.json`
- **FR-009** — CI pipeline includes a `module-boundary-validation` step running `bun run ai:guard`
- **FR-010** — `bun run ai:guard` exits 0 if no violations found, non-zero otherwise
- **FR-011** — Violation output includes: module name, source layer, target layer, violation type,
  file path
- **FR-012** — New module onboarding workflow documented: assign layer → add to
  `module-boundaries.json` → verify with `bun run ai:guard`

---

## Clarifications Required

None. All ambiguities were resolved from the stage file, existing tooling source code,
`ARCHITECTURE_MAP.json`, and the Zidney Constitution.

---

## Constitutional Compliance

| Check                                   | Status | Notes                                         |
| --------------------------------------- | ------ | --------------------------------------------- |
| No cross-tenant access introduced       | ✅     | Pure INFRA stage — no tenant logic            |
| License middleware requirement captured | ✅ N/A | Not applicable to governance tooling          |
| Snapshot integrity requirement captured | ✅ N/A | Not applicable to governance tooling          |
| Idempotency strategy defined            | ✅ N/A | `bun run ai:guard` is idempotent by nature    |
| Transaction boundaries identified       | ✅ N/A | No database interaction                       |
| Server-authoritative time enforced      | ✅ N/A | No runtime timing concerns                    |
| Import boundary rules enforced          | ✅     | This stage IS the import boundary enforcement |
| Architecture layer rules enforced       | ✅     | Spec defines the four-layer model precisely   |

**Overall:** COMPLIANT

---

## Open Risks

| #   | Risk                                                                           | Likelihood | Impact | Mitigation                                                                                                 |
| --- | ------------------------------------------------------------------------------ | ---------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| R1  | Existing violations in codebase cause CI block on first run                    | MEDIUM     | HIGH   | `ai-guard.ts` extended to report violations without blocking on first load; violations tracked in a report |
| R2  | `ARCHITECTURE_MAP.json` and `module-boundaries.json` produce conflicting rules | LOW        | MEDIUM | Spec defines merge order: `module-boundaries.json` takes precedence                                        |
| R3  | Developer uses path aliases that bypass boundary checks                        | LOW        | HIGH   | `ai-guard.ts` must resolve `@zidney/*` and relative imports before classifying                             |
| R4  | New module added without registration causes silent coupling                   | LOW        | MEDIUM | Undeclared module detection built into `infra-audit.ts`                                                    |

---

## Next Step

Proceed to Step 2 — Clarify.
