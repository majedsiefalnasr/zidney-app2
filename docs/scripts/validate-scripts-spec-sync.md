# validate:scripts:spec-sync

## Command

```sh
bun run validate:scripts:spec-sync
```

## Purpose

Reverse validation: scans all spec files (specs/, docs/) for `bun run <script>` references and verifies each exists in root package.json. Exits non-zero if any referenced script is missing.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/validate/spec-sync.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run validate:scripts:spec-sync`
- Implementation: scripts/validate/spec-sync.ts
- Metadata-backed script file: `scripts/validate/spec-sync.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
