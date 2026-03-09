---
name: architecture-self-healing
description: Self-healing architecture governance system for Zidney that automatically detects, reports, and guides remediation of architectural drift
metadata:
  category: architecture
  scope: governance
  capabilities:
    - architecture drift detection
    - automatic architecture intelligence generation
    - dependency graph validation
    - module boundary enforcement
    - AI architecture awareness
---

# Architecture Self-Healing Skill

This skill defines the **self-healing architecture governance system** used in the Zidney repository.

The goal is to ensure that the system architecture remains **consistent, enforceable, and AI-readable** even as the codebase evolves.

Instead of relying on manual documentation updates, the architecture layer is continuously verified and regenerated using automated tooling.

---

# Core Concept

Zidney architecture governance operates as a **closed feedback loop**.

```
Repository Changes
        ↓
Architecture Scan (infra-audit)
        ↓
Architecture Intelligence Generation
        ↓
Architecture Guard Validation
        ↓
Remediation Guidance
```

This loop allows the system to automatically detect when the architecture has drifted from its intended design.

---

# Key Components

The self-healing system relies on four primary components.

### 1. ARCHITECTURE_MAP.json

This file defines the **authoritative architecture model** of the repository.

It describes:

• system layers
• module boundaries
• allowed dependencies
• forbidden dependencies

All architecture validation references this file.

---

### 2. infra-audit.ts

The infrastructure audit script scans the repository and generates architecture intelligence.

Responsibilities include:

• scanning apps/ and packages/
• detecting module dependencies
• identifying new modules
• generating architecture intelligence files

Typical command:

```
bun scripts/infra-audit.ts
```

Generated artifacts may include:

```
docs/ai/context/
  ai-runtime-map.json
  ai-module-map.json
  ai-dependency-graph.json
  ai-architecture-summary.md
```

These artifacts allow AI systems to understand the structure of the repository.

---

### 3. ai-guard.ts

The architecture guard validates repository changes against the architecture model.

Responsibilities include:

• enforcing module boundaries
• detecting forbidden dependencies
• detecting circular dependencies
• validating layer rules

Typical command:

```
bun scripts/ai-guard.ts
```

If violations are detected, the guard prevents commits or CI merges.

---

### 4. GitNexus MCP

GitNexus provides a **knowledge graph of the repository**.

It enables AI agents to query relationships such as:

• module dependencies
• function call graphs
• code ownership

Typical usage:

```
gitnexus query <concept>
```

This improves the ability of AI agents to reason about architecture safely.

---

# Self-Healing Workflow

When architecture drift occurs the system follows a predictable workflow.

### Step 1 — Drift Detection

The audit script detects changes such as:

• new modules
• dependency violations
• structural inconsistencies

---

### Step 2 — Architecture Intelligence Update

The audit regenerates architecture metadata used by AI agents.

This ensures that architecture context always matches the current repository state.

---

### Step 3 — Guard Validation

The architecture guard validates the updated structure against the architecture rules.

Violations are reported with actionable diagnostics.

---

### Step 4 — Remediation

Developers or AI agents apply minimal fixes such as:

• correcting imports
• updating architecture rules when intentional
• refactoring modules

---

# Developer Workflow

Typical workflow when adding a new module:

1. create the module
2. run the architecture audit

```
bun scripts/infra-audit.ts
```

3. review suggested ARCHITECTURE_MAP updates

4. run architecture validation

```
bun scripts/ai-guard.ts
```

5. commit changes once validation passes

---

# AI Integration

AI agents rely on architecture intelligence to avoid violating system boundaries.

Important files for AI context:

```
docs/ai/AI_BOOTSTRAP.md
docs/ai/AI_CONTEXT_INDEX.md
docs/architecture/ARCHITECTURE_MAP.json
docs/ai/context/*
```

These files provide the architecture knowledge required for safe AI-assisted development.

---

# Expected AI Behavior

When working in the Zidney repository the AI should:

1. read architecture intelligence files
2. respect module boundaries
3. run architecture validation before major changes
4. regenerate architecture intelligence after structural changes

This ensures that the system architecture remains **stable, transparent, and self-correcting**.
