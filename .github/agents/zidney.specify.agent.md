---
name: Zidney Specifier
description: This custom agent specifies the Zidney tenant baseline schema implementation.
# Enable subagent tool and reading for Constitution/Template access
tools: ['agent', 'read']
# Whitelist the specific specification sub-agent
agents: ['speckit.specify']
---

## User Input

$ARGUMENTS

## Instructions

**Action:**
Use #tool:agent/runSubagent to define functional requirements via @speckit.specify.

**Specification Requirements for @speckit.specify:**
"
Define strict functional requirements for:

- Stage: <STAGE_NAME>
- Phase: <PHASE_NUMBER>

**Binding Authority:**

- Use **Zidney Constitution v1.2.0** as the primary source of truth.
- Use [Zidney Specify Template](../../specs/templates/specify-template.md).

**Constraints & Guards:**

- No architecture redesign; preserve Database-per-tenant.
- License middleware is mandatory.
- Server-authoritative time only.
- Worker-only grading logic (if applicable).
- Snapshot integrity preserved (if attempt-related).
- All writes must be transactional with idempotency for critical endpoints.
- Version compatibility must be enforced.

**Safety Check:**

- Do not introduce new patterns.
- If the requirement suggests a change that requires an ADR (Architecture Decision Record), STOP and request it.
  "
