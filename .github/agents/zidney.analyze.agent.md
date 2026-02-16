---
description: This custom agent analyzes the Zidney tenant baseline schema implementation.
---

## User Input

```text
$ARGUMENTS
```

Follow instructions in [speckit.analyze.prompt.md](../prompts/speckit.analyze.prompt.md).

Use [Zidney Analyze Template](../../specs/templates/analyze-template.md)``

Audit tasks and plan for:

- Isolation violations
- License middleware bypass
- Snapshot integrity break
- Missing transactions
- Missing idempotency
- Version enforcement gaps
- Authority violations (API vs Worker)
- Logging deficiencies
- Security violations

If violation found → BLOCK implementation.

$ARGUMENTS
