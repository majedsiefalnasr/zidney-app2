# STAGE_INFRA_10_HYBRID_LINT_FORMAT_PIPELINE

---

## Stage Status

Status: BACKEND CLOSED Risk Level: LOW Last Updated: 2026-03-10T02:00:00.000Z

Implementation: COMPLETE Tasks: 12 / 12 completed

Scope Closed:

- Prettier (Markdown only) — `.prettierrc`, `.prettierignore` updated, 955 project .md files
  auto-formatted as formatting baseline
- yamllint (YAML validation) — `.yamllint`, lint-staged entry with graceful fallback
- actionlint (GitHub Workflows) — lint-staged entry, pre-push full scan with graceful skip
- `lint-staged.config.mjs` — 4 entries (md/code/yaml/workflows) with JSDoc + dual-layer note
- `package.json` — 3 validation scripts (format:check:md, validate:yaml, validate:workflows)
- `.husky/pre-push` — actionlint full-scan block inserted before Final Summary
- Unit tests — 21 tests passing (11 spec cases; T5 expanded to 8 per-glob sub-tests)

Deferred Scope:

- CI pipeline job definitions
- Per-package biome.json overrides
- Lint rule governance (STAGE_INFRA_05 scope)
- TypeScript migration of existing files

Constitutional Compliance:

- All 5 constitutional rules confirmed N/A (pure tooling stage)
- No tenant isolation, license middleware, snapshot, DB, or HTTP concerns
- Drift analysis passed — implementation authorized

Notes: Composite guardian audit completed. 2 false-positive BLOCKED verdicts cleared via evidence. 2
genuine findings remediated in tasks.md. Stage cleared for implementation.

---

## Purpose

Establish a deterministic, fast, and AI-safe linting and formatting pipeline for the Zidney
monorepo.

This stage introduces a **Hybrid Lint/Format Architecture** where:

- **Biome** becomes the **primary formatter and linter** for all supported files.
- **Specialized tools** are used only for file types that Biome does not support well.
- Formatting responsibilities are **non-overlapping**.
- Pre‑commit validation stays **extremely fast (<0.5s)**.

The goal is to provide:

• deterministic formatting  
• minimal tooling complexity  
• AI‑safe code generation  
• fast developer feedback loops  
• strict CI enforcement

---

## Problem Statement

Modern monorepos often suffer from:

• multiple overlapping linters • slow formatting pipelines • inconsistent formatting rules •
AI-generated code violating lint rules

Using both **ESLint + Prettier** typically leads to duplication and performance overhead.

Biome solves most of these issues, but it does **not fully support every file type** in the Zidney
repository.

Therefore a **hybrid approach** is required.

---

## Hybrid Tooling Model

### Primary Engine

Biome becomes the primary engine for:

- TypeScript
- JavaScript
- JSX
- TSX

Responsibilities:

- formatting
- linting
- import ordering
- unused code detection

Commands:

```
biome check
biome format
```

---

## Secondary Tools (Narrow Scope)

Secondary tools are used **only for files unsupported by Biome**.

### Markdown

Tool:

```
prettier
```

Scope:

```
*.md
```

Purpose:

• documentation formatting  
• ADR files  
• stage specifications

---

### YAML

Tool:

```
yamllint
```

Scope:

```
*.yml
*.yaml
```

Purpose:

• GitHub workflows  
• infrastructure configs

---

### GitHub Workflow Validation

Tool:

```
actionlint
```

Scope:

```
.github/workflows/*.yml
```

Purpose:

• detect invalid GitHub Action syntax

---

## Formatting Responsibility Matrix

| File Type | Tool                  |
| --------- | --------------------- |
| ts/js     | biome                 |
| tsx/jsx   | biome                 |
| vue       | biome (script blocks) |
| md        | prettier              |
| yaml      | yamllint              |
| workflows | actionlint            |

No tool overlap is allowed.

---

## Monorepo Integration

The formatting stack must work across:

```
apps/*
packages/*
scripts/*
```

All tooling must support Bun-based execution.

---

## Pre‑Commit Pipeline

The Husky pre‑commit hook must run the following sequence:

1️⃣ Stage file detection

```
git diff --cached --name-only
```

2️⃣ Biome formatting

```
biome format
```

3️⃣ Biome lint

```
biome check
```

4️⃣ Markdown formatting

```
prettier --write
```

5️⃣ YAML validation

```
yamllint
```

6️⃣ GitHub workflow validation

```
actionlint
```

Target runtime:

```
< 0.5 seconds
```

---

## lint-staged Integration (Required for Performance)

To guarantee extremely fast pre‑commit execution in a large monorepo, the pipeline MUST use
**lint-staged**.

Running formatters across the entire repository would violate the performance target defined in this
stage.

Instead, only **staged files** are processed.

Example workflow:

```
git add apps/mmc/src/views/products/ProductTable.vue
```

Only this file will be linted and formatted.

---

### lint-staged Configuration

Example `package.json` configuration:

```
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "biome format --write",
      "biome check"
    ],
    "*.vue": [
      "biome format --write",
      "biome check"
    ],
    "*.md": [
      "prettier --write"
    ],
    "*.{yml,yaml}": [
      "yamllint"
    ]
  }
}
```

This ensures that only **modified files** are processed.

---

### Husky Hook Integration

The Husky `pre-commit` hook should delegate execution to lint‑staged.

Example hook:

```
bunx lint-staged
```

This replaces running multiple formatting commands manually.

---

### Performance Target

| Pipeline Mode                     | Expected Runtime |
| --------------------------------- | ---------------- |
| Full repository scan              | 0.5–3 seconds    |
| lint‑staged incremental execution | **50–150 ms**    |

This design ensures the Zidney repository maintains **sub‑second commits even as the monorepo
grows**.

---

### Governance Rule

AI agents implementing this stage **must not** run Biome or Prettier across the full repository
during pre‑commit.

All formatting and linting MUST be executed through `lint-staged`.

Full‑repository validation belongs only to:

• CI pipelines • pre‑push hooks • architecture audit scripts

---

## Pre‑Push Pipeline

The pre‑push hook performs stricter validation:

• full Biome lint • architecture guard • infra audit

Commands:

```
bun scripts/ai-guard.ts
bun scripts/infra-audit.ts
```

---

## AI Agent Compliance

All AI agents working in the repository must follow these rules:

1. Never introduce ESLint rules that duplicate Biome.
2. Never introduce Prettier for TypeScript.
3. Never modify formatting rules without updating this stage.
4. Always run:

```
biome format
```

before committing generated code.

---

## Acceptance Criteria

This stage is complete when:

• Biome is the primary linter/formatter  
• Markdown formatting works via Prettier  
• YAML validation runs via yamllint  
• GitHub workflows validated with actionlint  
• pre‑commit runtime < 0.5s  
• pre‑push pipeline runs architecture guard

---

## Expected Outcome

After completion the Zidney repository will have:

• deterministic formatting  
• minimal lint toolchain  
• extremely fast pre‑commit validation  
• consistent AI-generated code style

This stage forms the **foundation for reliable AI-assisted development across the Zidney platform.**
