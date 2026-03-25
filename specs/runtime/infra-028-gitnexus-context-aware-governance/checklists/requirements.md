# Requirements Checklist: INFRA-28 — GitNexus Context-Aware Governance

**Purpose**: Validate that specification requirements are complete, clear, and implementable — "unit tests for the English in the spec"
**Created**: 2026-03-25
**Feature**: [spec.md](../spec.md)
**Stage**: INFRA-28 — GitNexus Context-Aware Governance
**Risk Level**: LOW (pure tooling stage — no DB, no tenant logic, no auth)

---

## Spec Quality (Phase Gate: Approved ✓)

- [x] CHK001 - Are all mandatory spec sections complete (Goals, Non-Goals, FRs, NFRs, ACs, Dependencies, Risks, Assumptions)? [Completeness]
- [x] CHK002 - Are all [NEEDS CLARIFICATION] markers resolved, including the delegation strategy for FR-015? [Completeness]
- [x] CHK003 - Is success measurable via the AC table (AC-01–AC-18) with verification commands? [Measurability]
- [x] CHK004 - Are all four user stories (US1–US4) supported by three acceptance scenarios each? [Coverage]
- [x] CHK005 - Are scope boundaries explicit — Goals, Non-Goals, and Out of Scope sections all present? [Completeness]
- [x] CHK006 - Are all stage dependencies listed with the originating stage and the artifact required? [Traceability, Spec §Dependencies]

---

## Requirement Completeness

- [ ] CHK007 - Are the required-field list and schema version for `context:validate` sourced from `docs/ai/gitnexus-context.schema.json` rather than hardcoded — consistent with the Clarifications answer? [Completeness, Spec §FR-005, §Clarifications]
- [ ] CHK008 - Are `--dry-run`, `--all`, and `--base-ref` behaviors for `context:build` fully specified (stdout vs. file, scope rules, exit codes)? [Completeness, Spec §FR-002]
- [ ] CHK009 - Are `--json` and `--depth` behaviors for `context:impact` specified, including default depth ("unbounded") and exit codes? [Completeness, Spec §FR-004]
- [ ] CHK010 - Is the meaning of "same git state" for the determinism guarantee (staged files, HEAD ref, or both) explicitly defined? [Completeness, Spec §FR-013]
- [ ] CHK011 - Is the 5-minute freshness window for `context:changed` artifact cache explicitly cross-referenced in all scripts that read from it? [Completeness, Spec §FR-003]
- [ ] CHK012 - Are `CONTEXT_MAX_AGE_HOURS` override semantics (default value, env var name, scope) documented and traceable to an NFR or Risk entry? [Completeness, Spec §Risk Assessment]
- [ ] CHK013 - Is the expected downstream behavior when `context:changed` returns an empty list explicitly defined for `arch:guard:changed` and `validate:runtime:scripts`? [Completeness, Spec §Edge Cases]
- [ ] CHK014 - Is the `RiskIndicator[]` schema for `context:impact --json` (`module`, `riskScore`, `reason`, `affectedBy`) traced to a single canonical source (`gitnexus-context.ts`)? [Completeness, Spec §FR-004, §Clarifications]

---

## Requirement Clarity & Consistency

- [ ] CHK015 - Is the distinction between `context:changed` (shared cache resolver) and `arch:guard:changed` (opaque validation guard) captured in a way that prevents future conflation? [Clarity, Spec §Clarifications]
- [ ] CHK016 - Does FR-003 make clear that `context:changed` outputs to **stdout only** (not to a separate `context-changed.json` file) and that caching occurs via the shared `gitnexus-context.json`? [Clarity, Spec §FR-003]
- [ ] CHK017 - Does FR-004 make clear that `context:impact` outputs to **stdout only** (not to a separate `context-impact.json` file)? [Clarity, Spec §FR-004]
- [ ] CHK018 - Is the 5-minute freshness threshold used in FR-003 (cache hit window) consistent with and differentiated from the 24-hour threshold in FR-005 (staleness gate)? [Consistency, Spec §FR-003, §FR-005]
- [ ] CHK019 - Is the requirement that `context:validate` is a superset of `arch:validate:gitnexus` (adds freshness) and must NOT replace or alias it sufficiently explicit? [Clarity, Spec §FR-005]
- [ ] CHK020 - Is the POSIX atomic rename behavior (write to `.tmp` then rename) specified with enough precision to cover the cross-device failure edge case documented in the Risk table? [Clarity, Spec §FR-014, §Risk Assessment]
- [ ] CHK021 - Does the spec define whether `.husky/pre-commit` also requires `bun run arch:context:validate` — FR-010 only names `context:changed`, yet full-gate integrity implies validate should also run pre-commit? [Clarity, Gap, Spec §FR-010]

---

## Script Directory & Structure Requirements (FR-001, FR-007, FR-016)

