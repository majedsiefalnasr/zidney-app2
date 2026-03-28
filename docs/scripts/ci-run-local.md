# ci:run-local

## Command

```sh
bun run ci:run-local
```

Registered package.json runner:

```sh
bun scripts/run-local-ci.ts
```

## Purpose

Local CI governance orchestrator — runs the 7-step pre-closure validation sequence including all governance checks and the full act CI simulation. Step 0 is a Docker fail-fast check; Steps 1–7 are governance checks that run to completion regardless of individual failures (fail-forward).

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/run-local-ci.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/run-local-ci.ts
- Metadata-backed script file: `scripts/run-local-ci.ts`

## CI Behavior

Supported explicitly in the implementation; --ci is forwarded only to a strict internal allowlist.

## When to Run

- When the corresponding repository workflow requires this root runner.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
