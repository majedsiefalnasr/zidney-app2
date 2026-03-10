# Specification Quality Checklist: Module Boundary Enforcement

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-03-08 **Feature**: [spec.md](../spec.md) **Stage**:
STAGE_INFRA_07_MODULE_BOUNDARIES

---

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on developer value and architectural governance needs
- [x] All mandatory sections completed
- [x] Written at a level appropriate for both technical and architectural stakeholders

---

## Requirement Completeness

- [x] No `[NEEDS CLARIFICATION]` markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable (10 criteria with explicit verification method)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified (external npm packages, missing JSON, alias resolution, zero-dep
      modules)
- [x] Scope is clearly bounded (in-scope and out-of-scope sections present)
- [x] Dependencies and assumptions identified

---

## Module Classification Completeness

- [x] All modules classified into layers

  | Module                 | Layer Assigned     |
  | ---------------------- | ------------------ |
  | `packages/logger`      | `infrastructure` ✓ |
  | `packages/config`      | `infrastructure` ✓ |
  | `packages/types`       | `infrastructure` ✓ |
  | `packages/redis-utils` | `infrastructure` ✓ |
  | `packages/domain-core` | `domain` ✓         |
  | `packages/validation`  | `domain` ✓         |
  | `packages/ui-system`   | `ui` ✓             |
  | `packages/api-client`  | `ui` ✓             |
  | `apps/api`             | `runtime` ✓        |
  | `apps/worker`          | `runtime` ✓        |
  | `apps/mmc`             | `ui` ✓             |
  | `apps/backoffice`      | `ui` ✓             |
  | `apps/frontoffice`     | `ui` ✓             |

---

## Dependency Boundary Coverage

- [x] Allowed dependencies documented for each layer
- [x] Forbidden dependencies documented for each layer
- [x] Cross-cutting rules documented (packages→apps, apps↔apps, runtime→ui-system, ui→domain)

  | Rule                                                                             | Documented |
  | -------------------------------------------------------------------------------- | ---------- |
  | `infrastructure` has no internal deps                                            | ✓          |
  | `domain` may depend on `infrastructure`                                          | ✓          |
  | `runtime` may depend on `domain` and `infrastructure`                            | ✓          |
  | `ui` may depend on `packages/ui-system`, `packages/api-client`, `infrastructure` | ✓          |
  | `packages/*` must not import from `apps/*`                                       | ✓          |
  | `apps/*` must not import from other `apps/*`                                     | ✓          |
  | `runtime` must not import `packages/ui-system`                                   | ✓          |
  | `ui` must not import `packages/domain-core` or `packages/validation`             | ✓          |

---

## Boundary Map JSON

- [x] `module-boundaries.json` schema defined in spec
- [x] Schema includes `version`, `layers`, `allowed_dependencies`, `forbidden_dependencies`,
      `cross_cutting_rules`
- [x] File path documented (`docs/architecture/module-boundaries.json`)
- [x] JSON structure is compatible with what `ai-guard.ts` and `infra-audit.ts` can consume
- [x] Format complements (not replaces) existing `ARCHITECTURE_MAP.json`

---

## AI-Guard Integration

- [x] AI-Guard loading sequence described (module-boundaries.json → ARCHITECTURE_MAP.json →
      ARCHITECTURE_CONTRACT.json)
- [x] Validation steps described (per-file module resolution, layer lookup, import extraction, alias
      resolution, rule checks)
- [x] Graceful fallback behavior when `module-boundaries.json` is missing described
- [x] TypeScript alias resolution requirement documented (FR-006)
- [x] Error output format specified (FR-012)

---

## CI Enforcement

- [x] Updated CI pipeline stage order documented
- [x] `module-boundary-validation` step described
- [x] Failure behavior documented (PR blocked on violation)
- [x] Developer local check (`bun run ai-guard`) documented (FR-010)
- [x] Package.json script requirement documented

---

## New Module Workflow

- [x] Registration workflow documented (FR-011)
- [x] Undeclared module detection by `infra-audit.ts` documented (FR-008)
- [x] Scenario 3 covers the end-to-end new module onboarding flow

---

## Success Criteria Quality

- [x] Success criteria are measurable (each includes "How Measured" column with specific verifiable
      action)
- [x] Success criteria are implementation-agnostic where possible
- [x] All 4 stage completion goals from the stage file are mapped to success criteria:
  - All modules classified into layers → SC-001
  - Boundary map exists → SC-002
  - AI-Guard validates module imports → SC-003, SC-004, SC-006, SC-009
  - CI blocks architecture violations → SC-005

---

## Prior Stage Dependencies

- [x] STAGE_INFRA_05_LINT_GOVERNANCE dependency confirmed (PRODUCTION READY)
- [x] STAGE_INFRA_06_ARCHITECTURE_GUARD dependency confirmed (PRODUCTION READY)
- [x] Dependency table in spec includes status and notes

---

## Architecture Classification Decisions

- [x] `packages/types` reclassification from `domain` → `infrastructure` is documented with
      rationale (Decision 2)
- [x] `packages/api-client` reclassification from `infrastructure` → `ui` is documented with
      rationale (Decision 3)
- [x] Both reclassifications address the discrepancy between `ARCHITECTURE_MAP.json` and the intent
      of this stage

---

## INFRA Stage Constraints

- [x] No business logic changes proposed
- [x] No tenant isolation concerns addressed (correctly out of scope)
- [x] No new npm packages introduced
- [x] No migration files referenced
- [x] Architecture modifications are allowed (INFRA stage) and all proposed changes are
      governance-only

---

## Notes

All checklist items pass. The specification is complete and ready for the planning phase
(`/speckit.plan`).

Key decisions documented:

1. `packages/types` is `infrastructure` (not `domain` as currently in ARCHITECTURE_MAP.json)
2. `packages/api-client` is `ui` (not `infrastructure` as currently in ARCHITECTURE_MAP.json)
3. `module-boundaries.json` complements rather than replaces `ARCHITECTURE_MAP.json`
4. ai-guard.ts loading precedence: module-boundaries.json → ARCHITECTURE_MAP.json →
   ARCHITECTURE_CONTRACT.json
