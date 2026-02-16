---
description: This custom agent specifies the Zidney tenant baseline schema implementation.
---

## User Input

```text
$ARGUMENTS
```

Follow instructions in [speckit.specify.prompt.md](../prompts/speckit.specify.prompt.md).

Stage: <STAGE_NAME>
Phase: <PHASE_NUMBER>

Use Zidney Constitution v1.2.0 as binding authority.
Use [Zidney Specify Template](../../specs/templates/specify-template.md)

Define strict functional requirements.

Constraints:

- No architecture redesign
- Database-per-tenant preserved
- License middleware mandatory
- Server-authoritative time only
- Worker-only grading (if applicable)
- Snapshot integrity preserved (if attempt-related)
- All writes transactional
- Idempotency required for critical endpoints
- Version compatibility enforced

Do not introduce new patterns.
If ADR required, stop and request it.

$ARGUMENTS
