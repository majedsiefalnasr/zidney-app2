---
description: This custom agent generates atomic tasks for the Zidney tenant baseline schema implementation.
---

## User Input

```text
$ARGUMENTS
```

Follow instructions in [speckit.tasks.prompt.md](../prompts/speckit.tasks.prompt.md).

Generate atomic tasks for:
Stage: <STAGE_NAME>

Use [Zidney Tasks Template](../../specs/templates/tasks-template.md)

Each task must:

- Be scoped to one layer
- Declare transactional status
- Declare idempotency requirements
- Declare middleware dependency
- Not modify unrelated files
- Preserve isolation guarantees

$ARGUMENTS
