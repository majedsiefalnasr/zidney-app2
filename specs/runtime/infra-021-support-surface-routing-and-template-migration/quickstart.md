# Quickstart: Support Surface Routing and Template Migration

## Goal

Execute the INFRA-21 migration as a bounded repository-governance change that establishes one routing authority, preserves compatibility while consumers migrate, and avoids runtime or tenant redesign.

## Preconditions

- Work from `spec/infra-021-support-surface-routing-and-template-migration`.
- Treat `.agents/agents/`, `.agents/prompts/`, and `specs/templates/` as the canonical routing roots.
- Treat `.github/*` and `.specify/templates/*` as compatibility surfaces until the same batch has migrated all affected consumers.
- Do not change tenant isolation, runtime authority, license enforcement, attempt behavior, or module boundaries.
- Do not delete any governed surface without blast-radius evidence showing zero unresolved references or a complete replacement path.

## Step 1: Build the support-surface inventory

Inventory every in-scope surface:

- `.agents/agents/`
- `.agents/prompts/`
- `.github/agents/`
- `.github/prompts/`
- `.specify/templates/`
- `specs/templates/`
- `.specify/scripts/bash/`
- `coverage/.tmp/coverage-*.json`
- `tsconfig.base.json.backup`
- affected guidance and validation surfaces

For each surface, record:

- current role
- authoritative category, if any
- live consumers
- guidance references
- validation dependencies
- provisional disposition

## Step 2: Publish routing authority before rewiring consumers

Create `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md` with one entry each for agents, prompts, and templates.

Each entry must include:

- authoritative root
- legacy compatibility surfaces
- migration policy
- retirement criteria
- validation evidence required before removal

Do not retire legacy surfaces in this step.

## Step 3: Rewire live first-party consumers in one batch

Update all touched first-party consumers together:

- `.specify/scripts/bash/create-new-feature.sh`
- `.specify/scripts/bash/setup-plan.sh`
- `.specify/scripts/bash/update-agent-context.sh`
- affected Speckit agent or prompt instructions
- affected Hard Mode or contributor docs

The batch is incomplete if any touched consumer still points at an old authority model without an explicit compatibility rule.

## Step 4: Preserve compatibility surfaces explicitly

After consumer rewiring:

- keep `.github/agents/` and `.github/prompts/` as compatibility-only surfaces until retirement criteria are met
- keep `.specify/templates/` as a temporary compatibility surface until all live template consumers are moved and validated
- add redirects, mirroring rules, or explicit role separation as needed to prevent silent divergence

If compatibility behavior is ambiguous, retain the surface and record the open condition instead of deleting it.

## Step 5: Resolve root support artifacts conservatively

For `tsconfig.base.json.backup` and `coverage/.tmp/coverage-*.json`:

- collect blast-radius evidence
- decide whether the artifact is `remove`, `retain`, or `regenerate_and_ignore`
- pair any generated-output cleanup with ignore-policy or regeneration-path confirmation

Ambiguity defaults to retention or escalation.

## Step 6: Run the full validation set

Required commands:

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
bun run validate:workflows
```

Also verify any touched routing entrypoints directly:

- `.specify/scripts/bash/create-new-feature.sh`
- `.specify/scripts/bash/setup-plan.sh`
- `.specify/scripts/bash/update-agent-context.sh`
- affected `.github/*` and `.agents/*` loading paths

## Step 7: Retire compatibility surfaces only when the registry says they are ready

Legacy surfaces may move from `mirror_for_compatibility` to `remove` only when:

- all recorded consumer classes are migrated
- direct entrypoint checks pass
- the governance validation set passes or baseline failures are documented as unrelated
- the routing authority registry records the retirement criteria as satisfied

If any of these conditions fail, keep the compatibility surface and defer retirement.

## Completion Criteria

The stage is ready for task generation when:

- every in-scope support surface has an explicit disposition
- the routing authority registry contract is fully defined
- the migration batches are ordered and reversible
- validation coverage includes both governance checks and contributor entrypoint checks
- no runtime, tenant, or architecture redesign has been introduced
