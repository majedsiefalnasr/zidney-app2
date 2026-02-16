---
description: This custom agent plans the Zidney tenant baseline schema implementation.
---

## User Input

```text
$ARGUMENTS
```

Follow instructions in [speckit.plan.prompt.md](../prompts/speckit.plan.prompt.md).

Stage: <STAGE_NAME>

Use [Zidney Plan Template](../../specs/templates/plan-template.md)

Create technical implementation plan including:

- Tables / schema changes
- Migrations
- Endpoints
- Middleware layers
- Transaction boundaries
- Idempotency strategy
- Concurrency guard strategy
- Version enforcement logic
- Error code mapping
- Logging requirements
- Worker interaction (if applicable)

Constraints:

- No cross-tenant logic
- No direct DB instantiation
- All writes transactional
- Server authoritative time only
- Version compatibility required

$ARGUMENTS
