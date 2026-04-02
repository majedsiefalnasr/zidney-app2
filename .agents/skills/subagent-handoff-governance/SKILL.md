---
name: subagent-handoff-governance
description: Use when coordinating subagent handoffs, validating exact handoff target names against a declared registry, and applying retry or abort handling for failed handoffs.
---

# Subagent Handoff Governance

This skill governs subagent handoffs in Zidney workflow agents.

Use it when an agent coordinates other agents through `/handoff` calls.

## Required Behavior

1. Treat the local frontmatter `agents` list as the authoritative registry.
2. Use exact, case-sensitive agent names in every `/handoff`.
3. Stop the workflow if a required capability is not present in the registry.
4. After every handoff, validate that the response is present, complete, and non-error.
5. If a handoff fails, surface retry or abort options and do not silently continue.

## Failure Modes

- No output
- Explicit error output
- Timeout
- Partial output missing required sections
- `VERDICT: BLOCKED`

## Required Response

- Retry the same handoff only when the workflow explicitly allows retries.
- Abort and persist current workflow state when retries are exhausted or the user chooses to stop.
- Do not reinterpret a `BLOCKED` verdict as a successful handoff.
