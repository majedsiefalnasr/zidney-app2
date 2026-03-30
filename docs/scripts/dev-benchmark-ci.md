# dev:benchmark:ci

## Command

```sh
bun run dev:benchmark:ci
```

## Purpose

Benchmark CI pipeline duration assumptions, generate markdown performance reports, and write a dashboard snapshot.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/dev/benchmark-ci-duration.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run dev:benchmark:ci`
- Implementation: scripts/dev/benchmark-ci-duration.ts
- Metadata-backed script file: `scripts/dev/benchmark-ci-duration.ts`

## CI Behavior

Dedicated CI runner by name; this entrypoint is already the CI-specific variant.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.
- During local development when you need the associated developer workflow.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