- [ ] CHK022 - Are exactly four files (`build.ts`, `changed.ts`, `impact.ts`, `validate.ts`) and no others specified for `scripts/context/`? [Completeness, Spec §FR-001, §AC-01]
- [ ] CHK023 - Are all five metadata header fields (`@script`, `@domain`, `@category`, `@description`, `@usage`) required for each `scripts/context/*.ts` file? [Completeness, Spec §FR-007, §AC-03]
- [ ] CHK024 - Is `context` registered as a new canonical domain in the `script-system-governance` skill, and is this treated as an in-scope INFRA-28 deliverable? [Completeness, Spec §FR-007, §AC-18, §Assumptions §5]
- [ ] CHK025 - Does `validate:runtime:scripts` (INFRA-25) pass for all four new scripts without requiring exception entries in any allowlist? [Acceptance, Spec §FR-016, §AC-03]
- [ ] CHK026 - Are all four `scripts/context/*.ts` files listed in the script registry that `validate:runtime:scripts` checks — no orphan scripts? [Completeness, Spec §FR-016]

---

## Script Command Registration & Backward Compatibility (FR-006, NFR-007)

- [ ] CHK027 - Are all four `context:*` entries registered in root `package.json` with exact file paths matching the FR-006 table? [Completeness, Spec §FR-006, §AC-02]
- [ ] CHK028 - Are `arch:gitnexus:context`, `arch:context`, and `arch:validate:gitnexus` aliases specified as preserved unchanged — not removed, not redirected? [Completeness, Spec §NFR-007, §AC-15]
- [ ] CHK029 - Is `arch:gitnexus:context` explicitly specified to delegate to `scripts/gitnexus-context.ts` directly, not through `context:build`, to avoid a circular dependency risk? [Clarity, Spec §NFR-007]

---

## `context:build` Requirements (FR-002, FR-014, FR-015)

- [ ] CHK030 - Is `context:build` specified to delegate to `assembleContext()` from `scripts/gitnexus-context.ts` (Strategy 1 confirmed in Assumptions §1) and prohibited from re-implementing generation? [Completeness, Spec §FR-015, §Assumptions §1]
- [ ] CHK031 - Is the atomic write sequence specified as: write to `gitnexus-context.json.tmp` in the same output directory, then `fs.renameSync` to the target path? [Completeness, Spec §FR-014, §AC-17]
- [ ] CHK032 - Is `context:build --dry-run` specified to print to stdout and leave `gitnexus-context.json` mtime unchanged? [Completeness, Spec §AC-17, §FR-002]
- [ ] CHK033 - Is the graceful failure mode (exit `1` + named diagnostic) specified for when `docs/ai/context/ai-architecture-brain.json` is absent? [Completeness, Spec §Edge Cases, §Dependencies]
- [ ] CHK034 - Is branch-ref recovery from `GITHUB_HEAD_REF` / `GITHUB_REF_NAME` in detached HEAD state specified, referencing the pattern in `scripts/ai-guard.ts`? [Completeness, Spec §Edge Cases]

---

## `context:changed` Requirements (FR-003)

- [ ] CHK035 - Is the cache-hit path (artifact < 5 min) and cache-miss path (git diff fallback) explicitly specified with the appropriate base-ref difference (staged files for pre-commit, `HEAD` for CI)? [Completeness, Spec §FR-003]
- [ ] CHK036 - Is exit `0` with empty output specified for clean-tree invocation (no staged changes)? [Completeness, Spec §FR-003, §US1 AC2]
- [ ] CHK037 - Is exit `1` with a clear diagnostic specified for malformed git state (no commits)? [Completeness, Spec §US1 AC3]
- [ ] CHK038 - Is the `--json` flag output format (JSON array of strings) specified with a stable sort guarantee? [Completeness, Spec §FR-003]

---

## `context:impact` Requirements (FR-004)

- [ ] CHK039 - Is BFS traversal from `dependencyGraph` in the context artifact specified as the mechanism, with the input fields (`changedFiles`, `dependencyGraph`) named explicitly? [Completeness, Spec §FR-004]
- [ ] CHK040 - Is `context:impact --json` output specified as `RiskIndicator[]` with synthesized BFS fields (`riskScore = depth`, `reason = "transitively affected via <module>"`, `affectedBy = root changed paths`)? [Completeness, Spec §Clarifications]
- [ ] CHK041 - Is exit `1` on artifact read failure (distinct from "empty dependents" which exits `0`) explicitly specified? [Completeness, Spec §FR-004]

---

## `context:validate` Requirements (FR-005)

- [ ] CHK042 - Are all nine required fields (`schemaVersion`, `generatedAt`, `analysisMode`, `changedFiles`, `impactedModules`, `dependencyGraph`, `architectureLayerMap`, `recentCommits`, `riskIndicators`) sourced from `docs/ai/gitnexus-context.schema.json` `required` array, not hardcoded? [Completeness, Spec §FR-005, §Clarifications]
- [ ] CHK043 - Is schema version validation specified as reading the top-level `version` field from `gitnexus-context.schema.json` and comparing to `artifact.schemaVersion`? [Completeness, Spec §FR-005, §Clarifications]
- [ ] CHK044 - Are all four failure-exit paths (absent artifact, missing field, version mismatch, staleness) specified with named diagnostics? [Completeness, Spec §FR-005, §US2 AC2–AC3]
- [ ] CHK045 - Is the validation implementation specified as plain key enumeration (no external JSON Schema library), consistent with NFR-005 no-new-dependencies? [Completeness, Spec §NFR-005, §Clarifications]

