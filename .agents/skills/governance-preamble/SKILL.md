---
name: governance-preamble
description: Shared governance declaration that all Zidney agents reference instead of embedding duplicate governance blocks
metadata:
  category: governance
  scope: all-agents
  capabilities:
    - governance declaration
    - authority hierarchy reference
    - verdict semantics
    - escalation protocol
---

# Governance Preamble Skill

This skill replaces the duplicated `# GOVERNANCE DECLARATION` blocks in all Zidney agents. Instead of embedding ~10 lines of governance context in every agent file, agents reference this skill.

---

## Governance Declaration

All Zidney AI agents operate under the following governance hierarchy:

1. **Constitution** — `specs/constitution.md`
2. **ADRs** — `docs/architecture/ADR/ADR-*`
3. **Orchestrator** — `.agents/agents/orchestrator.agent.md`
4. **Agent Governance** — `docs/AGENT_GOVERNANCE.md`
5. **AGENTS.md contracts** — Root and app/package-level behavioral rules
6. **Skill files** — Domain-specific guidance

If any conflict exists between levels, the higher level wins.

---

## Authority Chain

```
Constitution > ADR > Orchestrator > Agent Governance > AGENTS.md > Skills > Implementation
```

AI agents must never override a higher-level authority.

---

## Verdict Semantics

All guardian agents produce verdicts:

| Verdict | Meaning |
|---------|---------|
| `PASS` | No violations found — proceed |
| `BLOCKED` | Violation detected — must fix before proceeding |
| `WARNING` | Non-blocking concern — note and continue |

A `BLOCKED` verdict at any guardian gate stops the pipeline.

---

## Escalation Protocol

AI agents must escalate when:

- Ambiguous specification detected
- Conflicting ADR found
- Migration risk identified
- Tenant isolation risk detected
- Version compatibility uncertainty exists
- Stage lifecycle conflict detected

Escalation = stop and ask for human clarification. Guessing is forbidden.

---

## Mandatory Pre-Reasoning Checks

Before generating code, every agent must verify:

1. Stage lifecycle status (DRAFT/IN PROGRESS/CLOSED/HARDENED)
2. Import boundary compliance
3. Tenant isolation preservation
4. License middleware presence on workspace routes

---

## How Agents Reference This Skill

Instead of embedding a governance declaration block, agents include:

```markdown
## Governance

This agent operates under the Zidney Governance Preamble.
See: `.agents/skills/governance-preamble/SKILL.md`
```

This saves ~10 lines per agent × 12+ agents = 120+ lines of duplicated tokens.

---

## Enforcement

`docs/AGENT_GOVERNANCE.md` remains the authoritative behavioral rule document. This skill is a reference shortcut, not a replacement.
