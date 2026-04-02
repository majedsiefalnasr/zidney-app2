---
name: documentation-writer-protocol
description: Use when a workflow must generate reports, PR summaries, testing guides, ADR markdown, or other governed documentation via the Technical Writer subagent.
---

# Documentation Writer Protocol

This skill governs markdown artifact generation in Zidney workflows.

Use it when a coordinating agent needs to produce:

- step reports such as `*_REPORT.md`
- `PR_SUMMARY.md`
- `TESTING_GUIDE.md`
- ADR markdown files
- stage README progress summaries

## Required Behavior

1. Delegate drafting to the `Technical Writer` subagent before writing the artifact.
2. Pass the target path, audience, and authoritative source artifacts in the handoff.
3. Preserve verified facts only. Do not invent scope, test evidence, or implementation details.
4. Resolve all template placeholders before persisting the markdown.
5. Apply the calling workflow's handoff error protocol after the subagent returns.

## Required Handoff Shape

```text
/handoff to=Technical Writer

Document: <target path>
Audience: <primary reader>
Source Artifacts: <authoritative inputs>
Constraints: Preserve verified facts only, resolve all placeholders, do not invent scope.
```

## Non-Goals

- This skill does not choose workflow steps.
- This skill does not persist files by itself.
- This skill does not replace source-of-truth artifacts such as `spec.md`, `plan.md`, or `tasks.md`.
