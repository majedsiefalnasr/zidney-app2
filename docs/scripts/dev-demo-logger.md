# dev:demo:logger

## Command

```sh
bun run dev:demo:logger
```

Registered package.json runner:

```sh
bun scripts/dev/demo-logger-features.ts
```

## Purpose

Demonstrates all available logger customization options and features

## Why It Exists

This runner is currently classified as medium. Not safe to remove directly. Other root scripts depend on it: dev:demo-logger-features. Its implementation lives in scripts/dev/demo-logger-features.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/dev/demo-logger-features.ts
- Metadata-backed script file: `scripts/dev/demo-logger-features.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: None
- Used by other root scripts: `dev:demo-logger-features`

## Audit Notes

- Not audited automatically in the isolated execution pass.
