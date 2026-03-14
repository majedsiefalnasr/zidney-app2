# STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION

## Stage Status

Status: DRAFT
Step: tasks
Risk Level: LOW
Initiated: 2026-03-13T22:51:44Z
Last Updated: 2026-03-13T23:08:58Z

Scope Defined:

- Repository sanitization limited to governed repository assets and dead-code elimination only
- Governance-critical artifacts protected from accidental deletion
- Validation evidence required after cleanup to prove governance remains intact
- Removal decisions require zero unresolved evidence across code, tests, CI, hooks, skills, and AI-context flows

Deferred Scope:

- Runtime redesign, tenant-model changes, and attempt engine changes remain out of scope

Constitutional Compliance:

- Task set compliant; drift analysis required before implementation

Notes:
Atomic task set generated. Drift analysis gate pending.

## Purpose

This stage performs a full repository sanitation pass to remove unused, duplicate, and obsolete assets across the Zidney monorepo while preserving the architecture governance system.

The goal is to guarantee that the repository contains **only active code, active tooling, and active documentation**.

This stage evaluates and, where safe, removes:

- unused scripts
- duplicate scripts
- duplicate documentation outside protected governance roots
- duplicate CI checks outside protected governance workflow roots
- unused npm dependencies
- unused packages
- unused AI skills
- Finder artifacts
- generated artifacts accidentally committed
- empty scaffolding directories

The result is a **lean, deterministic, AI-friendly monorepo**.

---

# Scope

This stage scans and sanitizes the following repository areas:

```
apps/
packages/
scripts/
.agents/skills/
docs/
.github/workflows/
.husky/
package.json
```

The sanitation process must **never break**:

- architecture guard
- AI context generation
- type-safety guard
- SpecKit Hard Mode workflow
- CI validation

---

# Phase 1 — Repository Scan

Run the repository baseline scanner and evidence sweep:

```
bun scripts/infra-audit.ts
```

The scanner must detect:

### Unused scripts

Scripts inside `scripts/` that are not referenced by:

- package.json
- CI workflows
- husky hooks
- AGENTS instructions and skill routing
- AI-context and architecture-intelligence generation paths
- committed governance reports
- other scripts

### Duplicate scripts

Scripts performing overlapping tasks such as:

- duplicate architecture validation
- duplicate test runners
- duplicate deploy scripts

### Unused packages

Packages inside `packages/` not imported anywhere.

Packages may only be classified as unused when they also have no active references from tests,
package scripts, CI workflows, Git hooks, AGENTS guidance, AI-context generation, or architecture
tooling.

### Unused npm dependencies

Dependencies not referenced anywhere in the repository.

Dependencies may only be classified as unused when they have zero unresolved references across
source code, tests, package scripts, CI workflows, Git hooks, and governance tooling.

### Duplicate documentation

Duplicate unprotected documentation or guidance surfaces outside protected governance roots.

### Duplicate CI checks

Multiple workflows running identical checks.

### Unused AI skills

Skills inside `.agents/skills` never referenced by:

- AGENTS.md
- orchestrator
- MCP routing
- active agent workflows or committed governance reports

### Generated artifacts committed to repo

Examples:

```
.DS_Store
packages/*/dist
apps/*/dist
```

### Empty scaffolding directories

Examples:

```
scripts/architecture-guard/bin/
scripts/architecture-guard/lib/
scripts/architecture-guard/scripts/
```

---

# Phase 2 — Evidence-Based Cleanup

After scan confirmation, inventory completion, and protected-asset classification, the stage may
apply cleanup only to candidates that have zero unresolved evidence of active use, are not part of
the protected governance set, and remain reversible at the current batch boundary.

### Finder artifacts

Remove all occurrences of:

```
.DS_Store
```

### Generated build artifacts

Remove committed build output such as:

```
apps/*/dist
packages/*/dist
```

### Empty directories

Remove directories that contain no source code.

### Unused scripts

Delete scripts only when repository scanning confirms zero unresolved references across source code,
tests, package scripts, CI workflows, Git hooks, AGENTS instructions, AI-context generation, and
committed governance reports.

### Duplicate scripts

Keep the canonical implementation and remove redundant scripts only when the authoritative survivor
is outside protected governance roots or the duplicate set is explicitly marked safe for
consolidation in the sanitization inventory.

### Unused packages

Remove packages only when they have zero unresolved references across apps, packages, tests,
package scripts, CI workflows, hooks, AGENTS guidance, and governance tooling.

