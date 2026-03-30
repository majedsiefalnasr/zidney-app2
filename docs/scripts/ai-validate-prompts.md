# ai:validate:prompts

## Command

```sh
bun run ai:validate:prompts
```

## Purpose

Validates AI agent and prompt file structural integrity

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/prompt-qa.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run ai:validate:prompts`
- Implementation: scripts/prompt-qa.ts
- Metadata-backed script file: `scripts/prompt-qa.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Audit attempt failed in isolated worktree: bun run ai:validate:prompts --ci exited non-zero before tracked file changes were observed.
