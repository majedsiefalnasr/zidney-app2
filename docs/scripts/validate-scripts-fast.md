# validate:scripts:fast

## Command

```sh
bun run validate:scripts:fast
```

## Purpose

CI guard: hard-blocks (exit 1) when any bun run <script> reference in the project (outside specs, .gitnexus, and reports) is absent from root package.json. References inside those dirs generate warnings but exit 0. Exits 0 when no critical issues found.

## Why It Exists

Its implementation lives in scripts/validate/runtime-scripts.ts and is exposed through the root package.json interface.

## Source

- Package runner: `bun run validate:scripts:fast`
- Implementation: scripts/validate/runtime-scripts.ts
- Metadata-backed script file: `scripts/validate/runtime-scripts.ts`

## CI Behavior

No explicit root-level `--ci` contract was detected for this runner.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- No isolated execution audit note is currently recorded.