---

## Governance Gate Integration (FR-008, FR-009)

- [ ] CHK046 - Is `governance:gate` specified with `context:build` as Step 0 and `context:validate` as Step 1 before all pre-existing guards? [Completeness, Spec §FR-008, §AC-09]
- [ ] CHK047 - Is fail-fast behavior on `context:build` or `context:validate` failure (no subsequent guards run) specified as the only exception to the report-all behavior from INFRA-27? [Completeness, Spec §FR-008, §AC-10]
- [ ] CHK048 - Is `governance:gate:changed` specified with `context:changed` as Step 0 before `arch:guard:changed` (Step 1) and `validate:runtime:scripts` (Step 2)? [Completeness, Spec §FR-009, §AC-11]
- [ ] CHK049 - Is the fail-fast semantics for `governance:gate:changed` (short-circuit on first failure) explicitly retained from INFRA-27? [Consistency, Spec §FR-009]

---

## Infrastructure Integration (FR-010, FR-011, FR-012)

- [ ] CHK050 - Is `.husky/pre-commit` specified to include `bun run arch:context:changed` before `governance:gate:changed`, with the note that the shared artifact wires the two steps implicitly? [Completeness, Spec §FR-010, §AC-12]
- [ ] CHK051 - Are the two new CI steps (`Build Context` + `Validate Context`) specified as positioned **before** the Unified Governance Gate step in `architecture-governance.yml`? [Completeness, Spec §FR-011, §AC-13]
- [ ] CHK052 - Is it specified whether any existing `arch:gitnexus:context` call in the CI workflow should be removed or coexist with the new `context:build` step? [Clarity, Spec §FR-011]
- [ ] CHK053 - Is the orchestrator agent definition update specified: `context:build` at Step 5 with diagnostic surface, and `governance:gate:changed` / `governance:gate` implicitly consuming the artifact at Steps 6 and 7? [Completeness, Spec §FR-012, §AC-14]

---

## Determinism & Non-Functional Requirements (FR-013, NFR-001–NFR-007)

- [ ] CHK054 - Are all four `context:*` scripts specified as idempotent (same git state → same output + exit code), with the note that only `context:build` has side effects? [Completeness, Spec §FR-013, §NFR-004]
- [ ] CHK055 - Are performance thresholds measurable and ID-tagged: `context:changed` < 2s (NFR-001), `context:build` changed-only < 5s (NFR-002), `context:validate` < 1s (NFR-003)? [Measurability, Spec §NFR-001–NFR-003]
- [ ] CHK056 - Is the no-new-dependencies requirement (NFR-005) specified as allowing only Bun built-ins and imports already present in `gitnexus-context.ts`? [Completeness, Spec §NFR-005]
- [ ] CHK057 - Is CLI argument allowlist validation (NFR-006) specified as referencing the `validateCliArg` pattern from `scripts/gitnexus-context.ts`, not a new implementation? [Completeness, Spec §NFR-006]

---

## TypeScript Quality & Test Coverage

- [ ] CHK058 - Are TypeScript strict-mode requirements (no `any`, proper types) explicitly traceable to the `typescript-governance` skill or a named NFR — or is this currently an implied-only constraint? [Traceability, Gap — no explicit NFR in spec]
- [ ] CHK059 - Are unit tests for `context:validate` schema validation logic (schema read, required-field presence, version match, staleness) specified as a required deliverable, not an optional quality item? [Coverage, Gap, Spec §AC-07–AC-08]
- [ ] CHK060 - Is an integration test for `governance:gate` fail-fast behavior (context:validate failure → no downstream guards run) specified as required? [Coverage, Gap, Spec §AC-10]

---

## Summary

| Category                                  | Items  | ID Range      |
| ----------------------------------------- | ------ | ------------- |
| Spec Quality (Approved ✓)                 | 6      | CHK001–CHK006 |
| Requirement Completeness                  | 8      | CHK007–CHK014 |
| Requirement Clarity & Consistency         | 7      | CHK015–CHK021 |
| Script Directory & Structure              | 5      | CHK022–CHK026 |
| Command Registration & Backward Compat    | 3      | CHK027–CHK029 |
| `context:build` Requirements              | 5      | CHK030–CHK034 |
| `context:changed` Requirements            | 4      | CHK035–CHK038 |
| `context:impact` Requirements             | 3      | CHK039–CHK041 |
| `context:validate` Requirements           | 4      | CHK042–CHK045 |
| Governance Gate Integration               | 4      | CHK046–CHK049 |
| Infrastructure Integration                | 4      | CHK050–CHK053 |
| Determinism & Non-Functional Requirements | 4      | CHK054–CHK057 |
| TypeScript Quality & Test Coverage        | 3      | CHK058–CHK060 |
| **Total**                                 | **60** |               |
