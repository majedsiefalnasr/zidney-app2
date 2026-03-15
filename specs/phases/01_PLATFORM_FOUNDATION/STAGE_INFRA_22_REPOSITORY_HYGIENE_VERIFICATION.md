# STAGE_INFRA_22_REPOSITORY_HYGIENE_VERIFICATION

## Stage Purpose

This stage performs a final repository hygiene verification after the routing, template, and support-surface migrations introduced in INFRA‑21. It ensures the repository no longer contains duplicate routing surfaces, stale template systems, unused dependencies, or dead scripts.

Unlike INFRA‑16 (conservative sanitization), this stage is **verification-focused**. It confirms that prior migrations produced a stable and clean repository state.

No structural migrations should occur in this stage. Only verification, detection, and safe cleanup actions are allowed.

---

# Stage Objectives

1. Verify that routing authority decisions from the routing registry are enforced.
2. Confirm template system consolidation.
3. Detect any remaining duplicate repository surfaces.
4. Detect unused npm dependencies and unused workspace packages.
5. Detect dead scripts and orphaned CI wiring.
6. Validate AI context, architecture intelligence, and governance artifacts remain consistent.
7. Produce a final repository hygiene report.

---

# Preconditions

The following stages must already be completed:

- STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION
- STAGE_INFRA_21_SUPPORT_SURFACE_ROUTING_AND_TEMPLATE_MIGRATION

The routing authority registry must exist:

```
docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md
```

---

# Validation Scope

This stage verifies the following repository domains:

• routing surfaces
• template systems
• scripts
• npm dependencies
• packages
• skills
• CI workflows
• architecture intelligence artifacts

---

# Verification Tasks

## T001 — Routing Authority Verification

Validate routing surfaces against the registry:

```
docs/architecture/intelligence/ROUTING_AUTHORITY_REGISTRY.md
```

Checks:

• no duplicate active routing roots
• no legacy surfaces marked authoritative
• no prompt or agent mirrors still active

Expected outcome:

- exactly one authoritative location per routing surface

Example surfaces:

```
.agents/agents/
.github/agents/

.agents/prompts/
.github/prompts/

.specify/templates/
specs/templates/
```

---

## T002 — Template System Consolidation Check

Confirm only one template system is active.

Checks:

• template scripts reference the canonical template root
• no tooling depends on legacy template paths

---

## T003 — Dead Script Detection

Detect unused scripts inside:

```
scripts/
```

Check for references from:

• package.json scripts
• CI workflows
• documentation
• shell utilities
• stage artifacts

Dead scripts must be flagged for removal.

---

## T004 — Dependency Hygiene

Verify dependency usage.

Detect:

• unused devDependencies
• unused dependencies
• duplicate packages

Tools may include:

```
npm ls
madge
biome
custom dependency audit
```

---

## T005 — Workspace Package Validation

Ensure all workspace packages are still active.

Check for:

• packages not imported by any app
• packages unused in dependency graph

Unused packages should be flagged for removal.

---

## T006 — Skill Surface Validation

Verify `.agents/skills/` entries are still relevant.

Checks:

• skill directory referenced by AGENTS.md
• skill not superseded by new architecture rules

Unused skills must be flagged.

---

## T007 — CI Workflow Hygiene

Inspect `.github/workflows/`.

Checks:

• duplicate CI validations
• redundant architecture checks
• redundant type-safety runs

CI must not contain overlapping pipelines.

---

## T008 — AI Context Integrity

Validate AI context artifacts.

Run:

```
bun run ai-context:validate
```

Artifacts checked:

```
docs/ai/context/
```

Examples:

• ai-dependency-graph.json
• ai-module-map.json
• ai-layer-map.json

---

## T009 — Architecture Guard Verification

Run full architecture governance pipeline.

```
bun run arch:guard
bun run arch:health
```

Ensure:

• no boundary violations
• architecture brain valid
• architecture health above baseline

---

## T010 — Repository Hygiene Report

Generate final hygiene report:

```
docs/reports/REPOSITORY_HYGIENE_REPORT.md
```

The report must include:

• duplicate surface status
• script cleanup results
• dependency analysis
• package usage results
• CI redundancy analysis
• architecture health summary

---

# Safety Rules

This stage **must not**:

• modify architecture rules
• modify governance documents
• modify routing registry
• introduce new repository structure

This stage is verification and cleanup only.

---

# Success Criteria

The stage is considered complete when:

• routing surfaces are fully consolidated
• no duplicate templates remain
• no unused dependencies remain
• no dead scripts remain
• CI workflows are minimal and non-duplicated
• AI context validation passes
• architecture guard passes

---

# Final Output

Artifacts produced by this stage:

```
docs/reports/REPOSITORY_HYGIENE_REPORT.md
```

This report becomes the baseline reference for repository cleanliness.

---

# Long‑Term Governance Impact

After this stage:

• future sanitization stages should not be required
• routing authority is enforced
• repository duplication risks are minimized

This stage establishes the **stable hygiene baseline for the Zidney monorepo**.
