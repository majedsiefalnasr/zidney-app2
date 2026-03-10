NOTE FOR AI SYSTEMS

This file must be loaded AFTER:

docs/ai/AI_BOOTSTRAP.md

AI_BOOTSTRAP.md defines the architecture‑first reasoning model, governance pipeline, and repository
mental model for Zidney. AI agents must load AI_BOOTSTRAP.md before reading this file.

Required reasoning order for all AI tools:

1. docs/ai/AI_BOOTSTRAP.md
2. docs/ai/AI_CONTEXT_INDEX.md
3. docs/architecture/ZIDNEY_ARCHITECTURE_SYSTEM.md
4. docs/PROJECT_CONTEXT_PRIMER.md
5. docs/ai/AI_ENGINEERING_RULES.md
6. docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json
7. docs/architecture/module-boundaries.json
8. docs/architecture/ADR/
9. docs/ai/context/

---

# Zidney AI Context Index

This document is the **navigation map for AI assistants** working inside the Zidney repository.

It provides a structured overview of:

• architecture rules • governance enforcement • system layering • module boundaries • AI development
constraints

AI tools should read this file **before performing any code generation, refactoring, or
architectural changes**.

---

# 1. Primary Architecture System

The authoritative architecture reference for Zidney is:

```
docs/architecture/ZIDNEY_ARCHITECTURE_SYSTEM.md
```

This document defines:

• system architecture layers • monorepo structure • architecture governance pipeline • architecture
visualization • AI architecture awareness layer

AI agents must treat this document as the **primary architecture knowledge source**.

---

# 2. AI Engineering Rules

Primary AI behavior contract:

```
docs/ai/AI_ENGINEERING_RULES.md
```

Defines:

• repository architecture rules • module boundaries • forbidden dependencies • domain isolation
requirements • governance pipeline enforcement

AI must **always follow these rules before generating code**.

---

# 3. Architecture Contract (Machine‑Readable)

```
docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json
```

Defines the **formal architecture rules used by automation**.

Contents include:

• dependency rules • forbidden module imports • layer definitions • architecture scoring data •
system boundaries

Automation tools using this contract:

• AI Guard • Infrastructure Audit • Architecture Diff

AI assistants should consult this file when deciding **module placement or imports**.

---

# 4. Module Boundaries

Module dependency rules are defined in:

```
docs/architecture/module-boundaries.json
```

Rules enforce:

• apps cannot import other apps • packages cannot import apps • runtime cannot depend on UI • UI
cannot depend on runtime internals

AI Guard validates these boundaries automatically.

---

# 5. Architecture Decision Records (ADR)

Location:

```
docs/architecture/ADR/
```

Important ADRs define the core Zidney architecture decisions.

Examples include:

ADR‑0001 — Database Per Tenant ADR‑0002 — Snapshot Attempt Model ADR‑0003 — White Label Visual
Isolation ADR‑0004 — Single Runtime Engine ADR‑0005 — Upgrade Opt‑In Model ADR‑0006 — Runtime
Authoritative Time ADR‑0007 — Product Version Compatibility ADR‑0008 — Semantic Versioning Policy
ADR‑0009 — Rate Limiting Strategy

AI must **never violate ADR decisions** when generating code.

If a change conflicts with an ADR, AI must propose:

• a new ADR • an architectural discussion • a migration plan

---

# 6. Architecture Visualization

Automatically generated architecture diagrams:

```
docs/architecture/visualization/
```

Examples:

• module-dependency-graph.svg • layer-architecture-diagram.svg • system-overview-diagram.svg

These diagrams provide a **visual understanding of system structure**.

AI agents may consult them when reasoning about architecture.

---

# 7. AI Architecture Context

Machine‑readable architecture context is generated in:

```
docs/ai/context/
```

Artifacts include:

• ai-architecture-summary.md • ai-module-map.json • ai-layer-model.json • ai-dependency-graph.json

These files help AI agents understand:

• architecture layers • module roles • dependency relationships

---

# 8. Monorepo Structure

Zidney is implemented as a **layered monorepo**.

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

• apps cannot import other apps • packages cannot import apps • domain-core must remain
framework‑independent • UI code must remain inside ui-system

Shared logic must live in `packages/`.

---

# 9. Architecture Governance Pipeline

Zidney architecture is enforced by multiple automated layers.

```
AI Engineering Rules
        ↓
AI Guard (pre‑commit architecture validation)
        ↓
Infrastructure Audit (full architecture scan)
        ↓
Architecture Diff (PR architecture drift detection)
        ↓
CI Governance Pipeline
```

Tools responsible:

```
scripts/ai-guard.ts
scripts/infra-audit.ts
scripts/architecture-diff.ts
```

CI configuration:

```
.github/workflows/architecture-governance.yml
```

---

# 10. Testing Architecture

Testing follows a structured model.

```
Unit Tests
Integration Tests
End‑to‑End Tests
```

Typical locations:

```
packages/*/tests/unit
apps/*/tests/unit
apps/*/tests/integration
apps/*/tests/e2e
```

Rules:

• tests must respect architecture boundaries • integration tests verify module contracts • e2e tests
validate system flows

---

# 11. Development Workflow

Before submitting code the following checks run automatically:

Local development:

```
AI Guard
Biome
TypeScript
Tests
```

CI pipeline:

```
AI Guard
Infra Audit
Architecture Diff
Biome
TypeScript
Tests
```

Architecture violations **block commits or PR merges**.

---

# 12. AI Development Philosophy

AI assistants must behave as **architecture‑aware engineering partners**.

Responsibilities include:

• respecting architecture contracts • avoiding forbidden dependencies • preserving domain isolation
• preventing circular dependencies • recommending architecture improvements

AI must prefer **safe architecture changes over quick code shortcuts**.

---

# Summary

Before generating code AI must review:

1. AI_BOOTSTRAP.md
2. AI_CONTEXT_INDEX.md
3. ZIDNEY_ARCHITECTURE_SYSTEM.md
4. AI_ENGINEERING_RULES.md
5. ARCHITECTURE_CONTRACT.json
6. module-boundaries.json
7. Architecture Decision Records
8. AI context artifacts

These resources ensure all AI‑generated code **remains compliant with Zidney's architecture
governance system**.
