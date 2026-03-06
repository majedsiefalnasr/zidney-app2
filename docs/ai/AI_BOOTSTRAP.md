# Zidney AI Bootstrap

This file is the **primary bootstrap entrypoint for AI agents** working inside the Zidney repository.

Any AI system interacting with this repository (Copilot, Cursor, Claude, SpecKit agents, GitNexus MCP agents, etc.) must **load this file first** before performing reasoning, code generation, planning, or refactoring.

This ensures that AI reasoning starts from **architecture → governance → implementation**, rather than from raw code scanning.

---

# 1. Mandatory Context Loading Order

AI agents must load the following resources **in this exact order**:

1. docs/ai/AI_CONTEXT_INDEX.md
2. docs/architecture/ZIDNEY_ARCHITECTURE_SYSTEM.md
3. docs/PROJECT_CONTEXT_PRIMER.md
4. docs/ai/AI_ENGINEERING_RULES.md
5. docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json
6. docs/architecture/module-boundaries.json
7. docs/architecture/ADR/
8. docs/ai/context/

This establishes the following reasoning hierarchy:

Architecture  
↓  
Architecture Contract  
↓  
Engineering Rules  
↓  
System Context  
↓  
Codebase

AI must **not generate code before these resources are loaded**.

---

# Architecture Knowledge Sources

AI must treat the following files as the **authoritative architecture knowledge base**:

```
docs/architecture/ZIDNEY_ARCHITECTURE_SYSTEM.md
docs/architecture/module-boundaries.json
docs/architecture/ADR/
docs/architecture/visualization/
docs/ai/context/
```

These artifacts are generated and maintained by the infrastructure governance system and must always take precedence over assumptions derived from raw source code.

When architecture metadata and code appear to conflict, AI must assume that the **architecture documents are correct** and investigate the code for potential violations.

---

# 2. Architecture Awareness Requirement

Zidney enforces strict architecture governance.

Before generating or modifying code, AI must validate that the proposed change respects:

• module boundaries  
• allowed dependency directions  
• architecture layer rules  
• ADR decisions

Violations will be blocked by:

```
AI Guard
Infra Audit
Architecture Diff
CI Governance Pipeline
```

Therefore AI should proactively avoid generating architecture violations.

---

# 3. Monorepo Mental Model

Zidney is a **layered monorepo architecture**.

```
apps/
  api
  worker
  mmc
  backoffice
  frontoffice

packages/
  domain-core
  api-client
  ui-system
  validation
  config
  logger
  redis-utils
  types
```

General rules:

• apps cannot import other apps  
• packages cannot import apps  
• domain-core must remain framework-independent  
• UI code must live inside ui-system  
• shared logic must live inside packages

---

# 4. Domain Isolation Rule

The domain layer is located in:

```
packages/domain-core
```

This package must remain **pure business logic**.

Forbidden dependencies:

```
ui-system
api-client
apps/*
database drivers
framework-specific libraries
```

Allowed dependencies:

```
types
validation
```

AI must never introduce domain-layer violations.

---

# 5. UI Architecture Rules

Reusable UI components live in:

```
packages/ui-system
```

Rules:

• UI components must remain presentation-only  
• UI components must not call APIs  
• UI components must not contain business logic

Applications consume UI components, but UI never consumes applications.

---

# 6. API Access Layer

All HTTP communication must go through:

```
packages/api-client
```

UI applications must not perform direct HTTP requests.

Instead they must use the centralized API client with interceptors for:

• token injection  
• refresh handling  
• error normalization

---

# 7. Worker Isolation

The background worker service:

```
apps/worker
```

Rules:

• cannot import UI packages  
• cannot import applications  
• can only import shared packages

---

# 8. Testing Architecture

Zidney uses three testing layers:

```
Unit Tests
Integration Tests
End‑to‑End Tests
```

Typical structure:

```
packages/*/tests/unit
apps/*/tests/unit
apps/*/tests/integration
apps/*/tests/e2e
```

Testing rules:

• unit tests validate isolated modules  
• integration tests validate module contracts  
• e2e tests validate application flows

---

# 9. Governance Enforcement Pipeline

All code changes are protected by multiple automated layers:

```
AI Engineering Rules
        ↓
AI Guard (pre‑commit validation)
        ↓
Infrastructure Audit (full repository architecture scan)
        ↓
Architecture Diff (PR architecture drift detection)
        ↓
CI Pipeline (lint + typecheck + tests)
```

AI agents should assume that violations will **block commits or PR merges**.

---

# 10. ADR Authority

Architecture decisions are recorded in:

```
docs/architecture/
```

Examples include:

ADR‑0001 — Database Per Tenant  
ADR‑0002 — Snapshot Attempt Model  
ADR‑0003 — White Label Visual Isolation  
ADR‑0004 — Single Runtime Engine  
ADR‑0005 — Upgrade Opt‑In Model  
ADR‑0006 — Runtime Authoritative Time  
ADR‑0007 — Product Version Compatibility  
ADR‑0008 — Semantic Versioning Policy  
ADR‑0009 — Rate Limiting Strategy

AI must treat ADRs as **architectural law**.

If a requested change conflicts with an ADR, AI must:

1. explain the conflict
2. propose a new ADR
3. provide a migration strategy

---

# 11. GitNexus / MCP Integration (Optional)

If GitNexus MCP is available, AI should use it to obtain repository context.

Recommended sequence:

1. Load docs/ai/AI_BOOTSTRAP.md
2. Load docs/architecture/ZIDNEY_ARCHITECTURE_SYSTEM.md
3. Query GitNexus for dependency graph
4. Validate proposed imports against module-boundaries.json
5. Continue reasoning

This provides AI with **deep repository awareness**.

---

# 12. AI Development Principle

AI agents working in Zidney must behave as **architecture‑aware collaborators**, not simple code generators.

Responsibilities include:

• preserving architecture integrity  
• preventing forbidden dependencies  
• avoiding circular dependencies  
• protecting domain isolation  
• suggesting architecture improvements when appropriate

AI should prioritize **architecture safety over implementation speed**.

---

# Summary

Before generating code, AI must:

1. Load the architecture context
2. Validate against architecture contracts
3. Respect ADR decisions
4. Follow the layered monorepo structure

This bootstrap guarantees that AI reasoning begins with **system architecture rather than source code scanning**.
