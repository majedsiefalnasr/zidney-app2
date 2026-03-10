# Zidney Documentation

This directory contains governance, DevOps, workflow, and architectural decisions.

Zidney documentation is separated into two major systems:

---

## docs/

Purpose: Operational governance and engineering standards.

Audience:

- Engineers
- DevOps
- AI coding agents
- Future maintainers

Contains:

- Engineering rules
- Security standards
- Migration policies
- Deployment strategy
- Logging & observability
- Architectural decision records (ADR)

Docs do NOT define features. They define HOW features must be built.

---

## specs/phases/

Purpose: Feature and domain specifications.

Audience:

- Engineers
- AI code generators

Specs define:

- System architecture
- Data models
- Runtime behavior
- Execution sequence
- Phase/stage breakdown

Specs define WHAT to build.

---

## Separation Rule

docs/ = governance & operational rules  
specs/phases/ = product & system definition

Neither should duplicate the other.

---

## Engineering Discipline

Before implementing anything:

1. Read relevant spec.
2. Follow governance rules.
3. Respect migration policy.
4. Respect tenant isolation.
5. Follow runtime execution rules.

---

Zidney is:

- Multi-tenant
- Database-per-tenant
- Exam-centric
- White-label SaaS
- Stability-first

Documentation is part of the product.
