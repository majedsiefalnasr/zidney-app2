# STAGE_INFRA_16_REPOSITORY_SANITIZATION_AND_DEAD_CODE_ELIMINATION

## Purpose

This stage performs a full repository sanitation pass to remove unused, duplicate, and obsolete assets across the Zidney monorepo while preserving the architecture governance system.

The goal is to guarantee that the repository contains **only active code, active tooling, and active documentation**.

This stage automatically removes:

- unused scripts
- duplicate scripts
- duplicate documentation
- duplicate CI checks
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

Run the repository scanner:

```
bun scripts/infra-audit.ts --repo-scan
```

The scanner must detect:

### Unused scripts

Scripts inside `scripts/` that are not referenced by:

- package.json
- CI workflows
- husky hooks
- other scripts

### Duplicate scripts

Scripts performing overlapping tasks such as:

- duplicate architecture validation
- duplicate test runners
- duplicate deploy scripts

### Unused packages

Packages inside `packages/` not imported anywhere.

### Unused npm dependencies

Dependencies not referenced anywhere in the repository.

### Duplicate documentation

Duplicate architecture or governance docs.

### Duplicate CI checks

Multiple workflows running identical checks.

### Unused AI skills

Skills inside `.agents/skills` never referenced by:

- AGENTS.md
- orchestrator
- MCP routing

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

# Phase 2 — Automatic Cleanup

After scan confirmation the stage automatically removes:

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

Delete scripts that are not referenced by any execution path.

### Duplicate scripts

Keep the canonical implementation and remove redundant scripts.

### Unused packages

Remove packages that are not imported by any app or package.

### Unused dependencies

Remove unused dependencies using:

```
bun pm prune
```

### Duplicate CI workflows

Merge duplicate checks into a single workflow.

### Unused AI skills

Remove skill directories not referenced by:

```
AGENTS.md
zidney-orchestrator.agent.md
```

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

### Run full test suite

```
bun test
```

### Run type safety guard

```
bun type-safety-guard
```

### Run architecture health check

```
bun arch:health
```

---

# Phase 4 — Validation

All of the following must succeed:

```
bun lint
bun typecheck
bun test
bun arch:guard
bun arch:health
```

CI pipelines must also pass.

---

# Expected Result

After this stage the repository will:

- contain no dead scripts
- contain no unused dependencies
- contain no orphan packages
- contain no duplicate documentation
- contain no duplicate CI checks
- contain no unused AI skills
- contain no generated artifacts

The repository becomes **fully deterministic and governance-aligned**.

---

# Artifacts Generated

The stage produces:

```
docs/architecture/health/repository-sanitization-report.md
```

The report must include:

- removed scripts
- removed dependencies
- removed packages
- removed skills
- removed docs
- removed CI checks

---

# Safety Rules

This stage must **never delete**:

```
scripts/ai-guard.ts
scripts/infra-audit.ts
scripts/type-safety-guard.ts
scripts/generate-ai-context.ts
scripts/gitnexus-context.ts
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
