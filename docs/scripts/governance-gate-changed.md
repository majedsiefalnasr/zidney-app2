# governance:gate:changed

## Command

```sh
bun run governance:gate:changed
```

Registered package.json runner:

```sh
bun run arch:context:changed && bun run arch:guard:changed
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as medium. Potential removal candidate if you also retire the underlying implementation and any manual workflow that depends on it. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

Indirect wrapper; CI behavior depends on child runner(s): arch:context:changed, arch:guard:changed.

## When to Run

- When reproducing CI behavior locally or validating CI-only output paths.
- Before opening or updating a pull request that touches the related governance surface.

## Related Scripts

- Depends on: `arch:context:changed`, `arch:guard:changed`, `arch:guard`
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically in the isolated execution pass.
