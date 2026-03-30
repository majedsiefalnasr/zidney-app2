# infra:security

## Command

```sh
bun run infra:security
```

## Purpose

Run a full Trivy filesystem scan and print visible findings without blocking on non-clean results.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/security/scan.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run infra:security`
- Implementation: scripts/security/scan.ts
- Metadata-backed script file: `scripts/security/scan.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When running repository security scans locally or in hardened validation pipelines.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: external scanner dependency or long-running security scan.
