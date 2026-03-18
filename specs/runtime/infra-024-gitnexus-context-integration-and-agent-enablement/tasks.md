# Tasks: GitNexus Context Integration and Agent Enablement

**Stage:** INFRA-024  
**Phase:** 01_PLATFORM_FOUNDATION  
**Branch:** `spec/infra-024-gitnexus-context-integration-and-agent-enablement`  
**Total Tasks:** 17

---

## Phase 0 — Pre-Flight: Package Installation

- [ ] T001 Install gitnexus as devDependency via `bun add -D gitnexus` — package.json / bun.lockb

---

## Phase 1 — Schema Design

- [ ] T002 Create JSON Schema Draft-07 with 9 required fields, array/object constraints, `riskScore` range, `hash` pattern, and `additionalProperties` omitted for extensibility — docs/ai/gitnexus-context.schema.json
- [ ] T003 [P] Create minimal ArchitectureBrain fixture with 3 modules and 2 layers — tests/fixtures/gitnexus/mock-brain.json
- [ ] T004 [P] Create sample `git diff --name-only` output with 2–3 file paths — tests/fixtures/gitnexus/mock-git-changed.txt
- [ ] T005 [P] Create sample `git log` output with 3 commits in pipe-delimited format — tests/fixtures/gitnexus/mock-git-log.txt

---

## Phase 2 — Core Implementation: Wrapper Script

- [ ] T006 Full replace with JSDoc metadata header, TypeScript interfaces (RecentCommit, RiskIndicator, GitNexusContext), 8 exported pure functions (detectChangedFiles, mapFilesToModules, buildDependencyGraph, buildArchitectureLayerMap, extractGitHistory, computeRiskIndicators, checkGitNexusHealth, assembleContext), CLI arg parsing (--changed-files-only, --dry-run, --output, --all, --base-ref), error handling for all 5 failure modes, deterministic sort guarantees, and main() — scripts/gitnexus-context.ts

---

## Phase 3 — Validation Script

- [ ] T007 Create validation script with JSDoc metadata header, 5-step pipeline (load schema, run context script, parse JSON, validate structure and types, check field presence), structured JSON error output to stderr, exit 0/1 — scripts/validate/validate-gitnexus.ts

---

## Phase 4 — Test Harness

- [ ] T008 Create Vitest suite with 5 deterministic test cases (TC-001 changed files sorted; TC-002 dependency mapping accuracy; TC-003 architecture layer correctness; TC-004 git history 4-field objects; TC-005 assembleContext output satisfies GitNexusContext), using vi.mock for node:child_process and node:fs — tests/gitnexus-context.test.ts

---

## Phase 5 — Orchestrator and AGENTS.md Integration

> Phases 5 and 6 may run in parallel with Phases 3–4 once Phase 1 is complete.

- [ ] T009 [P] Add "GitNexus Context Bootstrap (Mandatory)" subsection after Deterministic Sources of Truth, insert step 6.2A "Refresh GitNexus Context" before 6.3 PRE, and add GitNexus pre-closure validation block to the parallel guardian list — .agents/agents/zidney-orchestrator.agent.md
- [ ] T010 [P] Add "GitNexus Context Usage Policy (Binding)" section with 3-point usage mandate, prohibited behaviors list, execution mechanism, and policy scope note — AGENTS.md

---

## Phase 6 — CI Gate and package.json Scripts

> Phase 6 may run in parallel with Phase 5.

- [ ] T011 [P] Add `gitnexus:context` and `gitnexus:validate` script keys following `<domain>:<action>` naming — package.json
- [ ] T012 [P] Create CI gate documentation covering gate command, failure conditions, pass condition (empty arrays valid), and target execution time — docs/ci/gitnexus-validation.md

---

## Phase 7 — Documentation

> Phase 7 requires Phase 2 complete. All three docs tasks are independent and may run in parallel.

- [ ] T013 [P] Create primary GitNexus documentation with 5 required sections (overview, local usage steps, output structure field reference, orchestrator lifecycle, troubleshooting) — docs/ai/gitnexus.md
- [ ] T014 [P] Create script documentation covering purpose, all CLI arguments, output file path, dependencies, example invocations, and error exit codes — docs/scripts/gitnexus-context.md
- [ ] T015 [P] Create validation script documentation covering purpose, each validation step, exit codes, stderr error JSON format, and CI integration instructions — docs/scripts/validate-gitnexus.md

---

## Validation Gate

- [ ] T016 Verify script key naming compliance — run `bun run validate-runtime-scripts` and confirm zero violations — package.json
- [ ] T017 Verify all 5 test cases pass deterministically with no live git state — tests/gitnexus-context.test.ts
