# Zidney AI Engineering Rules

This document defines the **mandatory engineering rules that AI coding assistants must follow** when generating or modifying code inside the Zidney repository.

These rules apply to:

- GitHub Copilot
- Cursor AI
- Claude Code
- SpecKit agents
- Any autonomous or semi‑autonomous AI development tool

Violations of these rules will be rejected by the **AI Guard**, **Infra Audit**, and **CI Architecture Governance pipeline**.

---

# 1. Read Architecture Before Coding

Before generating or modifying code, the AI **must read and respect** the Zidney architecture contract:

docs/architecture/intelligence/ARCHITECTURE_CONTRACT.json

This file defines:

• allowed module dependencies  
• forbidden dependencies  
• architecture layers  
• module boundaries

If a generated change violates the contract, it **must not be produced**.

---

# 2. Zidney Monorepo Structure

The repository follows a strict layered monorepo architecture.

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

### Layer Model

```
UI Applications
    ↓
Application Services
    ↓
Domain Layer
    ↓
Infrastructure Packages
```

Cross-layer imports must follow this direction.

---

# 3. Forbidden Dependency Examples

AI must **never generate imports that break architecture boundaries**.

Examples of forbidden dependencies:

```
domain-core → ui-system
domain-core → api-client
api → ui-system
worker → ui-system
packages → apps
```

If the AI attempts to generate these imports, it must refuse and propose an alternative architecture.

---

# 4. Application Boundaries

Applications are isolated:

```
apps/mmc
apps/backoffice
apps/frontoffice
```

Rules:

• apps must not import from other apps  
• shared logic must live inside `packages/`  
• UI components must live inside `packages/ui-system`

Example violation:

```
apps/mmc importing apps/backoffice code
```

Correct solution:

Move shared logic into a package.

---

# 5. Domain Isolation

The `domain-core` package represents the **pure business domain**.

Rules:

• must contain no UI code  
• must contain no HTTP code  
• must contain no database client code  
• must remain framework independent

Allowed dependencies:

```
types
validation
```

Forbidden:

```
ui-system
api-client
any app
```

---

# 6. UI System Rules

The UI component library lives in:

```
packages/ui-system
```

Rules:

• reusable UI only  
• no domain logic  
• no API calls  
• no business rules

Applications consume UI components but **UI never consumes applications**.

---

# 7. API Client Layer

API communication is centralized:

```
packages/api-client
```

Rules:

• UI apps must use api-client  
• UI apps must not directly call fetch/axios  
• token handling must go through the API client interceptors

---

# 8. Worker Isolation

The background worker runs independently.

```
apps/worker
```

Rules:

• worker cannot import UI  
• worker cannot import applications  
• worker may import packages only

---

# 9. Test Architecture

Testing follows the Zidney testing architecture.

```
unit tests
integration tests
e2e tests
```

Locations:

```
packages/*/tests/unit
apps/*/tests/unit
apps/*/tests/integration
apps/*/tests/e2e
```

Rules:

• tests must not bypass architecture boundaries  
• integration tests must test module contracts, not internal implementation

---

# 10. Code Generation Safety

AI must avoid generating code that introduces:

• circular dependencies  
• cross-layer imports  
• hidden infrastructure dependencies  
• duplicated domain logic

If such code is requested, AI should **suggest refactoring the architecture instead**.

---

# 11. Commit Safety

Before a change is committed, the following checks will run automatically:

```
AI Guard
Infra Audit
Architecture Diff
ESLint
TypeScript
Tests
```

AI must assume that **architecture violations will block the commit**.

---

# 12. Architecture Evolution

Architecture changes must follow the **ADR process**.

Architecture Decision Records live in:

```
docs/architecture/ADR/
```

AI must **never silently change architecture**.

If a change requires architectural modification, AI should propose:

• a new ADR  
• a design explanation  
• a migration plan

---

# 13. AI Development Principle

AI assistants should behave as **architecture-aware collaborators**, not just code generators.

The AI must:

• understand system structure  
• respect module boundaries  
• prevent architectural drift  
• propose improvements when necessary

---

# 14. Governance Pipeline

Zidney uses a multi-layer architecture governance system.

```
AI Engineering Rules
        ↓
AI Guard (local commit protection)
        ↓
Infra Audit (full architecture scan)
        ↓
Architecture Diff (PR-level drift detection)
        ↓
CI Governance Pipeline
```

This guarantees the repository remains **architecture-safe even with AI-driven development**.

---

# Summary

AI must follow these principles:

1. Read the architecture contract before coding
2. Respect module boundaries
3. Never create forbidden dependencies
4. Keep domain logic isolated
5. Use shared packages for cross-app logic
6. Propose ADRs for architectural changes

Failure to follow these rules will result in **rejected commits and CI failures**.
