# Architecture Decision Records (ADR)

## 🎯 Purpose

ADR documents record important architectural decisions in Zidney.

Each ADR answers:

- What decision was made?
- Why?
- Alternatives considered?
- Consequences?

---

## 📌 Why ADR Exists

Zidney is:

- Multi-tenant
- White-label SaaS
- Exam-centric
- Institutional-grade

Architectural decisions must be preserved to:

- Prevent accidental reversals
- Help new engineers
- Guide AI agents
- Protect long-term system integrity

---

## 📂 Naming Convention

ADR-XXXX-short-title.md

Example:

ADR-0001-database-per-tenant.md  
ADR-0002-snapshot-attempt-model.md

---

## 🧱 Rules

- ADR cannot be modified silently.
- If architecture changes → create new ADR.
- Never delete ADR.
