# validate:scripts:registry

## Command

```sh
bun run validate:scripts:registry
```

Registered package.json runner:

```sh
bun scripts/validate/diff-script-registry.ts
```

## Purpose

Compare scanned runtime spec script references against root package.json, produce diff report

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. Its implementation lives in scripts/validate/diff-script-registry.ts and is exposed through the root package.json interface.

## Source

- Implementation: scripts/validate/diff-script-registry.ts
- Metadata-backed script file: `scripts/validate/diff-script-registry.ts`

## CI Behavior

Supported explicitly in the implementation.

## When to Run

- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: None
- Used by other root scripts: None found

## Audit Notes

- Observed in isolated worktree run: specs/runtime/fix-01-runtime-script-recovery-and-validation/audits/script-registry-diff.json.
