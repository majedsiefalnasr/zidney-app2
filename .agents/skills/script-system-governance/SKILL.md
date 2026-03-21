---
name: script-system-governance
description: Enforces repository-wide script consistency, validation, naming standards, and safe refactoring. Use when creating, renaming, validating, or invoking scripts across package.json, CI, and orchestrator flows.
---

# Zidney Script System Governance

## Purpose

This skill ensures that all scripts across Zidney are:

- Consistent in naming
- Properly registered and discoverable
- Fully traceable to their origin (spec/runtime)
- Safe to refactor without breaking the system
- Validated before execution (locally + CI)

This prevents:
- Missing scripts (`bun run xxx` fails)
- Duplicate or conflicting scripts
- Broken CI or orchestrator pipelines
- Drift between specs and runtime

---

## Core Principles

### 1. Single Source of Truth
All scripts MUST:
- Exist in `package.json`
- Be implemented in `/scripts/`
- Be documented in `docs/scripts/`

---

### 2. Naming Convention (MANDATORY)

Format:
```
<domain>:<action>[:<scope>]
```

Examples:
- `db:pool-status`
- `db:validate-licenses`
- `validate:ai-context-fresh`
- `arch:validate-brain`
- `test:e2e:mmc`

Rules:
- Use `:` not `-`
- Domain-first grouping
- No duplicates across domains

---

### 3. Script Location Policy

| Script Type        | Location                        |
|------------------|--------------------------------|
| Database          | `scripts/db/`                  |
| Validation        | `scripts/validate/`            |
| Architecture      | `scripts/governance/`          |
| Testing           | `scripts/test/` (if needed)    |
| Infra / CI        | `scripts/ci/`                  |

---

### 4. Allowed Engines

- Primary: `bun`
- Fallback: `node` (only if required)
- NEVER mix engines for same domain

---

### 5. Script Registry (Required)

Each script must have an entry in:

```
docs/scripts/<script-name>.md
```

Must include:
- Purpose
- Usage
- Source (which spec/runtime)
- When to use
- Called by (CI / dev / orchestrator)

---

## Workflows

---

### Workflow 1: Add New Script

1. Identify origin spec:
```
specs/runtime/<spec-name>
```

2. Implement:
```
scripts/<domain>/<script>.ts
```

3. Register in `package.json`:
```
"<domain>:<action>": "bun run scripts/<domain>/<script>.ts"
```

4. Document in:
```
docs/scripts/<script>.md
```

5. Validate:
```
bun run validate:runtime-scripts
```

---

### Workflow 2: Rename Script (Critical)

1. Update:
- `package.json`
- Script file if needed

2. Run refactor scan:
```
bun run script:usage-scan
```

3. Update ALL references:
- specs/
- scripts/
- docs/
- CI workflows
- orchestrator agents

4. Validate:
```
bun run validate:runtime-scripts
```

🚫 NEVER rename without updating references

---

### Workflow 3: Detect Missing Scripts

Run:
```
bun run validate:runtime-scripts
```

Checks:
- All `bun run xxx` exist
- All scripts resolve correctly
- No orphan commands in specs

---

### Workflow 4: Detect Duplicates

Run:
```
bun run script:dedupe
```

Ensures:
- No duplicate names
- No overlapping functionality

---

## Orchestrator Integration

The Zidney orchestrator MUST:

Before execution:
1. Validate script exists
2. Validate script passes registry check
3. Block execution if missing

Example guard:
```
if (!scriptExists(command)) fail("SCRIPT_NOT_FOUND")
```

---

## CI Enforcement (Recommended)

Add job:

```
bun run validate:runtime-scripts
bun run script:usage-scan
```

Fail if:
- Missing script
- Broken reference
- Duplicate script

Optional:
- Run via `act` locally before push

---

## Anti-Patterns (Forbidden)

❌ `bun run something` not in package.json  
❌ Duplicate scripts across domains  
❌ Scripts without docs  
❌ Scripts without spec origin  
❌ Renaming without full propagation  
❌ Mixing `:` and `-` naming  

---

## Advanced (Optional but Recommended)

### Script Refactor Engine

```
bun run refactor-scripts
```

Auto:
- Update references
- Apply naming rules
- Generate migration map

---

## Success Criteria

System is valid when:

- All scripts resolve
- No duplicates exist
- All scripts documented
- All spec commands executable
- CI + orchestrator enforce rules

---

## Summary

This skill transforms scripts from:
→ scattered commands

Into:
→ governed system layer

It guarantees:
- Stability
- Discoverability
- Refactor safety
- CI integrity
- AI agent correctness
