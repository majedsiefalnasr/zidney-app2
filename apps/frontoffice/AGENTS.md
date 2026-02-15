## AI Agent Constraints

Frontoffice operates under strict runtime constraints.

AI agents working in this directory MUST:

- Use shadcn-vue components before custom markup
- Use Tailwind v4 utilities only (no legacy syntax)
- Follow existing folder structure and module boundaries
- Use Composition API only (no Options API)
- Keep business logic out of components
- Call only documented backend endpoints
- Never invent backend contracts
- Never compute grading or subscription rules locally
- Never duplicate backend validation logic

If an API contract is unclear:
Stop and request clarification.
Do not guess.

---

## Local Enforcement Subset (Frontoffice Scope)

This directory enforces a reduced but strict subset of global rules:

Architecture:

- No imports from other apps/\*
- No direct DB access
- No server-side logic replication
- No domain rule evaluation

Security:

- JWT must not be stored in unsafe contexts
- Sensitive data must not be persisted
- Workspace slug must always come from router context

UI:

- No custom design systems
- No hardcoded brand colors
- All theming via controlled theme tokens
- No CSS overrides of shadcn internals

Runtime:

- Attempt state must always come from API
- Timer is display-only (server authoritative)
- Question order immutable
- Attempt mode immutable
- UI must lock immediately on attempt completion

Performance:

- Heavy components lazy-loaded
- No deep watchers on large objects
- Avoid unnecessary global reactivity

Violation of these rules is considered architectural failure.

---

## Stability Principle

Frontoffice is a rendering layer.

If Frontoffice:

- Alters grading logic
- Alters attempt configuration
- Assumes business rules
- Bypasses subscription enforcement

Zidney’s trust model breaks.

Frontoffice must remain thin, deterministic, and controlled.
