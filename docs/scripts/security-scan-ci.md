# infra:security:ci

## Command

```sh
bun run infra:security:ci
```

Registered package.json runner:

```sh
bun scripts/security/scan-ci.ts
```

## Purpose

Run the CI-equivalent Trivy scan, write a sanitized report, and block on CI-grade findings.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml. Its implementation lives in scripts/security/scan-ci.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/security/scan-ci.ts
- Metadata-backed script file: `scripts/security/scan-ci.ts`

## CI Behavior

Dedicated CI runner by name; this entrypoint is already the CI-specific variant.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.
- When running repository security scans locally or in hardened validation pipelines.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: external scanner dependency or long-running security scan.
