---
name: Zidney Orchestrator
description: Generates atomic tasks for the Zidney tenant baseline schema.
# 1. Enable the agent tool to allow calling subagents
tools: ['agent']
# 2. Whitelist the subagent you want to call
agents: ['speckit.tasks']
---

## User Input

$ARGUMENTS

## Instructions

**Action:**
Use #tool:agent/runSubagent to delegate task generation to @speckit.tasks.

**Task for @speckit.tasks:**
"
Generate atomic tasks for:
Stage: <STAGE_NAME> (from $ARGUMENTS)

Use [Zidney Tasks Template](../../specs/templates/tasks-template.md)

Each task must:

- Be scoped to one layer
- Declare transactional status
- Declare idempotency requirements
- Declare middleware dependency
- Not modify unrelated files
- Preserve isolation guarantees
  "
