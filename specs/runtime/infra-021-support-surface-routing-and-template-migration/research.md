# Research: Support Surface Routing and Template Migration

## Decision: Treat `.agents/agents/`, `.agents/prompts/`, and `specs/templates/` as the only authoritative routing roots

**Rationale**: The clarified specification and stage file already lock these roots as canonical, and the current repository state supports that direction. `.agents/*` contains the broader Zidney-local agent surface, while `specs/templates/*` is already the documented governance authority in Hard Mode guidance and Zidney orchestration instructions.

**Alternatives considered**:

- Keep `.github/*` as co-equal routing authority: Rejected because it preserves the ambiguity this stage exists to remove.
- Keep `.specify/templates/*` as the execution authority: Rejected because it conflicts with the documented governance template system and would prolong silent divergence risk.

## Decision: Use first-party consumer evidence plus INFRA-16 deferred-scope evidence as the migration baseline

**Rationale**: The blast radius is already partially known from INFRA-16, and the current repository still has live consumers on the compatibility paths. Evidence from `.specify/scripts/bash/setup-plan.sh`, `.specify/scripts/bash/create-new-feature.sh`, `.specify/scripts/bash/update-agent-context.sh`, and the INFRA-16 evidence matrix is enough to define a migration-safe plan without reopening architecture scope.

**Alternatives considered**:

- Run a fresh repository search only: Rejected because it would ignore already-audited deferred-scope evidence and duplicate effort.
- Rely on documentation claims alone: Rejected because live script consumers still prove the legacy paths matter operationally.

## Decision: Classify governed support surfaces using explicit compatibility-aware dispositions

**Rationale**: This stage is not a delete-first cleanup. It needs a model that distinguishes authoritative survivors from temporary mirrors, generated-output cleanup, and unresolved cases. The chosen dispositions are `retain`, `migrate`, `mirror_for_compatibility`, `remove`, `regenerate_and_ignore`, and `escalate`.

**Alternatives considered**:

- Binary keep/delete classification: Rejected because it cannot model safe compatibility retention.
- Manual notes without fixed states: Rejected because it makes later task generation and validation ambiguous.

## Decision: Create `docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md` as the single routing source of truth

**Rationale**: Future cleanup and contributor updates need one control document that explicitly records the authoritative root, legacy surfaces, consumer classes, migration policy, and retirement criteria for each routing category. Putting the registry under architecture intelligence keeps it in the existing governance lane without redesigning runtime architecture.

**Alternatives considered**:

- Put routing authority notes only in the stage spec: Rejected because later stages need a reusable operational control outside a single stage document.
- Store the registry in `.specify/`: Rejected because template execution tooling is part of the migration subject and should not own the authority model.

## Decision: Sequence migration as registry first, template parity second, consumer rewiring third, compatibility hardening fourth, retirement fifth, and authorized cleanup last

**Rationale**: Current consumers still point at legacy paths. The safe order is to declare authority, update all touched first-party consumers in the same batch, preserve the legacy surfaces as compatibility paths, validate, and only then evaluate retirement. This sequence satisfies the clarified spec’s same-batch migration rule without forcing premature deletion.

**Alternatives considered**:

- Delete or move legacy surfaces first: Rejected because `.specify/scripts/bash/*` and `.github/agents/*` still participate in active contributor workflows.
- Maintain indefinite mirrors with no retirement criteria: Rejected because it would fail the stage goal of routing clarity.

## Decision: Keep validation on the existing Zidney governance chain and add direct shell-entrypoint verification

**Rationale**: The authoritative risk in this stage is broken contributor routing, not runtime logic. The existing validation chain covers architecture and governance safety, and direct verification of `create-new-feature.sh`, `setup-plan.sh`, and `update-agent-context.sh` covers the migration-specific entrypoints.

**Alternatives considered**:

- Validate with lint and tests only: Rejected because routing and governance regressions can survive those checks.
- Introduce a new migration-only validator: Rejected because the repository already has the required guardrails.

## Decision: Keep runtime, tenant, and contributor-workflow redesign out of scope

**Rationale**: The stage exists to resolve support-surface routing ambiguity, not to redesign how Zidney works. The plan therefore refuses runtime or tenant changes and treats contributor workflow changes as compatibility-preserving rewiring only.

**Alternatives considered**:

- Fold contributor workflow redesign into the migration: Rejected because it widens scope and complicates validation.
- Use this stage to rationalize broader architecture governance: Rejected because no ADR authorizes that expansion.

## Decision: Treat `coverage/.tmp/coverage-*.json` as a regeneration-policy decision and `tsconfig.base.json.backup` as an evidence-gated removal candidate

**Rationale**: The coverage temp files look generated, but the stage still needs to pair any cleanup with ignore-policy or regeneration-path confirmation. The backup tsconfig file looks stale, but removal should wait until implementation evidence confirms no hidden consumer exists.

**Alternatives considered**:

- Delete both immediately based on current text search results: Rejected because the stage explicitly requires blast-radius evidence before deletion.
- Ignore both artifacts in planning: Rejected because they are part of the widened support-surface scope.
