---
name: precommit-diagnostics
description: Diagnostic and remediation skill for Husky pre-commit and pre-push failures in the Zidney monorepo
metadata:
  category: development
  scope: ci-hooks
  capabilities:
    - husky failure analysis
    - lint-staged diagnostics
    - architecture guard troubleshooting
    - infra-audit troubleshooting
    - automated remediation guidance
---

# Pre-Commit Diagnostics Skill

This skill provides **diagnostic capabilities for Git hook failures** in the Zidney repository.

It helps AI agents understand and fix failures triggered by:

- Husky hooks
- lint-staged
- Biome formatter
- ai-guard
- infra-audit

The goal is to **quickly identify the root cause of a failing commit or push** and provide precise remediation steps.

---

# Typical Hook Execution Flow

Zidney uses Husky hooks for enforcing repository standards.

Typical flow:

```
pre-commit
  ↓
lint-staged
  ↓
biome format / biome lint
  ↓
ai-guard
  ↓
commit allowed
```

Push operations may also trigger:

```
pre-push
  ↓
infra-audit
  ↓
ai-guard
  ↓
push allowed
```

When any step fails, this skill analyzes the failure.

---

# Failure Categories

Common failure types include:

### Linting failures

Example:

```
biome check failed
```

Typical fix:

```
bun biome format .
```

or fix the reported lint issues.

---

### lint-staged failures

Example:

```
lint-staged failed
```

This usually indicates that staged files violate formatting rules.

Recommended steps:

```
git diff --staged
bun biome format <files>
```

---

### Architecture guard failures

Example:

```
ai-guard: architecture violation detected
```

Typical causes:

- forbidden dependency
- layer violation
- module boundary violation

Recommended diagnostic steps:

```
bun scripts/ai-guard.ts
```

Then review the reported module or import path.

---

### Infrastructure audit failures

Example:

```
infra-audit detected architecture drift
```

Typical causes:

- new module missing from ARCHITECTURE_MAP.json
- invalid dependency edge

Recommended steps:

```
bun scripts/infra-audit.ts
```

Then update:

```
ARCHITECTURE_MAP.json
```

if a new module was intentionally introduced.

---

# Diagnostic Strategy

When a hook fails, the AI should:

1. Identify which tool produced the error
2. Parse the error message
3. Locate the affected file or module
4. Suggest the minimal fix

This ensures that developers receive **actionable remediation guidance**.

---

# Automated Remediation Guidance

For common errors, the AI should propose direct fixes.

Examples:

Format staged files:

```
bun biome format .
```

Re-run architecture validation:

```
bun scripts/ai-guard.ts
```

Regenerate architecture intelligence:

```
bun scripts/infra-audit.ts
```

---

# Integration With Other Skills

This skill works together with:

```
ai-terminal
architecture-intelligence
git-governance
```

These skills provide the context required to diagnose and fix hook failures.

---

# Expected AI Behavior

When a pre-commit or pre-push hook fails, the AI should:

1. Identify the failing tool
2. Explain the failure clearly
3. Suggest the minimal fix
4. Avoid unrelated changes

The goal is to **restore a clean commit pipeline quickly and safely**.
