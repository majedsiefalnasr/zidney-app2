# ai:guard

## Command

```sh
bun run ai:guard
```

Registered package.json runner:

```sh
bun run scripts/ai-guard.ts
```

## Purpose

Enforces architecture rules (import boundaries, contract compliance) before AI-generated commits and in CI.

## Why It Exists

This runner is currently classified as critical. Treat as protected. It is a primary quality, build, test, or governance entrypoint. Its implementation lives in scripts/ai-guard.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/ai-guard.ts
- Metadata-backed script file: `scripts/ai-guard.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
