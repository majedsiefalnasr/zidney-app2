# Quickstart: Repository Sanitization and Dead Code Elimination

## Goal

Execute repository sanitization safely, with auditable evidence and no changes to Zidney constitutional boundaries.

## Preconditions

- Work from `spec/infra-016-repository-sanitization-and-dead-code-elimination`.
- Treat tenant isolation, license enforcement, attempt engine integrity, runtime authoritative time, and module boundaries as immutable for this stage.
- Do not delete anything that is still referenced by code, tests, scripts, CI, hooks, AGENTS guidance, skills, or architecture-intelligence flows.
- Treat `tests/`, `bun.lock`, `vitest.config.ts`, `vitest.workspace.ts`, and `lint-staged.config.mjs` as supporting evidence or reference-integrity surfaces, not primary cleanup targets.

## Step 1: Build the sanitization inventory

Inventory all assets in:

- `apps/`
- `packages/`
- `scripts/`
- `.agents/skills/`
- `docs/`
- `.github/workflows/`
- `.husky/`
- `package.json`

For each asset, capture:

- asset type
- governed purpose
- evidence sources checked
- provisional classification
- risk notes

Use supporting evidence from `tests/`, `bun.lock`, `vitest.config.ts`, `vitest.workspace.ts`, and `lint-staged.config.mjs` when it helps prove active usage or required reference integrity.

## Step 2: Apply the protection model

Mark the following as protected immediately:

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
- Root `package.json` governance script wiring

Then extend protection to any asset still required by the governance chain or contributor-routing instructions.

Protected governance roots may be grouped for audit and manual review, but they are not consolidation targets in this stage.

## Step 3: Classify candidates using evidence

Use these outcomes only:

- `protect`
- `retain`
- `consolidate`
- `remove`
- `manual_review`

Rules:

- `remove` only when no unresolved evidence remains.
- `consolidate` only when one authoritative survivor is identified.
- `manual_review` whenever evidence conflicts or intent is unclear.
- Ambiguity defaults to retention.

## Step 4: Execute cleanup in reversible batches

Preferred batch order:

1. Accidental generated artifacts and Finder noise
2. Empty scaffolding with no structural role
3. Dead dependencies or dead scripts with clear evidence
4. Duplicate consolidations with an identified authoritative survivor

Record every batch before applying it and keep rollback scoped to that batch only.

After each meaningful batch, run the minimum affected validation gates before starting the next batch.

## Step 5: Run validation gates after each meaningful batch

Minimum gate set:

```bash
bun run lint
bun run typecheck
bun run test
bun run arch:guard
bun scripts/ai-guard.ts
bun scripts/architecture-diff.ts
bun scripts/infra-audit.ts
bun scripts/validate-architecture-brain.ts
bun run type-safety-guard
bun run ai-context:refresh
```

If workflow or hook wiring changes, also validate those paths explicitly. In all cases, verify that `AGENTS.md`, `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`, `docs/AGENT_GOVERNANCE.md`, `docs/PROJECT_CONTEXT_PRIMER.md`, `specs/STAGE_LIFECYCLE_POLICY.md`, `specs/phases/MASTER_EXECUTION_ROADMAP.md`, `.github/workflows/architecture-governance.yml`, `.husky/pre-commit`, and `.husky/pre-push` remain present and unmodified. The only approved authority-file mutation in this stage is the explicit governance-remediation change to `.github/workflows/hard-mode-guard.yml`.

Workflow and hook integrity is considered valid only when `bun run validate:workflows` passes for touched workflow files, `.github/workflows/` and `.husky/` remain present, referenced scripts still exist, `package.json` and `lint-staged.config.mjs` still resolve the expected hook commands, protected governance authority files remain present and unmodified, and no cleaned path leaves a broken reference behind.

## Step 6: Roll back on gate failure

If a batch fails validation:

- revert that batch only
- reclassify the offending asset to `retain` or `manual_review`
- rerun the failed gate and continue only after the repository returns to a valid state

## Completion Criteria

The stage is ready for guardian validation when:

- every in-scope asset has a recorded decision
- every removal has zero unresolved evidence of active use
- every duplicate group has one authoritative outcome or an explicit manual-review status
- the minimum validation gate set passes, or any pre-existing baseline failures are documented as out of scope
- no tenant, license, attempt, runtime, or module-boundary changes were introduced
