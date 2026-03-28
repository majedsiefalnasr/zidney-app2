# build:packages

## Command

```sh
bun run build:packages
```

Registered package.json runner:

```sh
bash -lc 'for d in packages/*; do if [ -f "$d/package.json" ]; then (cd "$d" && echo "Building $d" && bun run build); fi; done'
```

## Purpose

Run the registered repository task for this area.

## Why It Exists

This runner is currently classified as critical. Do not remove without updating CI or workflow automation. Direct workflow usage found in: .github/workflows/ci.yml. It provides a stable root package.json interface over underlying tools or chained child runners.

## Source

- Implementation: Wrapper only; no single scripts/\*.ts source file.
- Metadata-backed script file: No metadata-backed implementation file detected.

## CI Behavior

No dedicated --ci flag is exposed at this alias level.

## When to Run

- When running repository quality checks before commit or push.

## Related Scripts

- Depends on: `build`
- Used by other root scripts: None found

## Audit Notes

- Not audited automatically: wrapper or expensive runner with no dedicated tracked-file output contract.
