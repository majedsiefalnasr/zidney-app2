---
name: architecture-intelligence
description: Architecture reasoning and validation layer for the Zidney monorepo
metadata:
  category: architecture
  scope: monorepo
  capabilities:
    - architecture reasoning
    - dependency validation
    - architecture drift detection
    - architecture guard integration
    - architecture self-healing
---

# Architecture Intelligence Skill

This skill provides the **architecture reasoning layer** for the Zidney platform. It ensures that all code modifications respect the architectural contract defined in `ARCHITECTURE_MAP.json` and the AI architecture brain generated in `docs/ai/context/`.

The goal of this skill is to make Zidney **architecture-aware for AI agents**.

It integrates with the following systems:

- `ARCHITECTURE_MAP.json`
- `scripts/infra-audit.ts`
- `scripts/ai-guard.ts`
- `docs/ai/context/ai-runtime-map.json`
- GitNexus MCP

---

# Responsibilities

This skill is responsible for:

• Loading architecture intelligence files
• Validating module boundaries
• Detecting forbidden dependencies
• Identifying architecture drift
• Suggesting correct architectural locations for new code
• Triggering architecture guards when required

It acts as the **architecture reasoning engine** used by the orchestrator and other skills.

---

# Architecture Context Sources

The skill reads architecture information from the following sources.

Primary architecture contract:

`ARCHITECTURE_MAP.json`

Generated AI architecture brain:

`docs/ai/context/ai-runtime-map.json`

Optional architecture knowledge graph:

GitNexus MCP

These sources allow AI agents to reason about:

- module layers
- dependency rules
- architectural boundaries

---

# Zidney Architecture Layers

Zidney uses a **layered monorepo architecture**.

Layers:

1. domain
2. infrastructure
3. runtime
4. ui

Dependency direction must follow:

```
domain → infrastructure → runtime → ui
```

Violations such as:

- domain importing ui
- ui importing runtime internals
- cross-app dependencies

must be blocked.

---

# Architecture Guard Integration

This skill delegates enforcement to the architecture guard system.

Primary enforcement script:

`scripts/ai-guard.ts`

The guard validates:

- illegal imports
- forbidden dependencies
- layer violations
- circular architecture dependencies

When violations are detected the skill must:

1. Explain the violation
2. Reference the architecture rule
3. Suggest a compliant fix

---

# Infra Audit Integration

The infrastructure audit script provides repository-wide architecture analysis.

Script:

`scripts/infra-audit.ts`

This script generates:

- dependency graph
- module boundary analysis
- AI runtime architecture map

The skill should use this information before performing architecture-sensitive tasks.

---

# Architecture Drift Detection

Architecture drift occurs when code diverges from the architecture contract.

Examples:

- new module not declared in `ARCHITECTURE_MAP.json`
- new dependency violating allowed rules
- architectural layer violations

When drift is detected the skill should:

1. warn the developer
2. propose updates to `ARCHITECTURE_MAP.json`
3. trigger `infra-audit.ts`

---

# Architecture Self-Healing

This skill supports **architecture self-healing**.

When violations occur the AI should propose the correct fix rather than only reporting the problem.

Example:

Violation:

`packages/domain-core` importing `packages/ui-system`

Suggested fix:

Move the UI-specific logic to:

`packages/api-client`

or a runtime service.

The goal is to **repair architecture automatically when possible**.

---

# Pre-Refactor Impact Analysis

Before major refactors the skill should evaluate architectural impact.

Recommended workflow:

1. run `infra-audit.ts`
2. inspect module dependencies
3. optionally query GitNexus:

```
gitnexus impact <symbol>
```

This reveals the blast radius of changes.

---

# AI Architecture Brain

Zidney maintains an **AI-readable architecture brain**.

Location:

```
docs/ai/context/
```

Important files:

- `ai-runtime-map.json`
- `ai-dependency-graph.json`
- `ai-module-map.json`

These files are generated automatically and allow AI agents to understand the architecture without scanning the entire repository.

---

# Expected AI Behavior

When working on Zidney code the AI should:

1. Load architecture context
2. Validate dependencies
3. Avoid illegal imports
4. Respect module boundaries
5. Suggest architecture-safe implementations

The AI should prefer **architecture-safe designs** over quick fixes.

---

# Example Reasoning

Bad change:

```
apps/mmc importing packages/domain-core internals
```

Correct architecture reasoning:

```
UI → infrastructure → domain
```

The UI should instead communicate through:

```
packages/api-client
```

---

# Relationship to Other Skills

This skill works together with:

- `ai-terminal`
- `git-governance`
- `rtk-execution-layer`
- `mcp-routing`

The orchestrator relies on this skill for **architecture-aware decision making**.
