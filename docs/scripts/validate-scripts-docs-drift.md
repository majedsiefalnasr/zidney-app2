# validate:scripts:docs-drift

## Command

```sh
bun run validate:scripts:docs-drift
```

## Purpose

Detects scripts in root package.json that have no corresponding documentation file in docs/scripts/. Reports missing docs and exits non-zero when undocumented scripts are found.

## Why It Exists

Its implementation lives in scripts/validate/docs-drift.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run validate:scripts:docs-drift`
- Implementation: scripts/validate/docs-drift.ts
- Metadata-backed script file: `scripts/validate/docs-drift.ts`

## CI Behavior

No explicit root-level `--ci` contract was detected for this runner.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- No isolated execution audit note is currently recorded.