### Unused dependencies

Remove unused dependencies only from `package.json` after evidence review. Any lockfile change is a
derived side effect of approved dependency cleanup and must be validated within the same cleanup
batch.

### Duplicate CI workflows

Duplicate workflow definitions inside protected governance roots must be grouped and documented for
manual review in this stage. They must not be deleted or merged unless a separate approved stage
explicitly supersedes the protected workflow path.

### Unused AI skills

Remove unprotected skill directories only when they have zero unresolved references from AGENTS,
skill routing, active agent workflows, AI-context generation, and committed governance reports.

### Protected governance assets

The following remain non-removable in this stage even if they appear low-frequency or duplicated:

- `docs/ai/`
- `docs/architecture/`
- `.github/workflows/`
- `.husky/`
- `scripts/ai-guard.ts`
- `scripts/architecture-diff.ts`
- `scripts/infra-audit.ts`
- `scripts/type-safety-guard.ts`
- `scripts/generate-ai-context.ts`
- `scripts/gitnexus-context.ts`
- `scripts/validate-architecture-brain.ts`
- `AGENTS.md`
- `docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md`
- `docs/AGENT_GOVERNANCE.md`
- `docs/PROJECT_CONTEXT_PRIMER.md`
- `specs/STAGE_LIFECYCLE_POLICY.md`
- `specs/phases/MASTER_EXECUTION_ROADMAP.md`
- `package.json` governance script wiring for architecture, AI-context, typecheck, lint, test, and hook validation flows

The only approved mutation to this protected-authority surface in this stage is the explicit governance-remediation update to `.github/workflows/hard-mode-guard.yml` so the workflow enforces the wider authority set.

---

# Phase 3 — Repository Normalization

After cleanup normalize the repository.

### Reinstall dependencies

```
bun install
```

### Regenerate architecture map

```
bun arch:generate
```

### Refresh AI context

```
bun ai-context:refresh
```

### Re-run architecture guard

```
bun arch:guard
```

### Re-run AI guard

```
bun scripts/ai-guard.ts
```

### Run full test suite

```
bun test
```

### Run type safety guard

```
bun run type-safety-guard
```

### Validate architecture brain integrity

```
bun scripts/validate-architecture-brain.ts
```

---

# Phase 4 — Validation

All of the following must succeed:

```
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

If workflow files are changed, the stage must also run:

```
bun run validate:workflows
```

If hook wiring changes, the stage must confirm `.github/workflows/` and `.husky/` remain present,
referenced scripts still exist, `package.json` plus `lint-staged.config.mjs` still resolve expected
hook commands, and protected governance authority files remain present and unmodified.

CI pipelines must also pass.

---

# Expected Result

After this stage the repository will:

- contain no dead scripts
- contain no unused dependencies
- contain no orphan packages
- contain no unprotected duplicate documentation; protected governance documentation duplicates are either retained or documented for manual review
- contain no unprotected duplicate CI checks; protected workflow duplicates are either retained or documented for manual review
- contain no unused AI skills
- contain no generated artifacts

The repository becomes **fully deterministic and governance-aligned**.

---

# Artifacts Generated

The stage produces:

```
specs/runtime/infra-016-repository-sanitization-and-dead-code-elimination/reports/SANITIZATION_REPORT.md
```

The report must include:

- removed scripts
- removed dependencies
- removed packages
- removed skills
- removed docs
- duplicate CI checks retained, consolidated where safe, or documented for manual review

---

# Safety Rules

This stage must **never delete**:

```
scripts/ai-guard.ts
scripts/architecture-diff.ts
scripts/infra-audit.ts
scripts/type-safety-guard.ts
scripts/generate-ai-context.ts
scripts/gitnexus-context.ts
scripts/validate-architecture-brain.ts
AGENTS.md
docs/00_SPEC_KIT_HARD_MODE_WORKFLOW.md.md
docs/AGENT_GOVERNANCE.md
docs/PROJECT_CONTEXT_PRIMER.md
specs/STAGE_LIFECYCLE_POLICY.md
specs/phases/MASTER_EXECUTION_ROADMAP.md
```

It must also preserve:

```
docs/ai/
docs/architecture/
.github/workflows/
.husky/
```

---

# Completion Criteria

The stage is considered complete when:

- the sanitation report is generated
- CI pipelines pass
- architecture guard passes
- type-safety guard passes
- AI context regenerates successfully
