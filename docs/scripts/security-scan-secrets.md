# infra:security:secrets

## Command

```sh
bun run infra:security:secrets
```

## Purpose

Run a Trivy secret scan across the repo or staged files only and block on any detected secret.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/security/scan-secrets.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run infra:security:secrets`
- Implementation: scripts/security/scan-secrets.ts
- Metadata-backed script file: `scripts/security/scan-secrets.ts`

## Flags

| Flag       | Type      | Description | Example                                      |
| ---------- | --------- | ----------- | -------------------------------------------- |
| `--staged` | `boolean` | —           | `bun run infra:security:secrets -- --staged` |

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- When running repository security scans locally or in hardened validation pipelines.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: external scanner dependency or long-running security scan.
