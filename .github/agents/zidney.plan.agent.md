---
name: Zidney Planner
description: This custom agent plans the Zidney tenant baseline schema implementation.
# Enable subagent execution and read-only tools for research
tools: ['agent', 'read', 'search']
# Whitelist the specific planning sub-agent
agents: ['speckit.plan']
---

## User Input

$ARGUMENTS

## Instructions

**Action:**
Use #tool:agent/runSubagent to generate a comprehensive technical plan via @speckit.plan.

**Planning Objectives for @speckit.plan:**
"
Create a technical implementation plan for Stage: <STAGE_NAME> (from $ARGUMENTS).
Use the [Zidney Plan Template](../../specs/templates/plan-template.md).

**The plan must cover:**

- Tables / schema changes & Migrations
- Endpoints & Middleware layers
- Transaction boundaries & Idempotency strategy
- Concurrency guard strategy & Version enforcement logic
- Error code mapping & Logging requirements
- Worker interaction (if applicable)

**Strict Constraints:**

- No cross-tenant logic.
- No direct DB instantiation.
- All writes must be transactional.
- Server authoritative time only.
- Version compatibility required.
  "
