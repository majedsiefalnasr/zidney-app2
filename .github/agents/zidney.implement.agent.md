---
description: This custom agent implements the Zidney tenant baseline schema implementation.
---

## User Input

```text
$ARGUMENTS
```

Follow instructions in [speckit.implement.prompt.md](../prompts/speckit.implement.prompt.md).

Use [Zidney Implementation Template](../../specs/templates/implement-template.md)``

Implement Stage: <STAGE_NAME>

Rules:

- Modify only relevant files
- Use tenant resolver only
- No direct DB instantiation
- All writes transactional
- Idempotency enforced
- Structured logging required
- Correlation ID required
- No business logic in frontend
- No stack traces to client

If conflict with Constitution → STOP.

$ARGUMENTS
