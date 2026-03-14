# Research: Repository Sanitization and Dead Code Elimination

## Decision: Use a multi-source repository scan instead of a code-import-only scan

**Rationale**: This stage targets scripts, workflows, hooks, skills, documents, generated artifacts, and dependencies in addition to source code. Import analysis alone would miss governance wiring through `package.json`, CI YAML, Git hooks, AGENTS instructions, skill files, and architecture-intelligence generation paths.

**Alternatives considered**:

- Import-only scan: Rejected because it would produce false positives for low-frequency but required governance assets.
- Manual directory review: Rejected because it is not deterministic or repeatable enough for guardian validation.

## Decision: Classify removability using an explicit evidence model

**Rationale**: Dead-asset elimination is safe only if every removal can be justified from auditable evidence. The plan therefore uses code, governance, execution, structural, duplication, and risk evidence before an asset can move to `remove`.

**Alternatives considered**:

- Simple unused-or-not heuristic: Rejected because repository assets often have non-code execution paths.
- Last-modified or low-frequency heuristics: Rejected because important governance assets may be intentionally low-touch.

## Decision: Protect governance-critical assets through a hard allowlist plus derived rules

**Rationale**: Zidney’s governance pipeline depends on a small set of architecture and AI assets that may look duplicative or low-frequency. A hard allowlist prevents accidental deletion, while derived protection covers additional assets reached indirectly through CI, hooks, or agent-routing instructions.

**Alternatives considered**:

- Case-by-case reviewer judgment only: Rejected because it creates inconsistent outcomes.
- Protect directories only: Rejected because critical root files and script wiring also need preservation.

## Decision: Consolidate duplicates by governed purpose, not just file similarity

**Rationale**: Two files can look different while serving the same repository-governance purpose, and two similar files can still have distinct roles. Grouping by governed purpose preserves intent and reduces the risk of deleting behavior that still matters.

**Alternatives considered**:

- Filename similarity matching: Rejected because it misses semantic duplicates and overflags coincidental naming overlap.
- Keep all overlapping artifacts: Rejected because it fails the stage goal of reducing repository noise.

## Decision: Reuse the existing Zidney validation chain as the acceptance gate

**Rationale**: This stage is governance maintenance, so success is defined by preserving the current quality and architecture enforcement chain. The minimum gate set from the clarified spec is sufficient and already aligned with repository expectations.

**Alternatives considered**:

- Create a sanitization-specific validator only: Rejected because it would create a parallel safety system and dilute trust in the existing guardrails.
- Validate with lint and tests only: Rejected because architecture and AI-context integrity are first-class outcomes for this stage.

## Decision: Use batch-based reversible cleanup with inventory-first rollback

**Rationale**: Sanitization touches many asset classes and can produce broad diffs. Small reversible batches, each tied back to the sanitization inventory, limit blast radius and simplify reclassification when a candidate proves active.

**Alternatives considered**:

- One-pass cleanup across the entire repository: Rejected because failures would be harder to localize and unwind.
- Destructive reset-based rollback: Rejected because it conflicts with repository safety practices and could discard unrelated work.

## Decision: Keep the plan architecture-neutral and constitutionally explicit

**Rationale**: The stage is about repository hygiene, not platform redesign. The plan therefore makes explicit that tenant isolation, license enforcement, attempt engine integrity, runtime authoritative time, and module boundaries are non-targets and must remain unchanged.

**Alternatives considered**:

- Fold opportunistic runtime refactors into cleanup: Rejected because that expands scope and makes guardian validation ambiguous.
- Consolidate boundary changes under “sanitization”: Rejected because it would violate the stage’s infrastructure-governance scope.
