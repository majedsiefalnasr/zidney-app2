# Implementation Plan: Repository Sanitization and Dead Code Elimination

**Branch**: `spec/infra-016-repository-sanitization-and-dead-code-elimination` | **Date**: 2026-03-14 | **Spec**: `/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2/specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/spec.md`
**Input**: Feature specification from `/Users/majedsiefalnasr/Documents/Work/MAJED/zidney-app2/specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/spec.md`

## Summary

This stage plans a repository-wide sanitization pass that removes dead assets, consolidates authoritative duplicates, and trims unused dependencies without changing Zidney runtime architecture or weakening governance enforcement. The technical approach is evidence-first: classify every in-scope asset using repository scan evidence, preserve an explicit protected-asset allowlist, require zero unresolved references before removal, and validate the resulting repository against the existing governance chain.

## Technical Context

**Language/Version**: TypeScript 5.x, Bun workspace scripts, Bash shell tooling, Markdown/YAML/JSON governance assets  
**Primary Dependencies**: Bun, Vitest, Biome, Husky, Prettier, actionlint, architecture guard tooling, infra audit tooling, AI context generation scripts  
**Storage**: Repository filesystem artifacts only; no database or tenant schema changes  
**Testing**: `bun run lint`, `bun run typecheck`, `bun run test`, `bun run arch:guard`, `bun scripts/ai-guard.ts`, `bun scripts/architecture-diff.ts`, `bun scripts/infra-audit.ts`, `bun scripts/validate-architecture-brain.ts`, `bun run type-safety-guard`, `bun run ai-context:refresh`, workflow linting where relevant  
**Target Platform**: macOS/Linux developer environments and CI runners  
**Project Type**: Monorepo infrastructure-governance stage  
**Performance Goals**: Produce a repeatable full-repository classification pass without requiring runtime service startup; prioritize deterministic evidence over scan speed  
**Constraints**: No tenant, license, attempt engine, schema, or runtime boundary changes; no architectural redesign; no asset removal with unresolved references; governance-critical assets must remain protected  
**Scale/Scope**: Repository scan across `apps/`, `packages/`, `scripts/`, `.agents/skills/`, `docs/`, `.github/workflows/`, `.husky/`, and root `package.json`; supporting evidence surfaces such as `tests/`, `bun.lock`, `vitest.config.ts`, `vitest.workspace.ts`, and `lint-staged.config.mjs` may be read or minimally updated only to preserve reference integrity after approved cleanup

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Pre-Research Gate

- PASS: No change to database-per-tenant isolation or tenant resolution paths. ADR-0001 remains untouched.
- PASS: No change to license enforcement, compatibility validation, or request-boundary middleware ordering. ADR-0007 remains untouched.
- PASS: No change to attempt snapshotting, grading execution, or worker/runtime authority. ADR-0002 and ADR-0006 remain untouched.
- PASS: No change to module boundary rules, app/package layering, or trust-chain responsibilities.
- PASS: Stage scope is repository sanitization only, consistent with the feature spec and stage file.

### Post-Design Re-Check

- PASS: Design artifacts classify repository assets only; they do not introduce runtime redesign or new architectural surfaces.
- PASS: Protected-asset strategy explicitly preserves governance artifacts, CI wiring, hooks, and architecture intelligence paths.
- PASS: Validation and rollback design favor retention, traceability, and reversal over aggressive cleanup.

## Project Structure

### Documentation (this feature)

```text
specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/
├── README.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── reports/
└── audits/
```

### Source Code (repository root)

```text
apps/
packages/
scripts/
.agents/skills/
docs/
.github/workflows/
.husky/
package.json
```

### Evidence And Validation Surfaces

```text
tests/
bun.lock
vitest.config.ts
vitest.workspace.ts
lint-staged.config.mjs
```

**Structure Decision**: This is a documentation-first planning stage for a repository-governance change. The implementation surface is repository-wide classification and cleanup against existing roots rather than a new application or package.

## Phase 0 Research Outcomes

Research resolves the planning decisions needed to keep the sanitization pass safe and architecture-neutral:

- Repository scan methodology is multi-source and evidence-driven rather than based on import checks alone.
- Dead-asset classification uses explicit evidence categories and conservative decision rules.
- Protected governance assets are governed through an allowlist plus escalation path, not by ad hoc judgment.
- Duplicate consolidation preserves one authoritative artifact per purpose and records any lossless merge requirement.
- Validation gates are the existing Zidney governance commands, not a new parallel quality system.
- Rollback is file-oriented and commit-friendly, avoiding destructive repository operations.

See `research.md` for the full rationale.

## Phase 1 Design

### Repository Scan Methodology

The sanitization implementation should use a four-pass scan model:

1. Inventory pass

- Enumerate all in-scope assets by class: source module, package, script, workflow, hook, skill, documentation artifact, generated artifact, dependency, directory.

2. Reference pass

- Collect evidence from source imports, test usage, package scripts, workspace manifests, CI workflows, Git hooks, AGENTS instructions, skill definitions, AI-context generation, architecture-intelligence generation, and committed governance reports.

3. Classification pass

- Assign each asset one proposed state: `retain`, `protect`, `consolidate`, `remove`, or `manual_review`.

4. Validation pass

- Confirm candidate removals and consolidations against the minimum gate set before accepting the change set.

The scan must remain architecture-neutral: it may identify dead assets and duplicates, but it must not propose changes to tenancy, licensing, attempt execution, or runtime service boundaries.

### Evidence Model For Dead-Asset Classification

Each candidate should be evaluated against the following evidence dimensions:

