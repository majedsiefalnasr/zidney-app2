# dev:demo-logger-features

## Command

```sh
bun run dev:demo-logger-features
```

Registered package.json runner:

```sh
bun run dev:demo:logger
```

## Purpose

Demonstrates all available logger customization options and features

## Why It Exists

This runner is currently classified as low. Usually removable if the team no longer uses the demo or debug workflow. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Implementation: scripts/dev/demo-logger-features.ts
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: `dev:demo:logger`, `dev`
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
