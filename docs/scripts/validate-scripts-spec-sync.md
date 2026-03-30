# validate:scripts:spec-sync

## Command

```sh
bun run validate:scripts:spec-sync
```

## Purpose

Reverse validation: scans all spec files (specs/, docs/) for `bun run <script>` references and verifies each exists in root package.json. Exits non-zero if any referenced script is missing.

## Why It Exists

Its implementation lives in scripts/validate/spec-sync.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run validate:scripts:spec-sync`
- Implementation: scripts/validate/spec-sync.ts
- Metadata-backed script file: `scripts/validate/spec-sync.ts`

## CI Behavior

No explicit root-level `--ci` contract was detected for this runner.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- No isolated execution audit note is currently recorded.