- `code_reference`: direct imports, exports, workspace links, or runtime/test execution references.
- `governance_reference`: references from AGENTS, skills, architecture scripts, AI context generation, architecture reports, or committed governance outputs.
- `execution_reference`: package scripts, CI YAML, Git hooks, deployment tooling, or other script-to-script invocation.
- `evidence_reference`: committed governance reports, architecture health outputs, and generated AI-context artifacts that still prove a repository role.
- `structural_role`: intentional empty scaffolding, required directory contracts, generated baselines, or repository layout anchors.
- `duplication_evidence`: overlap with another artifact serving the same governed purpose.
- `risk_evidence`: potential to affect trust chain, architecture guard, CI, or contributor routing if removed.

Classification rules:

- `remove` requires zero unresolved references and no protected role.
- `consolidate` requires a defined survivor and proof that unique behavior/documentation is preserved.
- `manual_review` is mandatory when signals conflict or repository intent is ambiguous.
- `protect` overrides low-frequency usage when the artifact is governance-critical.

### Protected-Asset Allowlist Strategy

The plan uses two protection layers:

1. Hard allowlist

- `docs/ai/`
- `docs/architecture/`
- `.github/workflows/`
- `.husky/`
- `AGENTS.md`
- `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`
- `docs/AGENT_GOVERNANCE.md`
- `docs/PROJECT_CONTEXT_PRIMER.md`
  - `specs/STAGE_LIFECYCLE_POLICY.md`
  - `specs/phases/MASTER_EXECUTION_ROADMAP.md`
- `scripts/ai-guard.ts`
- `scripts/architecture-diff.ts`
- `scripts/infra-audit.ts`
- `scripts/type-safety-guard.ts`
- `scripts/generate-ai-context.ts`
- `scripts/gitnexus-context.ts`
- `scripts/validate-architecture-brain.ts`
- Root `package.json` script wiring for architecture, AI-context, typecheck, lint, test, and hook validation flows

2. Derived protection rules

- Any asset referenced by the governance chain, architecture intelligence generation, CI, hooks, or agent-routing instructions inherits protected status until explicitly superseded by another approved stage.

Protected assets may still be documented, reorganized, or consolidated in a future approved stage, but this stage does not authorize their silent deletion.

### Duplicate-Consolidation Strategy

Duplicate handling is purpose-based rather than file-type-based.

- Group candidate duplicates by governed purpose, such as architecture validation, test running, deployment, repo guidance, or agent skill routing.
- Protected governance roots may be grouped for audit and survivor analysis, but they remain `protect` or `manual_review` in this stage unless a separate approved stage explicitly supersedes them.
- Nominate one authoritative artifact per group using these tie-breakers: wired execution path, broader coverage, stronger governance alignment, lower maintenance cost, and lower blast radius.
- If duplicates contain distinct required behavior, merge that behavior into the survivor before deleting the redundant artifact.
- If the survivor cannot be identified without changing application boundaries or contributor workflow materially, mark the group `manual_review`.

### Validation Gates

The minimum acceptance gate set after any cleanup is:

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run arch:guard`
- `bun scripts/ai-guard.ts`
- `bun scripts/architecture-diff.ts`
- `bun scripts/infra-audit.ts`
- `bun scripts/validate-architecture-brain.ts`
- `bun run type-safety-guard`
- `bun run ai-context:refresh`

Where the cleanup touches workflow wiring, also run `bun run validate:workflows`. Where hook wiring changes, confirm `.github/workflows/` and `.husky/` remain present, referenced scripts still exist, and `package.json` plus `lint-staged.config.mjs` still resolve the expected hook commands. Regardless of workflow changes, confirm that protected governance authority files remain present and unmodified, including `AGENTS.md`, `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`, `docs/AGENT_GOVERNANCE.md`, `docs/PROJECT_CONTEXT_PRIMER.md`, `specs/STAGE_LIFECYCLE_POLICY.md`, `specs/phases/MASTER_EXECUTION_ROADMAP.md`, `.github/workflows/architecture-governance.yml`, `.husky/pre-commit`, and `.husky/pre-push`; the sole approved authority-file mutation in this stage is the explicit remediation of `.github/workflows/hard-mode-guard.yml` to enforce that wider authority set.

Each meaningful cleanup batch must run the minimum affected validation gates before the next batch begins, and only the failing batch may be rolled back or reclassified.

### Rollback Approach

Rollback is conservative and non-destructive:

- Record every proposed removal/consolidation in the sanitization inventory before modifying repository contents.
- Apply changes in small reversible batches grouped by asset class.
- Run the minimum affected validation gates immediately after each meaningful batch before proceeding.
- Preserve rename or move history where possible instead of delete-and-recreate patterns.
- If a validation gate fails, revert only the current batch and reclassify the offending candidate to `retain` or `manual_review`.
- Do not use destructive repository reset commands as part of the stage procedure.

### Impact And Risk Controls

- No scan or cleanup step may modify tenant resolution, license middleware, attempt lifecycle, worker authority, or runtime boundaries.
- No app-to-app or package-to-app dependency changes are authorized under this stage.
- Ambiguous candidates default to retention.
- Protected assets require explicit supersession evidence, not inferred inactivity.
- Cleanup reporting must make every decision auditable without reconstructing full repository history.
- Support surfaces outside the primary sanitization roots may be updated only to preserve reference integrity after an approved cleanup batch.

## Deliverables

- `plan.md`: execution model, constitutional guardrails, and validation design
- `research.md`: planning decisions and rationale
- `data-model.md`: entity model for the sanitization inventory and evidence system
- `quickstart.md`: operator workflow for executing the stage safely

No `contracts/` artifact is required because this stage does not define a new public API or external interface contract.

## Complexity Tracking

No constitution violations or justified exceptions are required for this plan.
