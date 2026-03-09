---
name: ai-terminal
description: Advanced terminal operations for monorepo development
metadata:
  category: development
  scope: monorepo
  capabilities:
    - terminal
    - command
    - scripts
    - repository inspection
---

## Terminal Operating Principles

These rules govern how the AI should interact with the terminal inside the Zidney monorepo.

1. Prefer **inspection before modification**.
2. Prefer **scoped commands** over repository-wide commands.
3. Prefer **structured tools** over raw shell utilities.
4. Avoid commands that generate extremely large outputs.
5. Always use tools optimized for monorepos when available.

Example:

Bad:

rg TODO

Good:

rg TODO apps/mmc/src

# AI Terminal Skills

You are authorized to use the following advanced terminal tools installed on this system to perform tasks efficiently.

## 1. Search & Exploration

- **Tool:** `rg` (ripgrep)
  - _Usage:_ Use `rg --json` for complex searches so you can parse results as data.
- **Tool:** `fd`
  - _Usage:_ Use `fd -e ts` to find specific file types quickly.

### Command Preference Hierarchy

Preferred tools by category:

Search

rg > grep

File discovery

fd > find

Large file inspection (AI context)

rtk summarize > cat

JSON inspection

jq > cat

Code refactoring

ast-grep > sed

Formatting

biome > prettier

These preferences exist to ensure consistent performance, token efficiency, and structured output when operating inside large monorepos like Zidney.

## Token Optimization (RTK)

This environment includes **RTK (Rust Token Killer)** which reduces token usage when interacting with the repository. Prefer RTK commands when inspecting large files or generating summaries for AI reasoning.

RTK should be used when:

• summarizing large files
• extracting structured insights
• reducing long outputs before analysis
• preparing context for AI reasoning

Common examples:

Summarize a file for AI context:

rtk summarize <file>

Analyze token impact of content:

rtk gain

Reduce output before sending to the AI:

rtk trim <file>

If RTK is available, prefer it before running commands that would produce large outputs (for example `cat`, large `rg` scans, or long logs).

Example workflow:

Bad:

cat large-file.ts

Better:

rtk summarize large-file.ts

RTK helps keep the AI context window efficient when working with large monorepos like Zidney.

## 2. Data Manipulation

- **Tool:** `jq`
  - _Usage:_ Mandatory for reading `package.json` or `tsconfig.json`. Do not `cat` large JSON files.
- **Tool:** `gron`
  - _Usage:_ Use when you need to find the exact path of a nested key in a configuration file.

## 3. Code Quality & Refactoring

- **Tool:** `biome`
  - _Usage:_ Use `biome check --apply <file>` after every edit to ensure formatting and linting pass.
- **Tool:** `ast-grep` (sg)
  - _Usage:_ Use for structural code search/replace (e.g., "find all Vue components with a specific prop").

## 4. Environment (Bun/Hono)

- **Tool:** `bun x`
  - _Usage:_ Run one-off TS scripts without compiling.
- **Tool:** `wrangler` (if applicable)
  - _Usage:_ For checking Hono deployment logs/configs.

---

## Command Execution Rules

Before running any command:

1. Prefer **read-only inspection tools** (`rg`, `fd`, `jq`) before modifying files.
2. Never run commands that modify the entire repository without confirmation.
3. Prefer **file-scoped operations** over repository-wide operations.
4. Avoid commands that produce extremely large outputs.

Bad Example:

rg TODO

Good Example:

rg TODO apps/mmc/src

---

## Monorepo Navigation Strategy

Repository structure:

apps/_ → application runtimes
packages/_ → shared libraries
scripts/_ → automation and tooling
docs/_ → architecture and governance

Navigation rules:

1. Search inside the relevant module first.
2. Avoid repository-wide searches unless necessary.
3. Prefer module-scoped searches.

Example:

rg createTenant apps/api

---

## Architecture Inspection

Use these commands when investigating architecture boundaries.

View architecture modules:

jq '.modules | keys' ARCHITECTURE_MAP.json

Inspect a module definition:

jq '.modules["packages/domain-core"]' ARCHITECTURE_MAP.json

---

## Git Investigation

Use targeted git queries instead of dumping history.

Recent commits affecting a file:

git log -n 10 -- <file>

Find when a line changed:

git blame <file>

Search commit history:

git log --grep "keyword"

---

## Dependency Investigation

To inspect module dependencies:

bun scripts/infra-audit.ts

To analyze architecture violations:

bun scripts/ai-guard.ts

---

## Architecture Awareness

The repository enforces strict architecture rules via:

ARCHITECTURE_MAP.json
scripts/ai-guard.ts
scripts/infra-audit.ts

Use the following commands to inspect architecture boundaries.

List all architecture modules:

jq '.modules | keys' ARCHITECTURE_MAP.json

Inspect a specific module:

jq '.modules["packages/domain-core"]' ARCHITECTURE_MAP.json

Run architecture validation:

bun scripts/ai-guard.ts

Generate repository intelligence data:

bun scripts/infra-audit.ts

---

## GitNexus Architecture Intelligence (Preferred)

When investigating cross-module dependencies or architectural impact, prefer GitNexus knowledge graph queries before manual searching.

These commands provide deeper context than simple grep-based exploration.

Find execution flows related to a concept:

gitnexus query <concept>

Example:

gitnexus query tenant

Inspect full context of a symbol (callers, callees, modules):

gitnexus context <symbol>

Example:

gitnexus context createTenant

Analyze architectural blast radius of a change:

gitnexus impact <symbol>

Example:

gitnexus impact loadModuleBoundaries

Use GitNexus when:

• investigating cross-package dependencies  
• understanding architectural impact before refactoring  
• tracing execution paths across the monorepo

Fallback strategy if GitNexus is unavailable:

1. Use `rg` to locate symbols
2. Use `fd` to locate related modules
3. Inspect architecture rules using `ARCHITECTURE_MAP.json`

GitNexus should be considered the **primary architecture exploration tool** when available.
