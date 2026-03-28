# Performance Checklist: Script System Standardization and Governance

**Purpose**: Validates that performance-relevant requirements in the INFRA-025 spec are complete, quantified, and realistic — covering validation script execution time, refactor engine scan cost, CI timeout constraints, and registry regeneration overhead.
**Created**: 2026-03-21
**Feature**: [spec.md](../spec.md)
**Stage**: INFRA-025 — Script System Standardization and Governance
**Domain**: Developer tooling / build-time governance. All concerns are build-time; no runtime or tenant performance surfaces exist.

---

## Validation Script Execution Time Requirements

- [ ] CHK001 — Are maximum acceptable wall-clock time budgets defined for `validate:scripts:naming` on a repository with the current number of `package.json` files? [Gap, Spec §FR-008]
- [ ] CHK002 — Are maximum acceptable wall-clock time budgets defined for `validate:scripts:usage` given the full scan scope (all `.ts`, `.md`, `.yml`, `.sh`, `.json` files)? [Gap, Spec §FR-008]
- [ ] CHK003 — Are performance baseline assumptions documented — specifically the expected number of `package.json` files, total script count, and total file count the validators must handle? [Gap, Spec §FR-008]
- [ ] CHK004 — Does the spec define whether `validate:scripts:naming` and `validate:scripts:usage` are required to complete within CI step timeout limits, and if so, what those limits are? [Gap, Spec §FR-008, FR-009]
- [ ] CHK005 — Is "report-all mode" (collect all violations before exit, per Clarifications) analyzed for its performance implications — specifically, is there a cap on the maximum violation list that prevents memory exhaustion on pathologically large violation sets? [Clarity, Spec Clarifications §2, Spec §FR-008]

---

## Refactor Engine Scan Performance

- [ ] CHK006 — Are time or resource constraints defined for the refactor engine when processing the full scan scope simultaneously (all `package.json`, workflow files, TypeScript scripts, Markdown docs, shell scripts, agent files)? [Gap, Spec §FR-004]
- [ ] CHK007 — Is parallelism or streaming strategy required for the refactor engine's multi-file scan, or is single-threaded sequential file processing acceptable? [Gap, Spec §FR-004]
- [ ] CHK008 — Does the spec define how the refactor engine handles large Markdown files (e.g., `specs/**/*.md` which may include generated documents) without excessive memory allocation? [Gap, Spec §FR-004]
- [ ] CHK009 — Is the idempotency requirement (safe to run multiple times) analyzed for performance cost — does each subsequent run do a full re-scan or short-circuit when no changes are needed? [Clarity, Spec §FR-004]
- [ ] CHK010 — Are requirements defined for the refactor engine's performance on a cold file-system cache versus a warm cache, given that CI runners often start with cold caches? [Gap, Spec §FR-004, FR-009]

---

## CI Pipeline Step Overhead

- [ ] CHK011 — Is the cumulative CI time budget for all four governance steps (`validate:scripts:naming`, `validate:scripts:usage`, `validate:scripts:infrastructure`, `generate:script:docs`) within the existing `architecture-governance` job estimated or bounded? [Gap, Spec §FR-009]
- [ ] CHK012 — Does the spec specify whether the four CI checks may run in parallel within the job, or are they required to run sequentially? [Gap, Spec §FR-009]
- [ ] CHK013 — Are requirements defined for the performance cost added to the `architecture-governance` job, which already contains `arch:guard`, `infra-audit.ts`, and `arch:health:ci` steps? [Gap, Spec §FR-009, Clarifications §3]
- [ ] CHK014 — Is there a requirement that `generate:script:docs` (registry regeneration) must not introduce a slow I/O operation that dominates total CI job time? [Gap, Spec §FR-009]

---

## Registry Generation and Staleness Detection Performance

- [ ] CHK015 — Are performance requirements defined for the registry regeneration script — specifically how it scans all script sources and produces `docs/scripts/SCRIPT_REGISTRY.md`? [Gap, Spec §FR-007]
- [ ] CHK016 — Is the staleness detection mechanism (CI fails if registry is stale) specified in terms of how the comparison is made — full file diff, hash comparison, or regenerate-and-compare — with an associated time cost constraint? [Clarity, Spec §FR-007]
- [ ] CHK017 — Does the spec define an incremental regeneration path for the registry when only a subset of `package.json` files changes, or is full regeneration always required? [Gap, Spec §FR-007]

---

## Large Repository Scalability

- [ ] CHK018 — Does the spec acknowledge that validation and refactor scripts must continue to perform acceptably as the monorepo grows (more apps, packages, scripts), and are scalability requirements documented? [Gap, Spec §FR-004, FR-008]
- [ ] CHK019 — Are requirements defined for how the script inventory (FR-001) handles discovery across deeply nested `apps/*/package.json` and `packages/*/package.json` paths without performance degradation? [Gap, Spec §FR-001]
- [ ] CHK020 — Is the performance impact of adding the `.sh` file extension to the refactor engine scope (per Clarifications §1) quantified — specifically how many shell script files are in scope and what the cost increase is? [Gap, Spec Clarifications §1, Spec §FR-004]

---

## Ambiguities and Conflicts

- [ ] CHK021 — Does the spec define a fallback strategy if validation scripts exceed CI timeout thresholds — is the job allowed to time-out silently, or must a partial violation report be emitted before timeout? [Ambiguity, Spec §FR-008, FR-009]
- [ ] CHK022 — Is "report-all mode" reconciled with CI time constraints — for a repository with hundreds of violations, can exhaustive reporting complete within CI step timeouts? [Conflict Risk, Spec Clarifications §2, Spec §FR-008]
