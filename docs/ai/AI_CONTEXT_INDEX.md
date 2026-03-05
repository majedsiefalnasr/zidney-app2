NOTE FOR AI SYSTEMS

This file must be loaded AFTER:

docs/ai/AI_BOOTSTRAP.md

AI_BOOTSTRAP.md defines the architecture-first reasoning model, governance pipeline, and repository mental model for Zidney.  
AI agents must load AI_BOOTSTRAP.md before reading this file.

Reasoning order required for all AI tools:

1. docs/ai/AI_BOOTSTRAP.md
2. docs/ai/AI_CONTEXT_INDEX.md
3. docs/PROJECT_CONTEXT_PRIMER.md
4. docs/ai/AI_ENGINEERING_RULES.md
5. docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json
6. docs/architecture/ADR/

# Zidney AI Context Index

This document is the **entry point for AI assistants** working inside the Zidney repository.

AI tools should read this file **before performing any code generation, refactoring, or architectural changes**.  
It provides a map of all architecture contracts, governance rules, and engineering standards that AI must follow.

---

# 1. AI Engineering Rules

Primary AI behavior contract:

docs/ai/AI_ENGINEERING_RULES.md

This file defines:

• repository architecture rules  
• module boundaries  
• forbidden dependencies  
• domain isolation requirements  
• governance pipeline enforcement

AI must **always read and follow these rules before generating code**.

---

# 2. Architecture Contract (Machine Readable)

docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json

This file defines the **formal architecture rules used by automation**.

It contains:

• dependency rules  
• forbidden module imports  
• layer definitions  
• architecture scoring data  
• system boundaries

Automation tools using this contract:

• AI Guard  
• Infrastructure Audit  
• Architecture Diff

AI assistants should **consult this file when deciding imports or module placement**.

---

# 3. Architecture Decision Records (ADR)

Location:

docs/architecture/

Important ADRs define the core Zidney architecture decisions.

Examples include:

ADR-0001 — Database Per Tenant  
ADR-0002 — Snapshot Attempt Model  
ADR-0003 — White Label Visual Isolation  
ADR-0004 — Single Runtime Engine  
ADR-0005 — Upgrade Opt-In Model  
ADR-0006 — Runtime Authoritative Time  
ADR-0007 — Product Version Compatibility  
ADR-0008 — Semantic Versioning Policy  
ADR-0009 — Rate Limiting Strategy

AI must **not violate ADR decisions** when generating new code.

If a change conflicts with an ADR, AI should propose:

• a new ADR  
• an architectural discussion  
• a migration strategy

---

# 4. Monorepo Structure

The Zidney repository is a **layered monorepo**.

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

Rules:

• apps cannot import other apps  
• packages cannot import apps  
• domain-core must remain framework independent  
• UI code must remain inside ui-system

Shared logic must live in `packages/`.

---

# 5. Architecture Governance Pipeline

Zidney enforces architecture through multiple automated layers.

```
AI Engineering Rules
        ↓
AI Guard (pre-commit architecture validation)
        ↓
Infrastructure Audit (full architecture scan)
        ↓
Architecture Diff (PR-level architecture drift detection)
        ↓
CI Governance Pipeline
```

Tools responsible:

scripts/ai-guard.ts  
scripts/infra-audit.ts  
scripts/architecture-diff.ts

CI configuration:

.github/workflows/architecture-governance.yml

---

# 6. Testing Architecture

Testing follows a structured model.

```
Unit Tests
Integration Tests
End-to-End Tests
```

Typical locations:

```
packages/*/tests/unit
apps/*/tests/unit
apps/*/tests/integration
apps/*/tests/e2e
```

Rules:

• tests must respect architecture boundaries  
• integration tests verify module contracts  
• e2e tests validate system flows

---

# 7. Development Workflow

Before submitting code, the following checks will run automatically:

```
AI Guard
ESLint
TypeScript
Tests
```

In CI:

```
AI Guard
Infra Audit
Architecture Diff
ESLint
TypeScript
Tests
```

Architecture violations will **block commits or PR merges**.

---

# 8. AI Development Philosophy

AI assistants working in Zidney must behave as **architecture-aware engineering partners**.

Responsibilities include:

• respecting architecture contracts  
• avoiding forbidden dependencies  
• preserving domain isolation  
• preventing circular dependencies  
• recommending architecture improvements when necessary

AI should prefer **safe architecture changes over quick code shortcuts**.

---

# Summary

Before generating code, AI must review:

1. AI_BOOTSTRAP.md
2. AI_CONTEXT_INDEX.md
3. AI_ENGINEERING_RULES.md
4. ARCHITECTURE_CONTRACT.json
5. Architecture Decision Records (ADR)
6. Monorepo structure

These resources ensure that all AI-generated code **remains compliant with Zidney's architecture governance system**.
